/**
 * Live updates.
 *
 * The web client never polls. Every mutation arrives on the server event
 * stream and is folded into the react-query cache, so a message that
 * streams in, a task that changes status and an agent that drops its
 * connection all reach the screen without a refresh.
 *
 * The server replays the most recent events whenever a client connects, so
 * every cache update is written as an idempotent merge by id.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Evidence, FactoryTask, Message, ServerEvent } from '@personal-os/contracts';
import { EventStream, type StreamStatus } from '../lib/events';
import type { AgentConnectionDetail, Resource } from '../lib/types';
import { useAuth } from './auth';

interface EventsContextValue {
  status: StreamStatus;
  lastEventAt: string | null;
  subscribe: (listener: (event: ServerEvent) => void) => () => void;
}

const EventsContext = createContext<EventsContextValue | null>(null);

function mergeMessage(existing: Message[], incoming: Message): Message[] {
  const index = existing.findIndex((message) => message.id === incoming.id);
  if (index >= 0) {
    const next = [...existing];
    next[index] = incoming;
    return next;
  }
  const next = [...existing, incoming];
  next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return next;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T): T[] {
  const index = existing.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    const next = [...existing];
    next[index] = incoming;
    return next;
  }
  return [incoming, ...existing];
}

function patchMessages(queryClient: QueryClient, message: Message): void {
  const key = ['messages', message.conversationId];
  const existing = queryClient.getQueryData<Message[]>(key);
  if (!existing) return;
  queryClient.setQueryData<Message[]>(key, mergeMessage(existing, message));
}

function patchTasks(queryClient: QueryClient, task: FactoryTask): void {
  const key = ['tasks', task.workspaceId];
  const existing = queryClient.getQueryData<FactoryTask[]>(key);
  if (existing) {
    queryClient.setQueryData<FactoryTask[]>(key, mergeById(existing, task));
  }
  const detailKey = ['task', task.id];
  const detail = queryClient.getQueryData<{ task: FactoryTask; evidence: Evidence[] }>(detailKey);
  if (detail) {
    queryClient.setQueryData<{ task: FactoryTask; evidence: Evidence[] }>(detailKey, {
      ...detail,
      task,
    });
  }
}

type ResourceEvent = Extract<ServerEvent, { type: 'resource.updated' }>['resource'];

function patchResources(queryClient: QueryClient, incoming: ResourceEvent): void {
  // `data` is optional in the event payload but always present on the wire.
  const resource: Resource = {
    ...(incoming as unknown as Resource),
    data: incoming.data === undefined ? {} : incoming.data,
  };
  const entries = queryClient.getQueriesData<Resource[]>({ queryKey: ['resources'] });
  for (const [key, data] of entries) {
    if (!data) continue;
    const typeFilter = key[2];
    const index = data.findIndex((item) => item.id === resource.id);
    if (index >= 0) {
      const next = [...data];
      next[index] = resource;
      queryClient.setQueryData<Resource[]>(key, next);
      continue;
    }
    if (typeof typeFilter === 'string' && typeFilter !== resource.type) continue;
    queryClient.setQueryData<Resource[]>(key, [resource, ...data]);
  }
  const single = queryClient.getQueryData<Resource>(['resource', resource.id]);
  if (single) queryClient.setQueryData<Resource>(['resource', resource.id], resource);
}

function patchAgents(
  queryClient: QueryClient,
  event: Extract<ServerEvent, { type: 'agent.status' }>,
): void {
  const entries = queryClient.getQueriesData<AgentConnectionDetail[]>({ queryKey: ['agents'] });
  for (const [key, data] of entries) {
    if (!data) continue;
    const index = data.findIndex((agent) => agent.id === event.connectionId);
    if (index < 0) continue;
    const next = [...data];
    next[index] = {
      ...next[index]!,
      status: event.status,
      capabilities: event.capabilities,
      lastError: event.lastError,
    };
    queryClient.setQueryData<AgentConnectionDetail[]>(key, next);
  }
}

function applyEvent(queryClient: QueryClient, event: ServerEvent): void {
  switch (event.type) {
    case 'message.created':
    case 'message.updated':
      patchMessages(queryClient, event.message);
      break;
    case 'task.updated':
      patchTasks(queryClient, event.task);
      break;
    case 'resource.updated':
      patchResources(queryClient, event.resource);
      break;
    case 'agent.status':
      patchAgents(queryClient, event);
      break;
    case 'automation.run':
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
      break;
    case 'execution.event':
    case 'heartbeat':
      break;
    default:
      break;
  }
}

export function EventsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { status: authStatus } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const listeners = useRef(new Set<(event: ServerEvent) => void>());

  useEffect(() => {
    if (authStatus !== 'authenticated') return undefined;

    const stream = new EventStream({
      onEvent: (event) => {
        if (event.type !== 'heartbeat') setLastEventAt(new Date().toISOString());
        applyEvent(queryClient, event);
        for (const listener of listeners.current) listener(event);
      },
      onStatus: setStatus,
    });

    stream.start();
    return () => {
      stream.stop();
    };
  }, [authStatus, queryClient]);

  const subscribe = useCallback((listener: (event: ServerEvent) => void): (() => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<EventsContextValue>(
    () => ({ status, lastEventAt, subscribe }),
    [status, lastEventAt, subscribe],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useServerEvents(): EventsContextValue {
  const context = useContext(EventsContext);
  if (!context) throw new Error('useServerEvents must be used inside an EventsProvider.');
  return context;
}
