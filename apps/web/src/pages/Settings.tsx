import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, KeyRound, Plus, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@personal-os/ui';
import { api, errorMessage } from '../lib/api';
import type { HealthInfo } from '../lib/types';
import { useAuth } from '../state/auth';
import { useWorkspace } from '../state/workspace';
import { ErrorState } from '../components/ErrorState';
import { Field } from '../components/Field';

export function Settings(): React.JSX.Element {
  const { user } = useAuth();
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, createWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const health = useQuery<HealthInfo>({
    queryKey: ['health'],
    queryFn: () => api.get<HealthInfo>('/health'),
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      const workspace = await createWorkspace({
        name: name.trim(),
        description: description.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      return workspace;
    },
    onSuccess: () => {
      setName('');
      setDescription('');
      setError(null);
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const mcpOrigin = typeof window === 'undefined' ? '' : window.location.origin;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-3 sm:p-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-slate-500">Owner profile, workspaces and the MCP endpoint.</p>
      </header>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle>Owner profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="pos-field-label">Display name</p>
              <p className="text-sm text-slate-200">{user?.displayName ?? '—'}</p>
            </div>
            <div>
              <p className="pos-field-label">Email</p>
              <p className="text-sm text-slate-200">{user?.email ?? '—'}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            This instance has a single owner. The identity is established by the session cookie set
            at sign-in; it is HttpOnly and never readable from scripts.
          </p>
          {health.data ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Badge variant={health.data.ok ? 'success' : 'danger'}>
                {health.data.ok ? 'server healthy' : 'server unhealthy'}
              </Badge>
              <span>version {health.data.version}</span>
            </div>
          ) : null}
          {health.isError ? (
            <ErrorState
              title="The server health check failed"
              message={errorMessage(health.error)}
              onRetry={() => void health.refetch()}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle>Workspaces</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-1">
          {workspaces.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-800 px-3 py-3 text-center text-[11px] text-slate-500">
              No workspaces yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {workspaces.map((workspace) => (
                <li
                  key={workspace.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{workspace.name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {workspace.description || workspace.slug}
                    </p>
                  </div>
                  <Badge variant="outline">{workspace.autonomyMode}</Badge>
                  {workspace.id === activeWorkspaceId ? (
                    <Badge variant="info">active</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveWorkspaceId(workspace.id)}
                    >
                      Make active
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-slate-800 pt-3">
            <p className="pos-field-label">Create a workspace</p>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Field label="Name" htmlFor="workspace-name">
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Research"
                />
              </Field>
              <Field label="Description" htmlFor="workspace-description">
                <Input
                  id="workspace-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What lives in this workspace"
                />
              </Field>
            </div>
            {error ? (
              <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              disabled={create.isPending || name.trim().length === 0}
              onClick={() => create.mutate()}
            >
              <Plus className="h-3.5 w-3.5" />
              {create.isPending ? 'Creating…' : 'Create workspace'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle>MCP endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Globe className="h-4 w-4 text-slate-500" />
            <code className="font-mono text-xs">{`${mcpOrigin}/mcp`}</code>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            The MCP endpoint is served at <code className="font-mono">/mcp</code> on the same origin
            as this panel. In development the Vite server proxies{' '}
            <code className="font-mono">/mcp</code> to the API server.
          </p>
          <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-400">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              How to authenticate
            </p>
            <ul className="space-y-1">
              <li>
                <span className="text-slate-300">As the owner:</span> use the browser session cookie{' '}
                <code className="font-mono">pos_session</code>. A browser request to{' '}
                <code className="font-mono">/mcp</code> on this origin already carries it.
              </li>
              <li>
                <span className="text-slate-300">As an agent:</span> send{' '}
                <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> with a token
                issued from the agent&apos;s <em>Tokens</em> panel. The token is scoped to that one
                connection and is shown only once.
              </li>
              <li>
                <span className="text-slate-300">Headless owner:</span> the server also accepts a
                bearer token when <code className="font-mono">PERSONAL_OS_OWNER_TOKEN</code> is
                configured.
              </li>
            </ul>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Agent tokens are stored as a SHA-256 digest, so the database cannot be replayed. A lost
            token has to be replaced.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
