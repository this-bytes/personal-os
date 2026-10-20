import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, CardContent } from '@personal-os/ui';
import { resolvePersona, type PersonaSource } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, ConversationDetail, WaitingItem } from '../lib/types';
import { useWorkspace } from '../state/workspace';
import { useServerEvents } from '../state/events';
import { EmptyState, ErrorState, LoadingState } from './ErrorState';
import { PersonaBadge } from './PersonaBadge';

/**
 * How often the list is refreshed even when nothing announced itself.
 *
 * The event stream carries everything the panel changes itself, but an
 * approval can also be decided outside the panel, and that decision
 * publishes no event. The slow refresh is what keeps the list honest in
 * that case.
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
   */
  agents: AgentConnectionDetail[];
  /**
   * The conversations the panel already knows.
   *
   * A conversation may replace the persona of an agent for itself, so the
   * list needs the conversation before it can say which persona is in force.
   */
  conversations: ConversationDetail[];
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
  // state, and an agent that asked for an approval.
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'task.updated') {
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
   */
  const decide = useMutation({
    mutationFn: async (input: { approvalId: string; approved: boolean }) =>
      api.post(`/approvals/${input.approvalId}/decide`, {
        approved: input.approved,
        reason: input.approved
          ? 'Approved from the waiting list.'
          : 'Rejected from the waiting list.',
      }),
    onSuccess: async () => {
      setDecisionError(null);
      // The item has stopped waiting, so the list says so without the owner
      // reloading the page.
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => setDecisionError(errorMessage(error)),
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
                    busy={decide.isPending}
                    onDecide={(approvalId, approved) => decide.mutate({ approvalId, approved })}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
}: {
  item: WaitingItem;
  agent?: AgentConnectionDetail;
  persona?: { role?: string; source: PersonaSource } | null;
  busy: boolean;
  onDecide: (approvalId: string, approved: boolean) => void;
}): React.JSX.Element {
  // The waiting item is keyed across kinds, so the approval's own id is
  // behind the kind.
  const approvalId = item.id.startsWith('approval:') ? item.id.slice('approval:'.length) : null;

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
        <Badge variant={variantFor(item)}>{labelFor(item)}</Badge>
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
      </div>
    </div>
  );
}

/**
 * Where the owner acts on the item.
 *
 * An approval is a request inside a conversation, so the conversation is
 * where the request is read. A task is decided on the factory board, and
 * the link opens the exact card so the decision is one click away.
 */
function targetFor(item: WaitingItem): string {
  if (item.kind === 'approval') {
    return item.conversationId ? `/conversations/${item.conversationId}` : '/agents';
  }
  return item.taskId ? `/factory?task=${item.taskId}` : '/factory';
}

/**
 * What the item is, in the owner's words.
 *
 * An unknown outcome is not a failure to fix and not a decision to make. It
 * is something to check, and it is labelled that way so the owner does not
 * read it as a task that failed and may simply be repeated.
 */
function labelFor(item: WaitingItem): string {
  if (item.kind === 'approval') return 'Approval';
  if (item.reason === 'review') return 'In review';
  if (item.reason === 'unknown') return 'Check this';
  return 'Blocked';
}

function variantFor(item: WaitingItem): 'warning' | 'info' | 'danger' {
  if (item.kind === 'approval') return 'warning';
  if (item.reason === 'review') return 'info';
  if (item.reason === 'unknown') return 'warning';
  return 'danger';
}
