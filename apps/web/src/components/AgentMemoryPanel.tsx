import { useQuery } from '@tanstack/react-query';
import { Brain } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@personal-os/ui';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, AgentMemoryResponse } from '../lib/types';
import { ErrorState, LoadingState } from './ErrorState';

interface AgentMemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentConnectionDetail | null;
}

/** How a memory value reads in the panel. */
function readableValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  const json = JSON.stringify(value);
  return json === undefined ? '' : json;
}

/**
 * What one agent remembers.
 *
 * The memory belongs to the connection, not to a conversation and not to a
 * persona: the same agent carries it into every conversation it takes part
 * in, and no other agent sees it. The brief at the head of the turn is
 * budgeted, so the panel says which memories fit and which did not.
 */
export function AgentMemoryPanel({
  open,
  onOpenChange,
  agent,
}: AgentMemoryPanelProps): React.JSX.Element {
  const agentId = agent?.id ?? '';

  const memories = useQuery<AgentMemoryResponse>({
    queryKey: ['agent-memories', agentId],
    queryFn: () => api.get<AgentMemoryResponse>(`/agents/${agentId}/memories`),
    enabled: open && agentId.length > 0,
  });

  const data = memories.data;
  const list = data?.memories ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Memory · {agent?.name}</DialogTitle>
          <DialogDescription>
            What this agent remembers. The memory belongs to the connection, so it follows the agent
            into every conversation and no other agent reads it. Write a memory with scope
            &ldquo;agent&rdquo; and this connection&rsquo;s id in Resources.
          </DialogDescription>
        </DialogHeader>

        {memories.isError ? (
          <ErrorState
            title="The memory could not be loaded"
            message={errorMessage(memories.error)}
            onRetry={() => void memories.refetch()}
          />
        ) : null}

        {memories.isLoading ? <LoadingState label="Loading memory…" /> : null}

        {!memories.isLoading && !memories.isError && list.length === 0 ? (
          <p className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
            This agent remembers nothing yet. It starts every conversation from nothing, which is
            the thing the owner asked to change.
          </p>
        ) : null}

        {list.length > 0 ? (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {list.map((memory) => (
              <div
                key={memory.id}
                className="rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-2"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-100">{memory.key}</span>
                  {memory.pinned ? <Badge variant="info">pinned</Badge> : null}
                  {memory.inBrief ? null : <Badge variant="outline">not in the brief</Badge>}
                  <span className="ml-auto text-[10px] text-slate-600">
                    {new Date(memory.updatedAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-slate-400">
                  {readableValue(memory.value)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {data ? (
          <p className="text-[10px] text-slate-600">
            <Brain className="mr-1 inline h-3 w-3 align-[-1px]" />
            {data.used} of {data.budget} characters in the turn context
            {data.dropped > 0 ? ` · ${data.dropped} did not fit` : ''}. Pinned memories come first,
            then the most recent.
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
