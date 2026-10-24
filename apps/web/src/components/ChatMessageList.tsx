import { Loader2 } from 'lucide-react';
import {
  Badge,
  Bubble,
  BubbleContent,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  cn,
} from '@personal-os/ui';
import type {
  ContentPart,
  Message as ChatMessage,
  Participant,
  Resource,
} from '@personal-os/contracts';
import type { AgentConnectionDetail } from '../lib/types';
import { hueFor } from '../features/map/constellation';
import { hueResolverFor, plainTextOf } from '../lib/chat';
import { ActivityLine } from './chat/ActivityLine';
import { AgentOrb } from './chat/AgentOrb';
import { MessageActions } from './chat/MessageActions';
import { MessageBadges } from './chat/MessageBadges';
import { MessageBody } from './chat/MessageBody';
import { MessageDetail } from './chat/MessageDetail';

export interface StreamingEntry {
  executionId: string;
  text: string;
  agentName: string | null;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
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

function senderOf(message: ChatMessage, participants: Participant[]): Participant | undefined {
  return participants.find((participant) => participant.id === message.senderId);
}

function agentNameOf(
  message: ChatMessage,
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
  message: ChatMessage,
  participants: Participant[],
  agents: AgentConnectionDetail[],
): AgentConnectionDetail | undefined {
  const participant = senderOf(message, participants);
  if (!participant?.agentConnectionId) return undefined;
  return agents.find((item) => item.id === participant.agentConnectionId);
}

/** The parts of a turn that are words, and the parts that are not. */
function splitParts(parts: ContentPart[]): { words: ContentPart[]; rest: ContentPart[] } {
  return {
    words: parts.filter((part) => part.type === 'text'),
    rest: parts.filter((part) => part.type !== 'text'),
  };
}

/**
 * The transcript.
 *
 * Agent turns and human turns are told apart, streaming turns are marked as
 * such, and failures are never hidden.
 *
 * The shape is the one a reader expects from a conversation: an agent's reply
 * is prose on the page, with its name above it and its actions below it, and
 * the owner's own words sit in a bubble on the right. The transcript scrolls
 * on an engine that follows the output while the reader is at the bottom and
 * lets go the moment they scroll away — so a reply that is still arriving
 * never takes the page out from under somebody reading it.
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
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport aria-label="The conversation so far">
          <MessageScrollerContent>
            {messages.map((message) => {
              const participant = senderOf(message, participants);
              const isAgent = participant?.type === 'agent' || message.origin?.kind === 'agent';
              const name = agentNameOf(message, participants, agents);
              const agent = agentOf(message, participants, agents);

              if (message.kind === 'activity') {
                return (
                  <MessageScrollerItem key={message.id} messageId={message.id}>
                    <ActivityLine message={message} time={formatTime(message.createdAt)} />
                  </MessageScrollerItem>
                );
              }

              const { words, rest } = splitParts(message.content);

              // The owner's own words. They sit in a bubble on the right,
              // because a person reading their own transcript should find
              // their own contribution immediately.
              if (!isAgent) {
                return (
                  <MessageScrollerItem key={message.id} messageId={message.id}>
                    <Message align="end">
                      <MessageContent>
                        {words.length > 0 ? (
                          <Bubble align="end" variant="muted">
                            <BubbleContent>
                              <MessageBody
                                parts={words}
                                resources={resources}
                                mentions={mentions}
                                hueOf={hueOf}
                              />
                            </BubbleContent>
                          </Bubble>
                        ) : null}
                        {rest.length > 0 ? (
                          <MessageBody
                            parts={rest}
                            resources={resources}
                            mentions={mentions}
                            hueOf={hueOf}
                          />
                        ) : null}
                        <MessageDetail detail={message.detail} />
                        <MessageFooter>
                          <MessageActions text={plainTextOf(message.content)} />
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              }

              // An agent's reply. It is prose, not a card: the border and the
              // panel would put a box around every paragraph an agent ever
              // wrote, and the transcript would read as a log rather than as
              // a conversation.
              return (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message>
                    <MessageAvatar>
                      <AgentOrb
                        name={name}
                        agentId={participant?.agentConnectionId ?? null}
                        owner={false}
                      />
                    </MessageAvatar>
                    <MessageContent>
                      <MessageHeader>
                        <span className="text-xs font-semibold text-slate-200">{name}</span>
                        {agent ? (
                          <span className="rounded border border-slate-800 px-1 py-px font-mono text-[10px] text-slate-500">
                            {agent.adapterType}
                          </span>
                        ) : null}
                        <MessageBadges isAgent status={message.status} />
                        {message.replyToId ? (
                          <span className="text-[10px] text-slate-600">reply</span>
                        ) : null}
                        <span className="ml-auto text-[10px] text-slate-600">
                          {formatTime(message.createdAt)}
                          {message.origin ? ` · depth ${message.origin.depth}` : ''}
                          {message.executionId ? ` · ${message.executionId}` : ''}
                        </span>
                      </MessageHeader>
                      <MessageBody
                        parts={message.content}
                        resources={resources}
                        mentions={mentions}
                        hueOf={hueOf}
                      />
                      <MessageDetail detail={message.detail} />
                      <MessageFooter>
                        <MessageActions text={plainTextOf(message.content)} />
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              );
            })}

            {streaming.map((entry) => (
              <MessageScrollerItem key={`streaming-${entry.executionId}`}>
                <Message>
                  <MessageAvatar>
                    <AgentOrb
                      name={entry.agentName ?? 'Agent'}
                      agentId={null}
                      owner={false}
                      size="sm"
                    />
                  </MessageAvatar>
                  <MessageContent>
                    <MessageHeader>
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
                    </MessageHeader>
                    {entry.text.length > 0 ? (
                      <MessageBody
                        parts={[{ type: 'text', text: entry.text }]}
                        resources={resources}
                        mentions={mentions}
                        hueOf={hueOf}
                      />
                    ) : (
                      <p className={cn('text-xs italic text-slate-500')}>
                        Waiting for the first token…
                      </p>
                    )}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
