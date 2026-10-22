import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from '@personal-os/ui';
import { mcpToolNames, type McpToolName } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import { grantChange } from '../lib/grantChange';
import type { AgentConnectionDetail } from '../lib/types';

interface ToolGrantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentConnectionDetail | null;
}

/**
 * The MCP tools one agent connection may call.
 *
 * A tool that is switched off is not registered on the MCP server at all,
 * so the external agent does not even see it in the tool list.
 */
export function ToolGrantPanel({
  open,
  onOpenChange,
  agent,
}: ToolGrantPanelProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<McpToolName[]>([]);
  /** The grant the editor was opened with: what the owner is looking at. */
  const [base, setBase] = useState<McpToolName[]>([]);
  const [error, setError] = useState<string | null>(null);

  const agentId = agent?.id ?? '';

  // Reset the selection whenever a different connection is opened.
  useEffect(() => {
    if (open && agent) {
      setBase([...agent.toolGrants]);
      setSelected([...agent.toolGrants]);
    }
  }, [open, agent]);

  const save = useMutation({
    // The request carries what the owner turned, not the whole list. The whole
    // list is the grant the page read, and a widening another writer committed
    // after that read is not in it — so sending the list would take that
    // widening back, and the owner never chose to narrow it.
    mutationFn: async (change: { base: McpToolName[]; selected: McpToolName[] }) =>
      api.patch<{ agent: AgentConnectionDetail }>(`/agents/${agentId}`, {
        toolGrantChange: grantChange(change.base, change.selected),
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      onOpenChange(false);
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const toggle = (tool: McpToolName): void => {
    setSelected((current) =>
      current.includes(tool) ? current.filter((name) => name !== tool) : [...current, tool],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>MCP tool grants · {agent?.name}</DialogTitle>
          <DialogDescription>
            These are the only tools an MCP token for this connection can call. A tool that is off
            is not published to the agent at all.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {mcpToolNames.map((tool) => {
            const enabled = selected.includes(tool);
            return (
              <div
                key={tool}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1.5"
              >
                <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-200">
                  {tool}
                </code>
                <Switch
                  checked={enabled}
                  aria-label={`Allow ${tool}`}
                  onCheckedChange={() => toggle(tool)}
                />
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-600">
          <ShieldCheck className="mr-1 inline h-3 w-3 align-[-1px]" />
          {selected.length} of {mcpToolNames.length} tools granted. An agent also stays inside the
          workspace of this connection.
        </p>

        {error ? (
          <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={save.isPending}
            onClick={() => save.mutate({ base, selected })}
          >
            Save grants
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
