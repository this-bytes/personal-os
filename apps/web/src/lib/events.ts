/**
 * Server-sent events client.
 *
 * The backend exposes a single event stream at `/api/events`. The browser
 * reconnects on its own, but the server replays the most recent events on
 * every connect, so the client has to tolerate seeing history twice.
 */

import { serverEventSchema, type ServerEvent, type ServerEventType } from '@personal-os/contracts';

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error';

const EVENT_TYPES: ServerEventType[] = [
  'message.created',
  'message.updated',
  'execution.event',
  'task.updated',
  'resource.updated',
  'agent.status',
  'automation.run',
  'approval.decided',
  'heartbeat',
];

const RECONNECT_WATCHDOG_MS = 15_000;
const MAX_SEEN_IDS = 500;

export interface EventStreamOptions {
  url?: string;
  onEvent: (event: ServerEvent) => void;
  onStatus?: (status: StreamStatus) => void;
  onError?: (error: Error) => void;
}

export class EventStream {
  private source: EventSource | null = null;
  private readonly seen = new Set<string>();
  private readonly seenOrder: string[] = [];
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private status: StreamStatus = 'idle';

  private readonly url: string;
  private readonly onEvent: (event: ServerEvent) => void;
  private readonly onStatus: (status: StreamStatus) => void;
  private readonly onError: (error: Error) => void;

  constructor(options: EventStreamOptions) {
    this.url = options.url ?? '/api/events';
    this.onEvent = options.onEvent;
    this.onStatus = options.onStatus ?? (() => undefined);
    this.onError = options.onError ?? (() => undefined);
  }

  start(): void {
    if (this.stopped) return;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.clearWatchdog();
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    this.setStatus('idle');
  }

  getStatus(): StreamStatus {
    return this.status;
  }

  private setStatus(status: StreamStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }

  private open(): void {
    if (this.stopped) return;
    this.setStatus(this.status === 'idle' ? 'connecting' : 'reconnecting');

    let source: EventSource;
    try {
      source = new EventSource(this.url, { withCredentials: true });
    } catch (error) {
      this.setStatus('error');
      this.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    this.source = source;

    source.addEventListener('open', () => {
      this.setStatus('open');
      this.armWatchdog();
    });

    source.addEventListener('error', () => {
      if (this.stopped) return;
      // readyState CLOSED means the browser gave up; CONNECTING means it is
      // already retrying on its own.
      this.setStatus(source.readyState === EventSource.CLOSED ? 'reconnecting' : 'reconnecting');
      this.onError(new Error('The live event stream was interrupted. Reconnecting…'));
      if (source.readyState === EventSource.CLOSED) {
        this.source = null;
        this.scheduleReopen();
      }
    });

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (event) => {
        this.handleFrame(type, event as MessageEvent<string>);
      });
    }
  }

  private handleFrame(type: string, event: MessageEvent<string>): void {
    const lastEventId = event.lastEventId ?? '';
    if (lastEventId.length > 0) {
      const key = `${type}:${lastEventId}`;
      if (this.seen.has(key)) return;
      this.seen.add(key);
      this.seenOrder.push(key);
      while (this.seenOrder.length > MAX_SEEN_IDS) {
        const oldest = this.seenOrder.shift();
        if (oldest !== undefined) this.seen.delete(oldest);
      }
    }

    let raw: unknown;
    try {
      raw = JSON.parse(event.data) as unknown;
    } catch {
      return;
    }

    const parsed = serverEventSchema.safeParse(raw);
    if (!parsed.success) return;
    this.onEvent(parsed.data);
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      if (this.stopped) return;
      if (this.source && this.source.readyState === EventSource.OPEN) return;
      // The browser is stuck in CONNECTING: rebuild the connection.
      this.source?.close();
      this.source = null;
      this.open();
    }, RECONNECT_WATCHDOG_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  private scheduleReopen(): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.open();
    }, 2_000);
  }
}
