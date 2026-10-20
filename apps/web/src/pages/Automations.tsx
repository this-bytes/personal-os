import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Switch } from '@personal-os/ui';
import type { Automation, Resource } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail } from '../lib/types';
import { useWorkspace } from '../state/workspace';
import { EmptyState, ErrorState, LoadingState } from '../components/ErrorState';
import { AutomationForm, type AutomationFormInput } from '../components/AutomationForm';

function triggerSummary(automation: Automation): string {
  const trigger = automation.trigger;
  if (trigger.type === 'schedule') {
    if (trigger.cron) return `schedule · ${trigger.cron}`;
    if (trigger.everyMinutes) return `schedule · every ${trigger.everyMinutes} min`;
    return 'schedule';
  }
  if (trigger.type === 'event') return `event · ${trigger.event ?? '—'}`;
  return 'manual';
}

function actionSummary(automation: Automation, agentNames: Record<string, string>): string {
  const action = automation.action;
  if (action.type === 'agent.prompt') {
    return `prompt ${agentNames[action.agentConnectionId ?? ''] ?? action.agentConnectionId ?? 'agent'}`;
  }
  if (action.type === 'resource.refresh') return `refresh ${action.resourceId ?? 'resource'}`;
  return `${action.method} ${action.url ?? ''}`;
}

export function Automations(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const automations = useQuery<Automation[]>({
    queryKey: ['automations', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{
          automations: Automation[];
        }>('/automations', { workspaceId: activeWorkspaceId ?? undefined })
        .then((r) => r.automations),
    enabled: Boolean(activeWorkspaceId),
  });

  const agents = useQuery<AgentConnectionDetail[]>({
    queryKey: ['agents', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{
          agents: AgentConnectionDetail[];
        }>('/agents', { workspaceId: activeWorkspaceId ?? undefined })
        .then((r) => r.agents),
    enabled: Boolean(activeWorkspaceId),
  });

  const resources = useQuery<Resource[]>({
    queryKey: ['resources', activeWorkspaceId, undefined],
    queryFn: () =>
      api
        .get<{
          resources: Resource[];
        }>('/resources', { workspaceId: activeWorkspaceId ?? undefined })
        .then((r) => r.resources),
    enabled: Boolean(activeWorkspaceId),
  });

  const agentNames: Record<string, string> = {};
  for (const agent of agents.data ?? []) agentNames[agent.id] = agent.name;

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['automations'] });
  };

  const create = useMutation({
    mutationFn: async (input: AutomationFormInput) =>
      api.post<{ automation: Automation }>('/automations', {
        workspaceId: activeWorkspaceId,
        title: input.title,
        trigger: input.trigger,
        action: input.action,
      }),
    onSuccess: async () => {
      setActionError(null);
      setFormOpen(false);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: async (input: AutomationFormInput & { id: string }) =>
      api.patch<{ automation: Automation }>(`/automations/${input.id}`, {
        title: input.title,
        trigger: input.trigger,
        action: input.action,
      }),
    onSuccess: async () => {
      setActionError(null);
      setFormOpen(false);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const toggle = useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) =>
      input.enabled
        ? api.post<{ automation: Automation }>(`/automations/${input.id}/enable`)
        : api.post<{ automation: Automation }>(`/automations/${input.id}/disable`),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/automations/${id}`),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const list = automations.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Automations</h1>
          <p className="text-xs text-slate-500">
            Scheduled and event driven work. An automation stays disabled until you enable it.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New automation
        </Button>
      </header>

      {actionError ? <ErrorState title="The change was not applied" message={actionError} /> : null}

      {automations.isError ? (
        <ErrorState
          title="The automations could not be loaded"
          message={errorMessage(automations.error)}
          onRetry={() => void automations.refetch()}
        />
      ) : null}

      {automations.isLoading ? <LoadingState label="Loading automations…" /> : null}

      {!automations.isLoading && !automations.isError && list.length === 0 ? (
        <EmptyState
          title="No automations"
          message="An automation pairs a trigger with an action. Nothing runs until it is enabled."
        />
      ) : null}

      <div className="space-y-2">
        {list.map((automation) => (
          <Card key={automation.id}>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-100">{automation.title}</span>
                    <Badge variant={automation.enabled ? 'success' : 'outline'}>
                      {automation.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {triggerSummary(automation)} → {actionSummary(automation, agentNames)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {automation.lastRunAt
                      ? `last run ${new Date(automation.lastRunAt).toLocaleString()}`
                      : 'never run'}
                    {automation.nextRunAt
                      ? ` · next ${new Date(automation.nextRunAt).toLocaleString()}`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate({ id: automation.id, enabled: !automation.enabled })
                    }
                  >
                    {automation.enabled ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Disable
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Enable
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Edit ${automation.title}`}
                    onClick={() => {
                      setEditing(automation);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Delete ${automation.title}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete the automation "${automation.title}"?`)) {
                        remove.mutate(automation.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AutomationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        automation={editing}
        agents={agents.data ?? []}
        resources={resources.data ?? []}
        busy={create.isPending || update.isPending}
        error={
          create.isError
            ? errorMessage(create.error)
            : update.isError
              ? errorMessage(update.error)
              : null
        }
        onSubmit={(input) => {
          if (editing) update.mutate({ ...input, id: editing.id });
          else create.mutate(input);
        }}
      />
    </div>
  );
}
