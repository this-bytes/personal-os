import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Clock, Loader, X } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CounterBand,
  Select,
} from '@personal-os/ui';
import { api, errorMessage } from '../../lib/api';
import {
  handoffState,
  type HandoffState,
  type RoomSummary,
  type TeamRoomPayload,
} from '../../lib/bots';
import { useWorkspace } from '../../state/workspace';
import { useServerEvents } from '../../state/events';
import { EmptyState, ErrorState, LoadingState } from '../../components/ErrorState';
import { hueFor } from '../map/constellation';

/**
 * The team room.
 *
 * It answers three questions: who is in this room, what has each of them been
 * asked to do, and where did the answer go. A handoff is shown as what it
 * was — who handed what to whom, what came back, and whether the room that
 * asked has used it yet.
 *
 * The colour rules hold here. The accent is worn by work that is live and by
 * nothing else. The error colour is worn by work that failed and by nothing
 * else. A result that is waiting to be used is a notice, so it is neutral and
 * it carries an icon.
 */

/** What a role reads as. A role is a name, never a colour. */
const ROLE_LABELS: Record<string, string> = {
  coordinator: 'Coordinator',
  worker: 'Worker',
  reviewer: 'Reviewer',
};

/** The badge a state wears, and the icon that goes with it. */
function StateBadge({ state }: { state: HandoffState }): React.JSX.Element {
  if (state === 'live') {
    return (
      <Badge variant="accent">
        <Loader className="h-3 w-3" aria-hidden="true" />
        Working
      </Badge>
    );
  }
  if (state === 'waiting') {
    return (
      <Badge variant="warning">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Delivered, not used
      </Badge>
    );
  }
  if (state === 'done') {
    return (
      <Badge variant="success">
        <Check className="h-3 w-3" aria-hidden="true" />
        Used
      </Badge>
    );
  }
  if (state === 'failed') {
    return (
      <Badge variant="danger">
        <X className="h-3 w-3" aria-hidden="true" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <CircleAlert className="h-3 w-3" aria-hidden="true" />
      Outcome unknown
    </Badge>
  );
}

export function TeamRoom(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { subscribe } = useServerEvents();
  const [chosenRoom, setChosenRoom] = useState<string | null>(null);

  const rooms = useQuery<RoomSummary[]>({
    queryKey: ['bots-rooms', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{ conversations: RoomSummary[] }>('/conversations', {
          workspaceId: activeWorkspaceId ?? undefined,
        })
        .then((response) => response.conversations),
    enabled: Boolean(activeWorkspaceId),
  });

  const roomId = chosenRoom ?? rooms.data?.[0]?.id ?? null;

  const team = useQuery<TeamRoomPayload>({
    queryKey: ['bots-team', roomId],
    queryFn: () =>
      api.get<TeamRoomPayload>('/features/bots/team', { conversationId: roomId ?? undefined }),
    enabled: Boolean(roomId),
  });

  // The picture follows the event stream: a handoff that starts, a result
  // that arrives and a result that is used all change what is on screen.
  useEffect(() => {
    return subscribe((event) => {
      if (
        event.type === 'delegation.started' ||
        event.type === 'delegation.delivered' ||
        event.type === 'delegation.consumed'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['bots-team'] });
      }
    });
  }, [subscribe, queryClient]);

  const bots = team.data?.bots ?? [];
  const delegations = team.data?.delegatedTasks ?? [];

  const working = useMemo(() => {
    const ids = new Set<string>();
    for (const delegation of delegations) {
      if (handoffState(delegation) === 'live') ids.add(delegation.agentConnectionId);
    }
    return ids;
  }, [delegations]);

  const counters = useMemo(
    () => [
      { key: 'team', label: 'In the team', value: bots.length },
      {
        key: 'working',
        label: 'At work',
        value: working.size,
        tone: working.size > 0 ? ('live' as const) : ('plain' as const),
      },
      {
        key: 'waiting',
        label: 'Not used yet',
        value: delegations.filter((delegation) => handoffState(delegation) === 'waiting').length,
      },
      {
        key: 'done',
        label: 'Results used',
        value: delegations.filter((delegation) => handoffState(delegation) === 'done').length,
      },
    ],
    [bots.length, delegations, working.size],
  );

  const nameOf = (agentConnectionId: string): string =>
    bots.find((bot) => bot.agentConnectionId === agentConnectionId)?.displayName ??
    agentConnectionId;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Bots</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          The team of a room: who is in it, what each one may hand over, and the work that is in
          flight.
        </p>
      </header>

      {team.isError ? (
        <ErrorState
          title="The team could not be loaded"
          message={errorMessage(team.error)}
          onRetry={() => void team.refetch()}
        />
      ) : null}

      {rooms.data && rooms.data.length > 0 ? (
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <span className="uppercase tracking-wide">Room</span>
          <Select
            className="max-w-xs"
            value={roomId ?? ''}
            onChange={(event) => setChosenRoom(event.target.value)}
          >
            {rooms.data.map((room) => (
              <option key={room.id} value={room.id}>
                {room.title}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      {team.isLoading ? <LoadingState label="Reading the room…" /> : null}

      {team.data ? (
        <>
          <CounterBand counters={counters} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card className="bg-slate-950/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-slate-400">
                  The team
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bots.length === 0 ? (
                  <EmptyState
                    title="No bots in this room yet"
                    message="Register the agents of the room to give them a role and a scope."
                  />
                ) : (
                  bots.map((bot) => (
                    <div
                      key={bot.id}
                      className="flex items-start gap-2 border-b border-slate-800/70 pb-2 last:border-b-0 last:pb-0"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: `hsl(${hueFor(bot.agentConnectionId)} 68% 58%)`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-100">{bot.displayName}</span>
                          <Badge variant="outline">{ROLE_LABELS[bot.role] ?? bot.role}</Badge>
                          {working.has(bot.agentConnectionId) ? (
                            <Badge variant="accent">
                              <Loader className="h-3 w-3" aria-hidden="true" />
                              Working
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {bot.scope.mayDispatch
                            ? `May hand work to ${bot.scope.dispatchableAgentConnectionIds.length} agents`
                            : 'Does not hand work over'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-950/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-slate-400">
                  The handoffs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {delegations.length === 0 ? (
                  <EmptyState
                    title="Nothing has been handed over yet"
                    message="When a coordinator hands work to another agent, it shows up here."
                  />
                ) : (
                  delegations.map((delegation) => (
                    <div
                      key={delegation.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-slate-100">
                          {nameOf(delegation.parentAgentConnectionId)}
                          <span className="mx-1 text-slate-500" aria-hidden="true">
                            →
                          </span>
                          {nameOf(delegation.agentConnectionId)}
                        </p>
                        <StateBadge state={handoffState(delegation)} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{delegation.instruction}</p>
                      {delegation.result ? (
                        <p className="mt-1 border-l-2 border-slate-700 pl-2 text-xs text-slate-300">
                          {delegation.result}
                        </p>
                      ) : null}
                      {delegation.taskId ? (
                        <p className="mt-1 font-mono text-[11px] text-slate-500">
                          Task {delegation.taskId}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
