import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Card, CardContent } from '@personal-os/ui';
import { api, errorMessage } from '../lib/api';
import type { WaitingItem } from '../lib/types';
import { useWorkspace } from '../state/workspace';
import { useServerEvents } from '../state/events';
import { EmptyState, ErrorState, LoadingState } from './ErrorState';

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

/**
 * What is waiting on the owner.
 *
 * One list, in one request: a pending approval, a task waiting for an
 * acceptance decision and a blocked task are the same question asked in
 * three places, and the owner should not have to go and look for them.
 */
export function WaitingList(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { subscribe } = useServerEvents();

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

  const items = waiting.data ?? [];

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
                  <WaitingRow item={item} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function WaitingRow({ item }: { item: WaitingItem }): React.JSX.Element {
  return (
    <Link
      to={targetFor(item)}
      className="flex items-start justify-between gap-3 rounded-md border border-slate-800 px-3 py-2.5 transition-colors hover:border-slate-700 hover:bg-slate-900/60"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-100">{item.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{item.detail}</p>
      </div>
      <Badge variant={variantFor(item)}>{labelFor(item)}</Badge>
    </Link>
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

/** What the item is, in the owner's words. */
function labelFor(item: WaitingItem): string {
  if (item.kind === 'approval') return 'Approval';
  return item.reason === 'review' ? 'In review' : 'Blocked';
}

function variantFor(item: WaitingItem): 'warning' | 'info' | 'danger' {
  if (item.kind === 'approval') return 'warning';
  return item.reason === 'review' ? 'info' : 'danger';
}
