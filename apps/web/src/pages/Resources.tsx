import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@personal-os/ui';
import type { Resource, ResourceType } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import { useWorkspace } from '../state/workspace';
import { EmptyState, ErrorState, LoadingState } from '../components/ErrorState';
import { ResourceEditor } from '../components/ResourceEditor';
import { ResourceList } from '../components/ResourceList';

const FILTERS: Array<{ value: ResourceType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'dashboard', label: 'Dashboards' },
  { value: 'document', label: 'Documents' },
  { value: 'data-source', label: 'Data sources' },
  { value: 'memory', label: 'Memory' },
  { value: 'automation', label: 'Automations' },
  { value: 'task', label: 'Tasks' },
];

export function Resources(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ResourceType | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);

  const resources = useQuery<Resource[]>({
    queryKey: ['resources', activeWorkspaceId, filter === 'all' ? undefined : filter],
    queryFn: () =>
      api
        .get<{ resources: Resource[] }>('/resources', {
          workspaceId: activeWorkspaceId ?? undefined,
          ...(filter === 'all' ? {} : { type: filter }),
        })
        .then((r) => r.resources),
    enabled: Boolean(activeWorkspaceId),
  });

  const list = resources.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Resources</h1>
          <p className="text-xs text-slate-500">
            Dashboards, documents, data sources and memory — shared by humans and agents.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New resource
        </Button>
      </header>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              filter === item.value
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                : 'border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {resources.isError ? (
        <ErrorState
          title="The resources could not be loaded"
          message={errorMessage(resources.error)}
          onRetry={() => void resources.refetch()}
        />
      ) : null}

      {resources.isLoading ? <LoadingState label="Loading resources…" /> : null}

      {!resources.isLoading && !resources.isError && list.length === 0 ? (
        <EmptyState
          title="No resources here"
          message="Create a document, a dashboard, a data source or a memory entry. Agents read and write the same resources."
        />
      ) : null}

      {list.length > 0 ? (
        <ResourceList
          resources={list}
          onOpen={(resource) => {
            setEditing(resource);
            setEditorOpen(true);
          }}
        />
      ) : null}

      <ResourceEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        workspaceId={activeWorkspaceId}
        resource={editing}
        onChanged={async () => {
          await queryClient.invalidateQueries({ queryKey: ['resources'] });
        }}
      />
    </div>
  );
}
