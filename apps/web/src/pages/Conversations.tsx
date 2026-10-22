import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
} from '@personal-os/ui';
import type { RoutingMode } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, ConversationDetail } from '../lib/types';
import { useWorkspace } from '../state/workspace';
import { ConversationList } from '../components/ConversationList';
import { EmptyState, ErrorState, LoadingState } from '../components/ErrorState';
import { Field } from '../components/Field';
import { MeasuresBand } from '../components/MeasuresBand';
import { RoutingModeSelector } from '../components/RoutingModeSelector';
import { WaitingList } from '../components/WaitingList';

export function Conversations(): React.JSX.Element {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const conversations = useQuery<ConversationDetail[]>({
    queryKey: ['conversations', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{
          conversations: ConversationDetail[];
        }>('/conversations', { workspaceId: activeWorkspaceId ?? undefined })
        .then((response) => response.conversations),
    enabled: Boolean(activeWorkspaceId),
  });

  const agents = useQuery<AgentConnectionDetail[]>({
    queryKey: ['agents', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{
          agents: AgentConnectionDetail[];
        }>('/agents', { workspaceId: activeWorkspaceId ?? undefined })
        .then((response) => response.agents),
    enabled: Boolean(activeWorkspaceId),
  });

  const createConversation = useMutation({
    mutationFn: async (input: {
      title: string;
      routingMode: RoutingMode;
      participantConnectionIds: string[];
      coordinatorConnectionId: string | null;
    }) => {
      const response = await api.post<{ conversation: ConversationDetail }>('/conversations', {
        workspaceId: activeWorkspaceId,
        title: input.title,
        routingMode: input.routingMode,
        participantAgentConnectionIds: input.participantConnectionIds,
      });
      // The coordinator is addressed by participant id, and participants only
      // exist once the conversation has been created, so it is set in a
      // second call.
      if (input.coordinatorConnectionId) {
        const participant = response.conversation.participants.find(
          (item) => item.agentConnectionId === input.coordinatorConnectionId,
        );
        if (participant) {
          await api.patch<{ conversation: ConversationDetail }>(
            `/conversations/${response.conversation.id}`,
            {
              coordinatorId: participant.id,
            },
          );
        }
      }
      return response.conversation;
    },
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setDialogOpen(false);
      navigate(`/conversations/${conversation.id}`);
    },
  });

  const list = conversations.data ?? [];

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Conversations</h1>
          <p className="text-xs text-slate-500">
            {activeWorkspace ? activeWorkspace.name : 'No workspace selected'} · one or many agents
            per thread
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </header>

      {/*
        The waiting list comes first. The conversation list is what the panel
        is for, but the question the owner opens it with is what is waiting
        on them, and the answer belongs above everything else.
      */}
      <WaitingList agents={agents.data ?? []} conversations={conversations.data ?? []} />

      {/*
        The measures come after it. The product's report on itself is worth
        having, and it is worth less than the answer to the question the owner
        opened the panel with.
      */}
      <MeasuresBand />

      {conversations.isError ? (
        <ErrorState
          title="The conversations could not be loaded"
          message={errorMessage(conversations.error)}
          onRetry={() => void conversations.refetch()}
        />
      ) : null}

      {conversations.isLoading ? <LoadingState label="Loading conversations…" /> : null}

      {!conversations.isLoading && !conversations.isError && list.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="A conversation is the unit of work. Add an agent connection first, then start a thread."
          action={
            <Button variant="secondary" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New conversation
            </Button>
          }
        />
      ) : null}

      {list.length > 0 ? (
        <Card>
          <CardContent className="p-2">
            <ConversationList conversations={list} />
          </CardContent>
        </Card>
      ) : null}

      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents.data ?? []}
        busy={createConversation.isPending}
        error={createConversation.isError ? errorMessage(createConversation.error) : null}
        onSubmit={(input) => createConversation.mutate(input)}
      />
    </div>
  );
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AgentConnectionDetail[];
  busy: boolean;
  error: string | null;
  onSubmit: (input: {
    title: string;
    routingMode: RoutingMode;
    participantConnectionIds: string[];
    coordinatorConnectionId: string | null;
  }) => void;
}

function NewConversationDialog({
  open,
  onOpenChange,
  agents,
  busy,
  error,
  onSubmit,
}: NewConversationDialogProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [routingMode, setRoutingMode] = useState<RoutingMode>('mentions');
  const [selected, setSelected] = useState<string[]>([]);
  const [coordinator, setCoordinator] = useState<string>('');

  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled), [agents]);

  const toggle = (id: string): void => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      routingMode,
      participantConnectionIds: selected,
      coordinatorConnectionId: coordinator || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Choose the agents that take part and how a human turn is routed to them.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Title" htmlFor="conversation-title">
            <Input
              id="conversation-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Weekly research digest"
            />
          </Field>

          <Field label="Routing mode">
            <RoutingModeSelector value={routingMode} onChange={setRoutingMode} />
          </Field>

          <Field
            label="Participants"
            hint={
              enabledAgents.length === 0
                ? 'No enabled agent connections in this workspace yet. Add one on the Agents page.'
                : 'Every listed agent joins the thread and can be addressed with @Name.'
            }
          >
            {enabledAgents.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-500">
                <Bot className="h-3.5 w-3.5" />
                No agent connections available.
              </div>
            ) : (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-slate-800 p-1.5">
                {enabledAgents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
                  >
                    <input
                      type="checkbox"
                      className="accent-indigo-500"
                      checked={selected.includes(agent.id)}
                      onChange={() => toggle(agent.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                    <Badge variant="outline">{agent.adapterType}</Badge>
                  </label>
                ))}
              </div>
            )}
          </Field>

          {routingMode === 'coordinator' ? (
            <Field
              label="Coordinator"
              hint="Only meaningful in coordinator mode: one agent receives the request and may delegate."
            >
              <Select value={coordinator} onChange={(event) => setCoordinator(event.target.value)}>
                <option value="">No coordinator</option>
                {enabledAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {error ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
              <Users className="h-4 w-4" />
              {busy ? 'Creating…' : 'Create conversation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
