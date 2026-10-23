import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Ban, Check, Info, Pause, Play, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Suggestions,
} from '@personal-os/ui';
import type {
  ChatActivityReadModel,
  MessageDelivery,
  Participant,
  Persona,
  Resource,
  RoutingMode,
  StopTurnResult,
} from '@personal-os/contracts';
import { resolvePersona } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import type {
  AgentConnectionDetail,
  ConversationDetail,
  Dispatch,
  Message,
  PostMessageResult,
  RoutingDecision,
} from '../lib/types';
import { countTurns, messageRequest, operationState } from '../lib/chat';
import { starterSuggestions } from '../lib/suggestions';
import { useServerEvents } from '../state/events';
import { useWorkspace } from '../state/workspace';
import { ChatMessageList, type StreamingEntry } from '../components/ChatMessageList';
import { Composer, type ComposerSendOptions } from '../components/Composer';
import { ActivityTimeline } from '../components/chat/ActivityTimeline';
import { PresenceList } from '../components/chat/PresenceList';
import { RunControls } from '../components/chat/RunControls';
import { TurnCapabilityPanel } from '../components/chat/TurnCapabilityPanel';
import { WaitingInRoom } from '../components/waiting/WaitingInRoom';
import { EmptyState, ErrorState, LoadingState } from '../components/ErrorState';
import { ParticipantManager } from '../components/ParticipantManager';
import { PersonaBadge } from '../components/PersonaBadge';
import { PersonaOverrideDialog } from '../components/PersonaOverrideDialog';
import { RoutingModeSelector } from '../components/RoutingModeSelector';

export function ConversationDetail(): React.JSX.Element {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  const { subscribe } = useServerEvents();

  const [routingNotice, setRoutingNotice] = useState<{
    messageId: string;
    routing: RoutingDecision;
    dispatches: Dispatch[];
  } | null>(null);
  const [streaming, setStreaming] = useState<StreamingEntry[]>([]);
  const [executionNames, setExecutionNames] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [personaParticipant, setPersonaParticipant] = useState<Participant | null>(null);
  /**
   * How the next message is delivered.
   *
   * The owner picks, and the panel never turns one into the other: a message
   * meant for the running turn and a message meant for the next turn are
   * different things.
   */
  const [delivery, setDelivery] = useState<MessageDelivery>('queue');
  /** What the stop request actually did. */
  const [stopNotice, setStopNotice] = useState<StopTurnResult | null>(null);
  /** The server's sentence about a steer that could not be delivered. */
  const [steerNotice, setSteerNotice] = useState<string | null>(null);

  const conversation = useQuery<ConversationDetail>({
    queryKey: ['conversation', conversationId],
    queryFn: () =>
      api
        .get<{ conversation: ConversationDetail }>(`/conversations/${conversationId}`)
        .then((r) => r.conversation),
    enabled: Boolean(conversationId),
  });

  const messages = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      api
        .get<{ messages: Message[] }>(`/conversations/${conversationId}/messages`, { limit: 200 })
        .then((r) => r.messages),
    enabled: Boolean(conversationId),
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

  // The resources of the workspace. They are what an attachment points at,
  // and what an artifact in the transcript resolves to.
  const resources = useQuery<Resource[]>({
    queryKey: ['resources', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{ resources: Resource[] }>('/resources', { workspaceId: activeWorkspaceId ?? '' })
        .then((r) => r.resources),
    enabled: Boolean(activeWorkspaceId),
  });

  /**
   * The turn the room is watching.
   *
   * It is the turn that is streaming, or the last turn a message belongs to.
   * The trace is drawn from that turn, so the panel shows what the agent is
   * doing rather than a list of things that happened once.
   */
  const activeExecutionId = useMemo(() => {
    const streamingEntry = streaming[streaming.length - 1];
    if (streamingEntry) return streamingEntry.executionId;
    const withExecution = (messages.data ?? []).filter((message) => message.executionId);
    const lastMessage = withExecution[withExecution.length - 1];
    if (lastMessage?.executionId) return lastMessage.executionId;
    const dispatches = routingNotice?.dispatches ?? [];
    const lastDispatch = dispatches[dispatches.length - 1];
    return lastDispatch?.executionId ?? null;
  }, [streaming, messages.data, routingNotice]);

  const turn = useQuery<ChatActivityReadModel>({
    queryKey: ['turn', activeExecutionId],
    queryFn: () => api.get<ChatActivityReadModel>(`/executions/${activeExecutionId}`),
    enabled: Boolean(activeExecutionId),
  });

  /** The resources, by id, so an artifact in the transcript can be drawn. */
  const resourceIndex = useMemo(() => {
    const map: Record<string, Resource> = {};
    for (const resource of resources.data ?? []) map[resource.id] = resource;
    return map;
  }, [resources.data]);

  /** The chain depth the conversation is at. */
  const conversationDepth = useMemo(() => {
    const transcript = messages.data ?? [];
    const last = transcript[transcript.length - 1];
    return last?.origin?.depth ?? 0;
  }, [messages.data]);

  // Live updates: the transcript grows over SSE, never by polling.
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'execution.event') {
        if (event.conversationId !== conversationId) return;
        // The trace is a read model of the event log. It is read again when
        // the log grew, rather than patched here, so what the owner sees is
        // what the server would say.
        void queryClient.invalidateQueries({ queryKey: ['turn', event.executionId] });
        if (event.event.type !== 'message.delta') return;
        const delta = event.event.text;
        setStreaming((current) => {
          const index = current.findIndex((entry) => entry.executionId === event.executionId);
          if (index < 0) {
            return [
              ...current,
              {
                executionId: event.executionId,
                text: delta,
                agentName: executionNames[event.executionId] ?? null,
              },
            ];
          }
          const next = [...current];
          const existing = next[index];
          if (!existing) return current;
          next[index] = { ...existing, text: existing.text + delta };
          return next;
        });
        return;
      }

      if (event.type === 'message.updated') {
        const executionId = event.message.executionId;
        if (!executionId) return;
        setStreaming((current) => current.filter((entry) => entry.executionId !== executionId));
      }
    });
  }, [subscribe, conversationId, executionNames, queryClient]);

  const agentById = useMemo(() => {
    const map = new Map<string, AgentConnectionDetail>();
    for (const agent of agents.data ?? []) map.set(agent.id, agent);
    return map;
  }, [agents.data]);

  // The prompts an empty room offers. They are the room's own — one of them
  // names a participant — so they are derived from the participants rather
  // than written down once.
  //
  // This sits above the early returns on purpose. A hook after them would run
  // only once the conversation has loaded, and the component would then have
  // more hooks on the second render than on the first.
  const suggestions = useMemo(
    () => starterSuggestions(conversation.data?.participants ?? []),
    [conversation.data?.participants],
  );

  const invalidate = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    await queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [queryClient, conversationId]);

  const postMessage = useMutation({
    mutationFn: async (input: { text: string; options: ComposerSendOptions }) =>
      api.post<PostMessageResult>(
        `/conversations/${conversationId}/messages`,
        messageRequest(input.text, input.options),
      ),
    onSuccess: async (result) => {
      setExecutionNames((current) => {
        const next = { ...current };
        for (const dispatch of result.dispatches) {
          const name = agentById.get(dispatch.agentConnectionId)?.name ?? 'Agent';
          next[dispatch.executionId] = name;
        }
        return next;
      });
      setRoutingNotice({
        messageId: result.message.id,
        routing: result.routing,
        dispatches: result.dispatches,
      });
      // A steer that could not be delivered is a queued message, and the
      // server says why. The panel shows its sentence rather than one of its
      // own, because the owner has to know that the steer did not happen.
      setSteerNotice(result.steer && !result.steer.delivered ? result.steer.reason : null);
      await invalidate();
    },
  });

  /**
   * Ask a turn to stop.
   *
   * The answer says what actually happened: a turn that had not started was
   * cancelled, and a turn that was already running was only asked. The panel
   * shows the server's sentence rather than one of its own.
   */
  const stopTurn = useMutation({
    mutationFn: async (executionId: string) =>
      api.post<StopTurnResult>(`/executions/${executionId}/stop`, {}),
    onSuccess: async (result) => {
      setStopNotice(result);
      await queryClient.invalidateQueries({ queryKey: ['turn', result.executionId] });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const updateConversation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) =>
      api.patch<{ conversation: ConversationDetail }>(`/conversations/${conversationId}`, patch),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const addParticipant = useMutation({
    mutationFn: async (input: {
      type: 'human' | 'agent';
      agentConnectionId?: string;
      displayName: string;
    }) => api.post(`/conversations/${conversationId}/participants`, input),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const removeParticipant = useMutation({
    mutationFn: async (participantId: string) =>
      api.delete(`/conversations/${conversationId}/participants/${participantId}`),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const updateParticipant = useMutation({
    mutationFn: async (input: { participantId: string; personaOverride: Persona | null }) =>
      api.patch(`/conversations/${conversationId}/participants/${input.participantId}`, {
        // `null` clears the override: the connection's base is in force
        // again.
        personaOverride: input.personaOverride,
      }),
    onSuccess: async () => {
      setActionError(null);
      setPersonaParticipant(null);
      await invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const removeConversation = useMutation({
    mutationFn: async () => api.delete(`/conversations/${conversationId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate('/conversations', { replace: true });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  if (conversation.isError) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <ErrorState
          title="This conversation could not be loaded"
          message={errorMessage(conversation.error)}
          onRetry={() => void conversation.refetch()}
        />
      </div>
    );
  }

  if (conversation.isLoading || !conversation.data) {
    return <LoadingState label="Loading conversation…" />;
  }

  const current = conversation.data;
  const agentParticipants = current.participants.filter(
    (participant) => participant.type === 'agent',
  );
  const coordinator = current.participants.find(
    (participant) => participant.id === current.coordinatorId,
  );

  // The persona in force for every agent participant, and where it came
  // from. The conversation's override wins over the connection's base, and
  // the panel says which one is in force.
  const personas = agentParticipants.map((participant) => ({
    participant,
    resolved: resolvePersona({
      override: participant.personaOverride,
      base: participant.agentConnectionId
        ? agentById.get(participant.agentConnectionId)?.persona
        : undefined,
    }),
  }));

  const basePersonaOf = (participant: Participant | null): Persona | undefined =>
    participant?.agentConnectionId
      ? agentById.get(participant.agentConnectionId)?.persona
      : undefined;

  const dispatchNames = (routingNotice?.dispatches ?? []).map(
    (dispatch) => agentById.get(dispatch.agentConnectionId)?.name ?? dispatch.agentConnectionId,
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to="/conversations"
            className="mb-1 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="h-3 w-3" />
            All conversations
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight">{current.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <Badge variant="outline">{current.routingMode}</Badge>
            {current.paused ? <Badge variant="warning">paused</Badge> : null}
            {coordinator ? <span>coordinator: {coordinator.displayName}</span> : null}
            {personas.map(({ participant, resolved }) => (
              <span key={participant.id} className="inline-flex items-center gap-1.5">
                <span className="text-slate-400">{participant.displayName}</span>
                <PersonaBadge role={resolved.persona?.role} source={resolved.source} />
              </span>
            ))}
            <span className="font-mono text-slate-600">
              turns {countTurns(messages.data ?? [])}/{current.maxTurns}
            </span>
            <span className="font-mono text-slate-600">
              max {current.maxSpendUnits} spend units
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={current.paused ? 'primary' : 'secondary'}
            size="sm"
            disabled={updateConversation.isPending}
            onClick={() => updateConversation.mutate({ paused: !current.paused })}
          >
            {current.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {current.paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete conversation"
            disabled={removeConversation.isPending}
            onClick={() => {
              if (window.confirm('Delete this conversation and its transcript?')) {
                removeConversation.mutate();
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <PersonaOverrideDialog
        key={personaParticipant?.id ?? 'none'}
        participant={personaParticipant}
        base={basePersonaOf(personaParticipant)}
        busy={updateParticipant.isPending}
        error={updateParticipant.isError ? errorMessage(updateParticipant.error) : null}
        onOpenChange={(open) => {
          if (!open) setPersonaParticipant(null);
        }}
        onSubmit={(personaOverride) => {
          if (!personaParticipant) return;
          updateParticipant.mutate({
            participantId: personaParticipant.id,
            personaOverride,
          });
        }}
      />

      {actionError ? <ErrorState title="The change was not applied" message={actionError} /> : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="flex min-h-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {messages.isError ? (
                <ErrorState
                  title="The transcript could not be loaded"
                  message={errorMessage(messages.error)}
                  onRetry={() => void messages.refetch()}
                />
              ) : null}

              {(messages.data ?? []).length === 0 && !messages.isError ? (
                <EmptyState
                  title="No messages yet"
                  message="Send a message below. Use @Name to address a specific agent, or switch the routing mode so every participant is in scope."
                />
              ) : null}

              <ChatMessageList
                messages={messages.data ?? []}
                participants={current.participants}
                agents={agents.data ?? []}
                streaming={streaming}
                resources={resourceIndex}
              />
            </div>

            {routingNotice ? (
              <div
                className={`rounded-md border px-3 py-2 text-[11px] ${
                  routingNotice.routing.blocked
                    ? 'border-err/40 bg-err/10 text-err'
                    : dispatchNames.length > 0
                      ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200'
                      : 'border-slate-700 bg-slate-950/60 text-slate-400'
                }`}
              >
                <div className="flex items-start gap-2">
                  {routingNotice.routing.blocked ? (
                    <Ban className="mt-0.5 h-3 w-3 shrink-0" />
                  ) : dispatchNames.length > 0 ? (
                    <Check className="mt-0.5 h-3 w-3 shrink-0" />
                  ) : (
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">
                      {dispatchNames.length > 0
                        ? `Dispatched to ${dispatchNames.join(', ')}`
                        : routingNotice.routing.blocked
                          ? `Not dispatched — ${routingNotice.routing.blocked}`
                          : 'No participants matched'}
                    </p>
                    <p className="mt-0.5 opacity-80">{routingNotice.routing.reason}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {stopNotice ? (
              <div className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-caution" />
                  <p>{stopNotice.detail}</p>
                </div>
              </div>
            ) : null}

            {steerNotice ? (
              <div className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-caution" />
                  <p>{steerNotice}</p>
                </div>
              </div>
            ) : null}

            <RunControls
              run={turn.data?.run ?? null}
              delivery={delivery}
              onDeliveryChange={setDelivery}
              stopping={stopTurn.isPending}
              onStop={() => {
                if (!activeExecutionId) return;
                stopTurn.mutate(activeExecutionId);
              }}
            />

            {/* The prompts an empty room offers. They are placed where the
                composer is, so pressing one is the same act as typing it: the
                message goes out with the delivery mode the owner has chosen,
                and the owner can see which one that is. */}
            {(messages.data ?? []).length === 0 && !messages.isError && !current.paused ? (
              <Suggestions
                suggestions={suggestions}
                busy={postMessage.isPending}
                onSend={(suggestion) => {
                  void postMessage.mutateAsync({
                    text: suggestion,
                    options: { delivery, attachments: [] },
                  });
                }}
              />
            ) : null}

            <Composer
              participants={current.participants}
              disabled={current.paused || postMessage.isPending}
              delivery={delivery}
              steer={operationState(turn.data?.run, 'steer')}
              attachable={resources.data ?? []}
              routingMode={current.routingMode}
              depth={conversationDepth}
              maxTurns={current.maxTurns}
              placeholder={
                current.paused
                  ? 'This conversation is paused. Resume it to send messages.'
                  : 'Write a message. Use @Name to address an agent.'
              }
              onSend={async (text, options) => {
                await postMessage.mutateAsync({ text, options });
              }}
            />
            {postMessage.isError ? (
              <p className="text-[11px] text-red-400">{errorMessage(postMessage.error)}</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {/*
           * What is waiting on the owner, in the room.
           *
           * A request that arrives in a conversation is answered in that
           * conversation. The owner does not have to leave the room to find
           * what the room is asking of them.
           */}
          <WaitingInRoom
            conversationId={current.id}
            participants={current.participants}
            agents={agents.data ?? []}
          />

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Execution trace</span>
                {activeExecutionId ? (
                  <span className="font-mono text-[10px] font-normal text-slate-600">
                    {activeExecutionId}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {turn.isError ? (
                <ErrorState
                  title="The trace could not be loaded"
                  message={errorMessage(turn.error)}
                  onRetry={() => void turn.refetch()}
                />
              ) : (
                <ActivityTimeline
                  activities={turn.data?.activities ?? []}
                  run={
                    turn.data
                      ? {
                          spendUnits: turn.data.turn.spendUnits,
                          startedAt: turn.data.turn.startedAt,
                          finishedAt: turn.data.turn.finishedAt,
                        }
                      : null
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Turn capabilities</span>
                {activeExecutionId ? (
                  <span className="font-mono text-[10px] font-normal text-slate-600">
                    {activeExecutionId}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <TurnCapabilityPanel
                view={turn.data?.turn.capabilityView ?? null}
                agents={agents.data ?? []}
                hasTurn={Boolean(activeExecutionId)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle>Presence</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <PresenceList participants={current.participants} agents={agents.data ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle>Routing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              <RoutingModeSelector
                value={current.routingMode}
                disabled={updateConversation.isPending}
                onChange={(mode: RoutingMode) => updateConversation.mutate({ routingMode: mode })}
              />
              <div>
                <p className="pos-field-label">Coordinator</p>
                <Select
                  aria-label="Coordinator"
                  className="h-8 text-xs"
                  value={current.coordinatorId ?? ''}
                  disabled={updateConversation.isPending}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    updateConversation.mutate({ coordinatorId: event.target.value });
                  }}
                >
                  <option value="">None</option>
                  {agentParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.displayName}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[10px] text-slate-500">
                  Only used in coordinator mode. It must be an agent that already participates.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Turns</p>
                  <p className="text-sm font-semibold text-slate-200">{current.maxTurns}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Seconds</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {current.maxDurationSeconds}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Spend</p>
                  <p className="text-sm font-semibold text-slate-200">{current.maxSpendUnits}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle>Participants</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <ParticipantManager
                participants={current.participants}
                agents={agents.data ?? []}
                busy={addParticipant.isPending || removeParticipant.isPending}
                onAdd={(input) => addParticipant.mutate(input)}
                onRemove={(participantId) => removeParticipant.mutate(participantId)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle>Personas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-1">
              {personas.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No agent participates yet, so no persona is in force.
                </p>
              ) : null}
              {personas.map(({ participant, resolved }) => (
                <div
                  key={participant.id}
                  className="rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-slate-200">
                      {participant.displayName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPersonaParticipant(participant)}
                    >
                      Persona
                    </Button>
                  </div>
                  <div className="mt-0.5">
                    <PersonaBadge role={resolved.persona?.role} source={resolved.source} />
                  </div>
                  {resolved.persona?.instructions ? (
                    <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-400">
                      {resolved.persona.instructions}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {current.paused ? (
            <div className="flex items-start gap-2 rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                The conversation is paused. Messages are recorded but no agent is woken up.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
