import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Play, RefreshCw, Save, Send } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  Textarea,
} from '@personal-os/ui';
import {
  canExecuteResource,
  canPublishResource,
  resourceTypeNames,
  type Resource,
  type ResourceType,
} from '@personal-os/contracts';
import { api, ApiError, errorMessage } from '../lib/api';
import type { ResourceInspection } from '../lib/types';
import { Field } from './Field';

const CREATABLE_TYPES: ResourceType[] = ['dashboard', 'document', 'data-source', 'memory'];

/** What an operation on a resource reported, in the words the owner reads. */
interface OperationOutcome {
  /** The word the owner reads first. */
  readonly headline: string;
  /** The sentence that says what happened. */
  readonly detail: string;
  /** The label above the output, when the operation produced one. */
  readonly outputLabel?: string;
}

/**
 * What a kind of resource cannot do, in the words the contract uses.
 *
 * The panel offers only the actions that can succeed. It says which ones are
 * missing rather than leaving a gap the owner has to guess at, because a
 * button that is not there and a button that always fails are different
 * mistakes.
 */
function unsupportedNote(type: ResourceType): string | null {
  const publish = canPublishResource(type);
  const execute = canExecuteResource(type);
  if (publish && execute) return null;
  const name = resourceTypeNames[type];
  if (!publish && !execute) return `A ${name} cannot be published or executed.`;
  return publish ? `A ${name} cannot be executed.` : `A ${name} cannot be published.`;
}

/**
 * The sentence the panel shows when the server refused an operation.
 *
 * A refusal is an answer: the server was asked and said no, and said why. It
 * is shown as an answer. A failure that is not an answer — the network is
 * down, the server faulted — is shown as a failure instead, because calling it
 * a refusal would be the same kind of lie this panel is being fixed for.
 */
function refusalMessage(cause: unknown): string {
  if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
    return `The server refused: ${cause.message}`;
  }
  return errorMessage(cause);
}

interface ResourceEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
  /** Present when editing an existing resource. */
  resource?: Resource | null;
  onChanged: () => Promise<void> | void;
}

/** A sensible starting payload for each resource type. */
function defaultData(type: ResourceType): Record<string, unknown> {
  switch (type) {
    case 'dashboard':
      return { widgets: [], refreshSeconds: 60, published: false };
    case 'document':
      return { format: 'markdown', content: '', tags: [] };
    case 'data-source':
      return { kind: 'json', payload: null, headers: {} };
    case 'memory':
      return { scope: 'workspace', key: 'note', value: '', tags: [] };
    default:
      return {};
  }
}

/**
 * Create or edit a resource.
 *
 * Updates carry the revision the editor was opened with. When the server
 * reports a newer revision the editor says so and offers a reload instead
 * of overwriting the change.
 */
export function ResourceEditor({
  open,
  onOpenChange,
  workspaceId,
  resource,
  onChanged,
}: ResourceEditorProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const isEdit = Boolean(resource);

  const [type, setType] = useState<ResourceType>('document');
  const [title, setTitle] = useState('');
  const [dataText, setDataText] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [inspection, setInspection] = useState<ResourceInspection | null>(null);
  const [executionOutput, setExecutionOutput] = useState<unknown>(null);
  const [outcome, setOutcome] = useState<OperationOutcome | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConflict(null);
    setInspection(null);
    setExecutionOutput(null);
    setOutcome(null);
    if (resource) {
      setType(resource.type);
      setTitle(resource.title);
      setDataText(JSON.stringify(resource.data ?? {}, null, 2));
    } else {
      setType('document');
      setTitle('');
      setDataText(JSON.stringify(defaultData('document'), null, 2));
    }
  }, [open, resource]);

  const create = useMutation({
    mutationFn: async () => {
      const data = JSON.parse(dataText) as unknown;
      return api.post<{ resource: Resource }>('/resources', {
        workspaceId,
        type,
        title: title.trim(),
        data,
      });
    },
    onSuccess: async () => {
      setError(null);
      await onChanged();
      onOpenChange(false);
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const update = useMutation({
    mutationFn: async (current: Resource) => {
      const data = JSON.parse(dataText) as unknown;
      return api.patch<{ resource: Resource }>(`/resources/${current.id}`, {
        expectedRevision: current.revision,
        title: title.trim(),
        data,
      });
    },
    onSuccess: async () => {
      setError(null);
      setConflict(null);
      await onChanged();
      onOpenChange(false);
    },
    onError: (cause) => {
      if (cause instanceof ApiError && cause.isRevisionConflict) {
        setConflict(
          'This resource changed since you opened it. Reload to see the current version before saving again.',
        );
        return;
      }
      setError(errorMessage(cause));
    },
  });

  /**
   * Publish the resource.
   *
   * The panel believes the server: it renders the outcome the response
   * claimed, and a refusal — which the server answers with an error, not a
   * 200 — is shown as a refusal rather than swallowed into a success.
   */
  const publish = useMutation({
    mutationFn: async (current: Resource) =>
      api.post<{ outcome: 'published'; resource: Resource }>(`/resources/${current.id}/publish`),
    onSuccess: async (answer, current) => {
      if (answer.outcome !== 'published') {
        setOutcome(null);
        setError('The server did not publish this resource.');
        return;
      }
      setError(null);
      setOutcome({
        headline: 'Published.',
        detail: `The ${resourceTypeNames[current.type]} is live.`,
      });
      await onChanged();
    },
    onError: (cause) => {
      setOutcome(null);
      setError(refusalMessage(cause));
    },
  });

  /**
   * Execute the resource.
   *
   * A run that was accepted but has not finished is reported as queued, not as
   * a run that happened. The panel does not say it ran unless the server said
   * it ran.
   */
  const execute = useMutation({
    mutationFn: async (current: Resource) =>
      api.post<{ outcome: 'queued' | 'succeeded'; result: { output: unknown } }>(
        `/resources/${current.id}/execute`,
      ),
    onSuccess: (answer, current) => {
      setError(null);
      setExecutionOutput(answer.result.output);
      if (answer.outcome === 'queued') {
        setOutcome({
          headline: 'Queued.',
          detail: 'The run was accepted and has not finished. It has not run yet.',
          outputLabel: 'Queued run',
        });
        return;
      }
      if (answer.outcome === 'succeeded') {
        setOutcome({
          headline: 'It ran.',
          detail: `The ${resourceTypeNames[current.type]} ran and produced the output below.`,
          outputLabel: 'Execution output',
        });
        return;
      }
      setOutcome(null);
      setError('The server did not run this resource.');
    },
    onError: (cause) => {
      setOutcome(null);
      setExecutionOutput(null);
      setError(refusalMessage(cause));
    },
  });

  const inspect = useMutation({
    mutationFn: async (current: Resource) =>
      api.get<ResourceInspection>(`/resources/${current.id}/inspect`),
    onSuccess: (result) => {
      setError(null);
      setInspection(result);
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const reload = async (): Promise<void> => {
    if (!resource) return;
    try {
      const fresh = await api.get<{ resource: Resource }>(`/resources/${resource.id}`);
      await queryClient.invalidateQueries({ queryKey: ['resources'] });
      await queryClient.invalidateQueries({ queryKey: ['resource', resource.id] });
      setType(fresh.resource.type);
      setTitle(fresh.resource.title);
      setDataText(JSON.stringify(fresh.resource.data ?? {}, null, 2));
      setConflict(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const handleSave = (): void => {
    setError(null);
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    try {
      JSON.parse(dataText);
    } catch {
      setError('The data must be valid JSON.');
      return;
    }
    if (resource) update.mutate(resource);
    else create.mutate();
  };

  const busy = create.isPending || update.isPending;

  /**
   * The kind being edited.
   *
   * The actions are offered for the kind on screen, and the contract says
   * which kinds have them, so the panel never offers a button that can only
   * be refused.
   */
  const editedType = resource?.type ?? type;
  const unsupported = unsupportedNote(editedType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${resource?.title}` : 'New resource'}</DialogTitle>
          <DialogDescription>
            Resources are shared between humans, agents and automations. Every write carries the
            revision it was read at.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isEdit ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <Badge variant="outline">{resource?.type}</Badge>
              <span>revision {resource?.revision}</span>
              <span>updated {resource ? new Date(resource.updatedAt).toLocaleString() : ''}</span>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="resource-title">
              <Input
                id="resource-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Research dashboard"
              />
            </Field>

            {!isEdit ? (
              <Field label="Type" htmlFor="resource-type">
                <Select
                  id="resource-type"
                  value={type}
                  onChange={(event) => {
                    const next = event.target.value as ResourceType;
                    setType(next);
                    setDataText(JSON.stringify(defaultData(next), null, 2));
                  }}
                >
                  {CREATABLE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          <Field
            label="Data (JSON)"
            htmlFor="resource-data"
            hint="The stored payload. The server validates it against the schema of the resource type."
          >
            <Textarea
              id="resource-data"
              className="min-h-[180px] font-mono text-xs"
              value={dataText}
              onChange={(event) => setDataText(event.target.value)}
            />
          </Field>

          {conflict ? (
            <div className="rounded-md border border-err/40 bg-err/10 p-3">
              <p className="flex items-start gap-2 text-[11px] text-err">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {conflict}
              </p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => void reload()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reload the current version
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          {inspection ? (
            <div
              className={`rounded-md border px-3 py-2 text-[11px] ${
                inspection.valid
                  ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200'
                  : 'border-red-900/60 bg-red-950/30 text-red-200'
              }`}
            >
              <p className="font-medium">
                {inspection.valid ? 'The resource is valid.' : 'The resource has issues.'}
              </p>
              {inspection.issues.map((issue, index) => (
                <p key={`${issue}-${index}`} className="mt-0.5 opacity-90">
                  {issue}
                </p>
              ))}
            </div>
          ) : null}

          {outcome ? (
            <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
              <p className="text-[11px] font-medium text-slate-200">{outcome.headline}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{outcome.detail}</p>
            </div>
          ) : null}

          {executionOutput !== null ? (
            <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
              <p className="mb-1 text-[11px] font-medium text-slate-400">
                {outcome?.outputLabel ?? 'Execution output'}
              </p>
              <pre className="pos-json max-h-40">{JSON.stringify(executionOutput, null, 2)}</pre>
            </div>
          ) : null}

          {isEdit && unsupported ? (
            <p className="text-[11px] text-slate-500">{unsupported}</p>
          ) : null}
        </div>

        <DialogFooter className="flex-wrap">
          {isEdit ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={inspect.isPending}
                onClick={() => resource && inspect.mutate(resource)}
              >
                Inspect
              </Button>
              {canExecuteResource(editedType) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={execute.isPending}
                  onClick={() => resource && execute.mutate(resource)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Execute
                </Button>
              ) : null}
              {canPublishResource(editedType) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={publish.isPending}
                  onClick={() => resource && publish.mutate(resource)}
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish
                </Button>
              ) : null}
            </>
          ) : null}

          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={handleSave}>
            <Save className="h-4 w-4" />
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create resource'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
