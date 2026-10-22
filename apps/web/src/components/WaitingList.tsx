import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, CardContent } from '@personal-os/ui';
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
import { PersonaBadge } from './PersonaBadge';

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
  const personaFor = (item: WaitingItem): { role?: string; source: PersonaSource } | null => {
    if (!item.agentConnectionId) return null;
    const base = agentsById.get(item.agentConnectionId)?.persona;

    if (item.conversationId) {
      const conversation = conversationsById.get(item.conversationId);
      if (!conversation) return null;
      const participant = conversation.participants.find(
        (entry) => entry.agentConnectionId === item.agentConnectionId,
      );
      const resolved = resolvePersona({ override: participant?.personaOverride, base });
      return { role: resolved.persona?.role, source: resolved.source };
    }

    const resolved = resolvePersona({ base });
    return { role: resolved.persona?.role, source: resolved.source };
  };

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
                    persona={personaFor(item)}
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

function WaitingRow({
  item,
  agent,
  persona,
  busy,
  onDecide,
  onResolve,
  onWidenGrant,
}: {
  item: WaitingItem;
  agent?: { name: string };
  persona?: { role?: string; source: PersonaSource } | null;
  busy: boolean;
  onDecide: (approvalId: string, approved: boolean) => void;
  onResolve: (executionId: string, outcome: 'completed' | 'failed') => void;
  onWidenGrant: (agentConnectionId: string, toolName: string) => void;
}): React.JSX.Element {
  // The waiting item is keyed across kinds, so the approval's own id and the
  // turn's execution id are both behind the kind.
  const approvalId = item.id.startsWith('approval:') ? item.id.slice('approval:'.length) : null;
  const executionId = item.id.startsWith('turn:') ? item.id.slice('turn:'.length) : null;
  const grant = capabilityGrant(item);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-800 px-3 py-2.5 transition-colors hover:border-slate-700">
      <div className="min-w-0">
        <Link
          to={targetFor(item)}
          className="block truncate text-xs font-medium text-slate-100 hover:text-white hover:underline"
        >
          {item.title}
        </Link>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{item.detail}</p>
        {/*
         * The tool the agent was refused is named by the row itself.
         *
         * The row's title carries it too, but the title is the server's
         * sentence and this is the fact: a tool name is what the owner acts
         * with, and the row has to be able to show it without being read.
         */}
        {item.toolName ? (
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            Tool: <span className="font-mono text-slate-300">{item.toolName}</span>
          </p>
        ) : null}
        {item.agentConnectionId ? (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span className="text-slate-400">{agent?.name ?? item.agentConnectionId}</span>
            {persona ? (
              <>
                <span className="text-slate-700">·</span>
                <PersonaBadge role={persona.role} source={persona.source} />
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {/*
         * Every row of this rail is waiting on the owner, so every row wears
         * the accent — PRODUCT.md 11 says the accent means live or waiting on
         * you, and a row in another colour would say the rail is not waiting
         * on you. The four reasons a row can be here are carried by its
         * label, not by four different colours: a colour that has to mean
         * four things is a colour that stops meaning any of them.
         *
         * "Blocked" is one of them. A blocked item in this rail is an item
         * waiting on the owner, not a failure that happened; failures live in
         * the conversation and in the editor.
         */}
        <Badge variant="accent">{labelFor(item)}</Badge>
        {approvalId ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onDecide(approvalId, true)}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onDecide(approvalId, false)}
            >
              Reject
            </Button>
          </>
        ) : null}
        {executionId ? (
          <>
            {/* The owner's own conclusion about a turn they were told to
                check: it did run, or it did not. Nothing is decided here for
                them — the server only records what they say. */}
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onResolve(executionId, 'completed')}
            >
              It ran
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onResolve(executionId, 'failed')}
            >
              It did not run
            </Button>
          </>
        ) : null}
        {grant ? (
          /* The action the row carries.
           *
           * The owner who sees a blocked capability is told what is blocked
           * and used to be sent elsewhere to find the grant. The row carries
           * the grant's own tool name and the agent it was refused to, so the
           * widening happens here, on the row that asked for it.
           */
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onWidenGrant(grant.agentConnectionId, grant.toolName)}
          >
            Grant the tool
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The grant this row can widen, when the row is one.
 *
 * A capability row names the agent that was refused and the tool it was
 * refused, and those two are the whole of the action. A row that is not a
 * capability has no grant to widen: it is a decision, a task or a turn.
 */
function capabilityGrant(
  item: WaitingItem,
): { agentConnectionId: string; toolName: string } | null {
  if (item.kind !== 'capability') return null;
  if (!item.agentConnectionId || !item.toolName) return null;
  return { agentConnectionId: item.agentConnectionId, toolName: item.toolName };
}

/**
 * Where the owner acts on the item.
 *
 * An approval is a request inside a conversation and a turn happened inside
 * one, so the conversation is where they are read. A task is decided on the
 * factory board, and the link opens the exact card so the decision is one
 * click away. A capability is acted on from the row itself, so its link goes
 * to the agents page where the grant lives.
 */
function targetFor(item: WaitingItem): string {
  if (item.kind === 'task') {
    return item.taskId ? `/factory?task=${item.taskId}` : '/factory';
  }
  return item.conversationId ? `/conversations/${item.conversationId}` : '/agents';
}

/**
 * What the item is, in the owner's words.
 *
 * An unknown outcome is not a failure to fix and not a decision to make. It
 * is something to check, and it is labelled that way so the owner does not
 * read it as a task that failed and may simply be repeated.
 *
 * A capability has a name of its own because it is not one of the other
 * three. It carries the reason `pending`, so a label that went by the reason
 * would call it "Blocked" and send the owner looking for work that is stuck
 * rather than for a grant they can widen. The kind is named before the
 * reason is read, so a capability is never filed under somebody else's
 * name.
 */
function labelFor(item: WaitingItem): string {
  if (item.kind === 'approval') return 'Approval';
  if (item.kind === 'capability') return 'Needs a grant';
  if (item.reason === 'review') return 'In review';
  if (item.reason === 'unknown') return 'Check this';
  return 'Blocked';
}
