import { AlertTriangle, Bot, FileText, HelpCircle, Loader2, User } from 'lucide-react';
import { Badge, cn } from '@personal-os/ui';
import type { Message, Participant } from '@personal-os/contracts';
import type { AgentConnectionDetail } from '../lib/types';

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

function MessageBody({ message }: { message: Message }): React.JSX.Element {
  if (message.content.length === 0) {
    return <p className="text-xs italic text-slate-500">No content</p>;
  }
  return (
    <div className="space-y-1.5">
      {message.content.map((part, index) => {
        if (part.type === 'text') {
          return (
            <p
              key={`text-${index}`}
              className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200"
            >
              {part.text}
            </p>
          );
        }
        return (
          <div
            key={`${part.type}-${index}`}
            className="inline-flex items-center gap-1.5 rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-400"
          >
            <FileText className="h-3 w-3" />
            {part.type === 'artifact' ? 'artifact' : 'file'} · {part.resourceId}
          </div>
        );
      })}
    </div>
  );
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
}: ChatMessageListProps): React.JSX.Element {
  return (
    <div className="space-y-2.5">
      {messages.map((message) => {
        const participant = senderOf(message, participants);
        const isAgent = participant?.type === 'agent' || message.origin?.kind === 'agent';
        const name = agentNameOf(message, participants, agents);

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
              {isAgent ? (
                <Bot className="h-3.5 w-3.5 text-indigo-400" />
              ) : (
                <User className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span className="text-xs font-semibold text-slate-200">{name}</span>
              <Badge variant={isAgent ? 'info' : 'outline'}>{isAgent ? 'agent' : 'human'}</Badge>
              {message.status === 'streaming' ? (
                <Badge variant="accent">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  streaming
                </Badge>
              ) : null}
              {message.status === 'failed' ? (
                <Badge variant="danger">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  failed
                </Badge>
              ) : null}
              {message.status === 'unknown' ? (
                <Badge variant="warning">
                  <HelpCircle className="h-2.5 w-2.5" />
                  outcome unknown
                </Badge>
              ) : null}
              {message.replyToId ? <span className="text-[10px] text-slate-600">reply</span> : null}
              <span className="ml-auto text-[10px] text-slate-600">
                {formatTime(message.createdAt)}
              </span>
            </header>
            <MessageBody message={message} />
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
            <Bot className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-200">
              {entry.agentName ?? 'Agent'}
            </span>
            <Badge variant="accent">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              streaming
            </Badge>
          </header>
          {entry.text.length > 0 ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
              {entry.text}
            </p>
          ) : (
            <p className="text-xs italic text-slate-500">Waiting for the first token…</p>
          )}
        </article>
      ))}
    </div>
  );
}
