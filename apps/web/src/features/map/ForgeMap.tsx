import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AuroraField,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Constellation,
  CounterBand,
} from '@personal-os/ui';
import type { ForgeMap as ForgeMapPayload } from '@personal-os/contracts';
import { api, errorMessage } from '../../lib/api';
import { useWorkspace } from '../../state/workspace';
import { useServerEvents } from '../../state/events';
import { ErrorState, LoadingState } from '../../components/ErrorState';
import { WaitingList } from '../../components/WaitingList';
import { LABEL_LIMIT, buildPicture } from './constellation';

/**
 * The Map.
 *
 * The orientation room. It is a picture of the system, so it holds the things
 * that are a picture — the agents, the threads between them, the pulse — and
 * the one thing that is not: the rail, because a decision is taken where the
 * list is.
 *
 * Everything on it comes from one request. The server owns the read model;
 * the browser is not asked to join five answers into one picture.
 */
export function ForgeMap(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { subscribe } = useServerEvents();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const map = useQuery<ForgeMapPayload>({
    queryKey: ['forge-map', activeWorkspaceId],
    queryFn: () =>
      api.get<ForgeMapPayload>('/features/map', { workspaceId: activeWorkspaceId ?? undefined }),
    enabled: Boolean(activeWorkspaceId),
  });

  // The picture follows the event stream: an agent that connects, a task that
  // moves and a resource that is built all change it.
  useEffect(() => {
    return subscribe((event) => {
      if (
        event.type === 'agent.status' ||
        event.type === 'task.updated' ||
        event.type === 'resource.updated' ||
        event.type === 'approval.decided'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['forge-map'] });
      }
    });
  }, [subscribe, queryClient]);

  const agents = map.data?.agents ?? [];
  const threads = map.data?.threads ?? [];

  const picture = useMemo(
    () =>
      buildPicture(
        (map.data?.agents ?? []).map((agent) => ({
          id: agent.id,
          name: agent.name,
          activity: agent.activity,
        })),
        (map.data?.threads ?? []).map((thread) => ({
          id: thread.id,
          title: thread.title,
          agentIds: thread.agentIds,
          activity: thread.activity,
        })),
      ),
    [map.data],
  );

  const selected = agents.find((agent) => agent.id === selectedAgentId) ?? null;

  return (
    <div className="relative isolate min-h-full">
      <AuroraField />

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Map</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Who is here, what they are working on, and what is waiting on you.
          </p>
        </header>

        {map.isError ? (
          <ErrorState
            title="The map could not be loaded"
            message={errorMessage(map.error)}
            onRetry={() => void map.refetch()}
          />
        ) : null}

        {map.isLoading ? <LoadingState label="Drawing the map…" /> : null}

        {map.data ? (
          <>
            <CounterBand counters={map.data.counters} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <Card className="bg-slate-950/40">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs uppercase tracking-wide text-slate-400">
                    The system
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-[22rem] w-full">
                    <Constellation
                      nodes={picture.nodes}
                      edges={picture.edges}
                      coreLabel="You"
                      labelled={agents.length <= LABEL_LIMIT}
                      onSelect={setSelectedAgentId}
                    />
                  </div>

                  <p className="text-[11px] leading-snug text-slate-500">
                    {agents.length} agents
                    {picture.unlabelledAgents > 0
                      ? `, ${picture.unlabelledAgents} of them not named`
                      : ''}
                    . {threads.length} threads
                    {picture.hiddenThreads > 0
                      ? `, ${picture.hiddenThreads} of them not drawn`
                      : ''}
                    .
                  </p>

                  {selected ? (
                    <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-sm font-medium text-slate-100">{selected.name}</p>
                      {selected.role ? (
                        <p className="mt-0.5 text-xs text-slate-400">{selected.role}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-slate-500">
                        {selected.status}
                        {selected.enabled ? '' : ' · turned off'}
                        {selected.activity > 0 ? ` · ${selected.activity} moves in the window` : ''}
                      </p>
                      <Link
                        to="/agents"
                        className="mt-2 inline-block text-xs text-indigo-300 underline-offset-4 hover:underline"
                      >
                        Open the agent
                      </Link>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <aside className="space-y-4">
                <WaitingList
                  agents={agents.map((agent) => ({
                    id: agent.id,
                    name: agent.name,
                    persona: agent.role ? { role: agent.role } : undefined,
                  }))}
                  conversations={[]}
                />
              </aside>
            </div>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                What has been built
              </h2>
              {map.data.tiles.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing has been built yet.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {map.data.tiles.map((tile) => (
                    <li
                      key={tile.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
                    >
                      <p className="truncate text-sm text-slate-100">{tile.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {tile.type} · revision {tile.revision}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pulse
              </h2>
              {map.data.pulse.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing has happened yet.</p>
              ) : (
                <ul className="space-y-1">
                  {map.data.pulse.map((entry) => (
                    <li key={entry.seq} className="flex items-baseline gap-2 text-xs">
                      <span className="text-slate-500">{entry.at.slice(11, 19)}</span>
                      <span className="text-slate-300">{entry.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
