import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
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
} from '@personal-os/ui';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, AgentTokenSummary } from '../lib/types';
import { Field } from './Field';

interface AgentTokenPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentConnectionDetail | null;
}

/**
 * MCP tokens for one agent connection.
 *
 * The plaintext token is returned exactly once, at creation time. Only its
 * digest is stored server-side, so a lost token has to be replaced.
 */
export function AgentTokenPanel({
  open,
  onOpenChange,
  agent,
}: AgentTokenPanelProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<{ id: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentId = agent?.id ?? '';

  const tokens = useQuery<AgentTokenSummary[]>({
    queryKey: ['tokens', agentId],
    queryFn: () =>
      api.get<{ tokens: AgentTokenSummary[] }>(`/agents/${agentId}/tokens`).then((r) => r.tokens),
    enabled: open && agentId.length > 0,
  });

  const issue = useMutation({
    mutationFn: async (tokenLabel: string) =>
      api.post<{ id: string; token: string }>(`/agents/${agentId}/tokens`, { label: tokenLabel }),
    onSuccess: async (result) => {
      setIssued(result);
      setLabel('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['tokens', agentId] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const revoke = useMutation({
    mutationFn: async (tokenId: string) => api.delete(`/agents/${agentId}/tokens/${tokenId}`),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['tokens', agentId] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const copy = async (): Promise<void> => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>MCP tokens · {agent?.name}</DialogTitle>
          <DialogDescription>
            A token authenticates an external agent against the MCP endpoint and is scoped to this
            one connection.
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="rounded-md border border-emerald-800/60 bg-emerald-950/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">
              Copy this token now — it is shown only once
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-200">
                {issued.token}
              </code>
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Label" htmlFor="token-label">
              <Input
                id="token-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="laptop"
              />
            </Field>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-9"
            disabled={issue.isPending}
            onClick={() => issue.mutate(label)}
          >
            <Plus className="h-3.5 w-3.5" />
            Issue token
          </Button>
        </div>

        {error ? (
          <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {(tokens.data ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-800 px-3 py-4 text-center text-[11px] text-slate-500">
              No tokens issued for this connection.
            </p>
          ) : null}
          {(tokens.data ?? []).map((token) => (
            <div
              key={token.id}
              className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1.5"
            >
              <KeyRound className="h-3.5 w-3.5 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                {token.label || 'unlabelled'}
              </span>
              <span className="text-[10px] text-slate-600">
                {token.revokedAt ? 'revoked' : token.lastUsedAt ? 'used' : 'unused'}
              </span>
              {token.revokedAt ? (
                <Badge variant="danger">revoked</Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Revoke token"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(token.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
