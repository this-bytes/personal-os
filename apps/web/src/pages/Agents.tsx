import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Switch } from '@personal-os/ui';
import type { AgentCapabilities, AdapterType } from '@personal-os/contracts';
import { adapterTypeLabels } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, SecretSummary } from '../lib/types';
import { useWorkspace } from '../state/workspace';
import { EmptyState, ErrorState, LoadingState } from '../components/ErrorState';
import { StatusBadge } from '../components/StatusBadge';
import { AgentConnectionForm, type AgentFormInput } from '../components/AgentConnectionForm';
import { AgentTokenPanel } from '../components/AgentTokenPanel';
import { ToolGrantPanel } from '../components/ToolGrantPanel';

const CAPABILITY_LABELS: Array<{ key: keyof AgentCapabilities; label: string }> = [
  { key: 'chat', label: 'chat' },
  { key: 'streaming', label: 'streaming' },
  { key: 'persistentSessions', label: 'sessions' },
  { key: 'backgroundTasks', label: 'tasks' },
  { key: 'cancel', label: 'cancel' },
  { key: 'approvals', label: 'approvals' },
  { key: 'artifacts', label: 'artifacts' },
];

export function Agents(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgentConnectionDetail | null>(null);
  const [tokenAgent, setTokenAgent] = useState<AgentConnectionDetail | null>(null);
  const [grantAgent, setGrantAgent] = useState<AgentConnectionDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const secrets = useQuery<SecretSummary[]>({
    queryKey: ['secrets', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{
          secrets: SecretSummary[];
        }>('/secrets', { workspaceId: activeWorkspaceId ?? undefined })
        .then((r) => r.secrets),
    enabled: Boolean(activeWorkspaceId),
  });

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['agents'] });
    await queryClient.invalidateQueries({ queryKey: ['secrets'] });
  };

  const create = useMutation({
    mutationFn: async (input: AgentFormInput) =>
      api.post<{ agent: AgentConnectionDetail }>('/agents', {
        workspaceId: activeWorkspaceId,
        name: input.name,
        adapterType: input.adapterType,
        config: input.config ?? {},
        ...(input.secrets ? { secrets: input.secrets } : {}),
      }),
    onSuccess: async () => {
      setActionError(null);
      setFormOpen(false);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: async (input: AgentFormInput & { id: string }) =>
      api.patch<{ agent: AgentConnectionDetail }>(`/agents/${input.id}`, {
        name: input.name,
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.config === null ? {} : { config: input.config }),
        ...(input.secrets ? { secrets: input.secrets } : {}),
      }),
    onSuccess: async () => {
      setActionError(null);
      setFormOpen(false);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const probe = useMutation({
    mutationFn: async (id: string) =>
      api.post<{ agent: AgentConnectionDetail }>(`/agents/${id}/probe`),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const setEnabled = useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) =>
      api.patch<{ agent: AgentConnectionDetail }>(`/agents/${input.id}`, {
        enabled: input.enabled,
      }),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/agents/${id}`),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const list = agents.data ?? [];

  const handleSubmit = (input: AgentFormInput): void => {
    if (editing) update.mutate({ ...input, id: editing.id });
    else create.mutate(input);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Agents</h1>
          <p className="text-xs text-slate-500">
            Connections to external agents. Credentials are stored server-side and never returned.
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
          Add connection
        </Button>
      </header>

      {actionError ? <ErrorState title="The change was not applied" message={actionError} /> : null}

      {agents.isError ? (
        <ErrorState
          title="The agent connections could not be loaded"
          message={errorMessage(agents.error)}
          onRetry={() => void agents.refetch()}
        />
      ) : null}

      {agents.isLoading ? <LoadingState label="Loading agent connections…" /> : null}

      {!agents.isLoading && !agents.isError && list.length === 0 ? (
        <EmptyState
          title="No agent connections"
          message="Add a connection to give conversations something to talk to. The built-in echo adapter is the quickest way to try the panel."
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((agent) => (
          <Card key={agent.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {agent.name}
                    </span>
                    <StatusBadge status={agent.status} />
                    {!agent.enabled ? <Badge variant="warning">disabled</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {adapterTypeLabels[agent.adapterType as AdapterType] ?? agent.adapterType}
                  </p>
                </div>
                <Switch
                  checked={agent.enabled}
                  aria-label={`Enable ${agent.name}`}
                  onCheckedChange={(enabled) => setEnabled.mutate({ id: agent.id, enabled })}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1">
                {agent.capabilities ? (
                  CAPABILITY_LABELS.filter(
                    (capability) => agent.capabilities?.[capability.key],
                  ).map((capability) => (
                    <Badge key={capability.key} variant="info">
                      {capability.label}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">capabilities unknown</Badge>
                )}
              </div>

              {agent.lastError ? (
                <p className="mt-2 rounded border border-red-900/60 bg-red-950/30 px-2 py-1.5 text-[11px] text-red-300">
                  {agent.lastError}
                </p>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={probe.isPending}
                  onClick={() => probe.mutate(agent.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Probe
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(agent);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setTokenAgent(agent)}>
                  <KeyRound className="h-3.5 w-3.5" />
                  Tokens
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setGrantAgent(agent)}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Tools
                  <span className="text-[10px] text-slate-500">{agent.toolGrants.length}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-8 w-8"
                  aria-label={`Remove ${agent.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove the connection "${agent.name}"?`)) {
                      remove.mutate(agent.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(secrets.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-3">
            <p className="pos-field-label">Stored credentials</p>
            <div className="flex flex-wrap gap-1.5">
              {(secrets.data ?? []).map((secret) => (
                <Badge key={secret.id} variant="outline" title={`Created ${secret.createdAt}`}>
                  {secret.name}
                </Badge>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-600">
              Only metadata is shown. The values are encrypted at rest and are never sent to the
              browser.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <AgentConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        agent={editing}
        busy={create.isPending || update.isPending}
        error={
          create.isError
            ? errorMessage(create.error)
            : update.isError
              ? errorMessage(update.error)
              : null
        }
        onSubmit={handleSubmit}
      />

      <AgentTokenPanel
        open={tokenAgent !== null}
        onOpenChange={(open) => {
          if (!open) setTokenAgent(null);
        }}
        agent={tokenAgent}
      />

      <ToolGrantPanel
        open={grantAgent !== null}
        onOpenChange={(open) => {
          if (!open) setGrantAgent(null);
        }}
        agent={grantAgent}
      />
    </div>
  );
}
