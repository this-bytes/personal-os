import { Loader2 } from 'lucide-react';
import { Badge, cn } from '@personal-os/ui';
import type { Message, Participant, Resource } from '@personal-os/contracts';
import type { AgentConnectionDetail } from '../lib/types';
import { hueFor } from '../features/map/constellation';
import { hueResolverFor } from '../lib/chat';
import { ActivityLine } from './chat/ActivityLine';
import { AgentOrb } from './chat/AgentOrb';
import { MessageBadges } from './chat/MessageBadges';
import { MessageBody } from './chat/MessageBody';

export interface StreamingEntry {
  executionId: string;
  text: string;
  agentName: string | null;
}

interface ChatMessageListProps {
  messages: Message[];
  participants: Participant[];
  agents: AgentConnectionDetail[];
  streaming: StreamingEntry[];
  /** The resources the messages point at, when the panel has loaded them. */
  resources?: Record<string, Resource>;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function senderOf(message: Message, participants: Participant[]): Participant | undefined {
  return participants.find((participant) => participant.id === message.senderId);
}

function agentNameOf(
  message: Message,
  participants: Participant[],
  agents: AgentConnectionDetail[],
): string {
  const participant = senderOf(message, participants);
  if (participant?.type === 'agent' && participant.agentConnectionId) {
    const agent = agents.find((item) => item.id === participant.agentConnectionId);
    if (agent) return agent.name;
  }
  return participant?.displayName ?? 'Unknown';
}

/**
 * The connection an agent's message came from.
 *
 * It is the connection the participant names, and the panel shows its
 * adapter beside the name so the owner can tell at a glance which runtime
 * spoke.
 */
function agentOf(
  message: Message,
  participants: Participant[],
  agents: AgentConnectionDetail[],
): AgentConnectionDetail | undefined {
  const participant = senderOf(message, participants);
  if (!participant?.agentConnectionId) return undefined;
  return agents.find((item) => item.id === participant.agentConnectionId);
}

/**
 * The transcript. Agent turns and human turns are told apart, streaming
 * turns are marked as such, and failures are never hidden.
 */
export function ChatMessageList({
  messages,
  participants,
  agents,
  streaming,
  resources = {},
}: ChatMessageListProps): React.JSX.Element {
  const mentions = participants.map((participant) => participant.displayName);
  const hueOf = hueResolverFor(participants, hueFor);

  return (
    <div className="space-y-2.5">
      {messages.map((message) => {
        const participant = senderOf(message, participants);
        const isAgent = participant?.type === 'agent' || message.origin?.kind === 'agent';
        const name = agentNameOf(message, participants, agents);
        const agent = agentOf(message, participants, agents);

        if (message.kind === 'activity') {
          return (
            <ActivityLine key={message.id} message={message} time={formatTime(message.createdAt)} />
          );
        }

        return (
          <article
            key={message.id}
            className={cn(
              'rounded-lg border px-3 py-2.5',
              isAgent
                ? 'border-slate-800 bg-slate-900/50'
                : 'border-indigo-500/25 bg-indigo-500/[0.06]',
            )}
          >
            <header className="mb-1.5 flex flex-wrap items-center gap-2">
              <AgentOrb
                name={name}
                agentId={participant?.agentConnectionId ?? null}
                owner={!isAgent}
              />
              <span className="text-xs font-semibold text-slate-200">{name}</span>
              {agent ? (
                <span className="rounded border border-slate-800 px-1 py-px font-mono text-[10px] text-slate-500">
                  {agent.adapterType}
                </span>
              ) : null}
              <MessageBadges isAgent={isAgent} status={message.status} />
              {message.replyToId ? <span className="text-[10px] text-slate-600">reply</span> : null}
              <span className="ml-auto text-[10px] text-slate-600">
                {formatTime(message.createdAt)}
                {message.origin ? ` · depth ${message.origin.depth}` : ''}
                {message.executionId ? ` · ${message.executionId}` : ''}
              </span>
            </header>

            <MessageBody
              parts={message.content}
              resources={resources}
              mentions={mentions}
              hueOf={hueOf}
            />
            {message.detail ? (
              // The server's account of how this message ended. It is shown
              // as it is given: the client does not reword what the server
              // said happened.
              <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{message.detail}</p>
            ) : null}
          </article>
        );
      })}

      {streaming.map((entry) => (
        <article
          key={`streaming-${entry.executionId}`}
          className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5"
        >
          <header className="mb-1.5 flex items-center gap-2">
            <AgentOrb name={entry.agentName ?? 'Agent'} agentId={null} owner={false} size="sm" />
            <span className="text-xs font-semibold text-slate-200">
              {entry.agentName ?? 'Agent'}
            </span>
            <Badge variant="accent">
              <Loader2 className="h-2.5 w-2.5 animate-spin text-accent" />
              streaming
            </Badge>
            <span className="ml-auto font-mono text-[10px] text-slate-600">
              {entry.executionId}
            </span>
          </header>
          {entry.text.length > 0 ? (
            <MessageBody
              parts={[{ type: 'text', text: entry.text }]}
              resources={resources}
              mentions={mentions}
              hueOf={hueOf}
            />
          ) : (
            <p className="text-xs italic text-slate-500">Waiting for the first token…</p>
          )}
        </article>
      ))}
    </div>
  );
}
