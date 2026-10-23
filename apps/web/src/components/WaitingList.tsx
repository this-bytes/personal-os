import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@personal-os/ui';
import {
  resolvePersona,
  type Participant,
  type Persona,
  type PersonaSource,
  type WaitingItem,
} from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, ApprovalDecision, ExecutionResolution } from '../lib/types';
import { useWorkspace } from '../state/workspace';
import { useServerEvents } from '../state/events';
import { EmptyState, ErrorState, LoadingState } from './ErrorState';
import { WaitingRow, targetFor } from './waiting/WaitingRow';

/**
 * How often the list is refreshed even when nothing announced itself.
 *
 * The event stream carries everything the panel changes itself — including a
 * decision on an approval, which publishes `approval.decided`. The slow
 * refresh is the backstop for the changes the stream does not carry: a
 * decision taken before this client connected, and a change made by another
 * surface while the stream was down.
 */
const SAFETY_NET_REFETCH_MS = 15_000;

const QUERY_KEY = 'waiting';

interface WaitingListProps {
  /**
   * The agents the panel already knows.
   *
   * The list says which agent is waiting, and it says it by name when the
   * panel knows the name. These are the agents the panel has already asked
   * for, so naming them costs no extra request.
   *
   * Only a name and a persona are needed, so a surface that knows less than
   * the agents page can still say who is waiting.
   */
  agents: Array<{ id: string; name: string; persona?: Persona }>;
  /**
   * The conversations the panel already knows.
   *
   * A conversation may replace the persona of an agent for itself, so the
   * list needs the conversation before it can say which persona is in force.
   */
  conversations: Array<{ id: string; participants: Participant[] }>;
}

/**
 * What is waiting on the owner.
 *
 * One list, in one request: a pending approval, a task waiting for an
 * acceptance decision, a blocked task and a task whose outcome is unknown are
 * the same question asked in four places, and the owner should not have to go
 * and look for them.
 *
 * An approval is decided here, where the owner can see what is being asked of
 * them. Anything else that needs a reply opens the place where it is decided.
 */
export function WaitingList({ agents, conversations }: WaitingListProps): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { subscribe } = useServerEvents();
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<{ title: string; detail: string } | null>(null);

  const waiting = useQuery<WaitingItem[]>({
    queryKey: [QUERY_KEY, activeWorkspaceId],
    queryFn: () =>
      api
        .get<{ items: WaitingItem[] }>('/waiting', { workspaceId: activeWorkspaceId ?? undefined })
        .then((response) => response.items),
    enabled: Boolean(activeWorkspaceId),
    refetchInterval: SAFETY_NET_REFETCH_MS,
  });

  // The list follows the events the panel already has: a task that changed
  // state, an agent that asked for an approval, and an approval that was
  // decided — by this panel or by any other surface.
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'task.updated') {
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
        return;
      }
      if (event.type === 'approval.decided') {
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
        return;
      }
      if (event.type === 'execution.event' && event.event.type === 'approval.requested') {
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      }
    });
  }, [subscribe, queryClient]);

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const conversationsById = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.id, conversation])),
    [conversations],
  );

  /**
   * The decision is taken here, where the list is.
   *
   * The list is the one place the owner is already looking at what is being
   * asked of them, so it is where the answer is given. The decision itself is
   * the server's: this only sends it.
   *
   * What the decision *did* is the server's to say as well, and the account of
   * it comes back with the decision. A turn that continued and a turn that
   * closed are told apart in words, because the entry itself leaves the list
   * the moment it is decided — the owner would otherwise be left holding a
   * decision that looks the same either way, and an operation that was never
   * performed.
   */
  const decide = useMutation({
    mutationFn: async (input: { approvalId: string; approved: boolean; title: string }) =>
      api.post<ApprovalDecision>(`/approvals/${input.approvalId}/decide`, {
        approved: input.approved,
        reason: input.approved
          ? 'Approved from the waiting list.'
          : 'Rejected from the waiting list.',
      }),
    onSuccess: async (result, input) => {
      setDecisionError(null);
      setDecisionNote({ title: input.title, detail: result.detail });
      // The item has stopped waiting, so the list says so without the owner
      // reloading the page.
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      setDecisionError(errorMessage(error));
      setDecisionNote(null);
    },
  });

  /**
   * The owner closes a turn they were told to check.
   *
   * The conclusion is theirs: it did run, or it did not. The server records
   * it, the reply follows it, the turn leaves the list, and what the
   * conclusion *did* is the server's to say — the account of it comes back
   * with the answer, the way a decision's does.
   */
  const resolveTurn = useMutation({
    mutationFn: async (input: {
      executionId: string;
      outcome: 'completed' | 'failed';
      title: string;
    }) =>
      api.post<ExecutionResolution>(`/executions/${input.executionId}/resolve`, {
        outcome: input.outcome,
      }),
    onSuccess: async (result, input) => {
      setDecisionError(null);
      setDecisionNote({ title: input.title, detail: result.detail });
      // The turn has stopped waiting, so the list says so without the owner
      // reloading the page.
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      setDecisionError(errorMessage(error));
      setDecisionNote(null);
    },
  });

  /**
   * The owner widens the grant from the row.
   *
   * The row is where the owner is looking when they see that an agent cannot
   * go on, so the row is where the grant is widened. The route is the one the
   * contract publishes: it widens that agent's grant to include the one tool
   * and leaves the rest of the grant as it was, so the action that unblocks
   * an agent cannot take anything away.
   *
   * The row carries the tool's own name, so the owner does not have to go and
   * find out which tool the agent wanted before they can let it have it.
   */
  const widenGrant = useMutation({
    mutationFn: async (input: { agentConnectionId: string; toolName: string; title: string }) =>
      api.post<{ agent: AgentConnectionDetail }>(`/agents/${input.agentConnectionId}/grants`, {
        tool: input.toolName,
      }),
    onSuccess: async (_result, input) => {
      setDecisionError(null);
      setDecisionNote({
        title: input.title,
        detail: `The grant now includes the "${input.toolName}" tool.`,
      });
      // The agent can go on, so the row has stopped waiting and the list says
      // so without the owner reloading the page.
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      setDecisionError(errorMessage(error));
      setDecisionNote(null);
    },
  });

  const items = waiting.data ?? [];

  /**
   * Which persona is in force for the agent that raised the item.
   *
   * The same resolver the agent card and the conversation use, so the list
   * cannot claim a different persona from the one the agent is speaking as.
   * When the client cannot see the conversation the item belongs to, it says
   * nothing about the persona rather than guess.
   */
  const personaForItem = (item: WaitingItem) => personaFor(item, agentsById, conversationsById);
  return (
    <section className="space-y-2" aria-labelledby="waiting-heading">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2
          id="waiting-heading"
          className="text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Waiting on you
          {items.length > 0 ? <span className="ml-1.5 text-slate-600">{items.length}</span> : null}
        </h2>
      </div>

      {waiting.isError ? (
        <ErrorState
          title="The waiting list could not be loaded"
          message={errorMessage(waiting.error)}
          onRetry={() => void waiting.refetch()}
        />
      ) : null}

      {waiting.isLoading ? <LoadingState label="Loading what is waiting…" /> : null}

      {!waiting.isLoading && !waiting.isError && items.length === 0 ? (
        <EmptyState
          title="Nothing is waiting on you"
          message="No agent is stopped on a decision and no task is waiting for your acceptance. The moment one is, it shows up here."
        />
      ) : null}

      {items.length > 0 ? (
        <Card>
          <CardContent className="p-2">
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id}>
                  <WaitingRow
                    item={item}
                    agent={
                      item.agentConnectionId ? agentsById.get(item.agentConnectionId) : undefined
                    }
                    persona={personaForItem(item)}
                    href={targetFor(item)}
                    busy={decide.isPending || resolveTurn.isPending || widenGrant.isPending}
                    onDecide={(approvalId, approved) =>
                      decide.mutate({ approvalId, approved, title: item.title })
                    }
                    onResolve={(executionId, outcome) =>
                      resolveTurn.mutate({ executionId, outcome, title: item.title })
                    }
                    onWidenGrant={(agentConnectionId, toolName) =>
                      widenGrant.mutate({ agentConnectionId, toolName, title: item.title })
                    }
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {decisionNote ? (
        <p className="px-0.5 text-[11px] leading-snug text-slate-400">
          {decisionNote.title} — {decisionNote.detail}
        </p>
      ) : null}

      {decisionError ? (
        <p className="px-0.5 text-[11px] text-red-300">
          The decision was not recorded: {decisionError}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Which persona is in force for the agent that raised a waiting item.
 *
 * The same resolver the agent card and the conversation use, so a row cannot
 * claim a different persona from the one the agent is speaking as. When the
 * surface cannot see the conversation the item belongs to, it says nothing
 * about the persona rather than guess.
 *
 * The room uses this too, so a row reads the same in both places.
 */
export function personaFor(
  item: WaitingItem,
  agents: Map<string, { name: string; persona?: Persona }>,
  conversations: Map<string, { participants: Participant[] }>,
): { role?: string; source: PersonaSource } | null {
  if (!item.agentConnectionId) return null;
  const base = agents.get(item.agentConnectionId)?.persona;

  if (item.conversationId) {
    const conversation = conversations.get(item.conversationId);
    if (!conversation) return null;
    const participant = conversation.participants.find(
      (entry) => entry.agentConnectionId === item.agentConnectionId,
    );
    const resolved = resolvePersona({ override: participant?.personaOverride, base });
    return { role: resolved.persona?.role, source: resolved.source };
  }

  const resolved = resolvePersona({ base });
  return { role: resolved.persona?.role, source: resolved.source };
}
