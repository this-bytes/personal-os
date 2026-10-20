/** Small shared helpers used by the built-in adapters. */

/** Read a dotted path out of an unknown JSON value: `a.b.0.c`. */
export function getByPath(source: unknown, path: string): unknown {
  if (!path) return source;
  const segments = path.split('.').filter((s) => s.length > 0);
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Coerce a JSON value into plain text where that is meaningful. */
export function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['text'] === 'string') return record['text'];
    if (typeof record['content'] === 'string') return record['content'];
    if (Array.isArray(record['parts'])) return asText(record['parts']);
    return JSON.stringify(value);
  }
  return '';
}

/** Replace `{{name}}` placeholders. Unknown placeholders are left untouched. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : value;
  });
}

/** Escape a string for safe inclusion in a JSON document. */
export function escapeJson(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/**
 * Split text into streaming chunks that respect word boundaries.
 * Keeps token counts sane while avoiding mid-word cuts for short words.
 */
export function chunkText(text: string, size = 64): string[] {
  if (text.length === 0) return [];
  const chunks: string[] = [];
  let index = 0;
  while (index < text.length) {
    let end = Math.min(index + size, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > index + size / 2) end = space;
    }
    chunks.push(text.slice(index, end));
    index = end;
  }
  return chunks;
}

/** Read an SSE stream into discrete events. */
export async function* readSseEvents(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<{ event?: string; data: string }> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName: string | undefined;
  let dataLines: string[] = [];

  const flush = function* (): Generator<{ event?: string; data: string }> {
    if (dataLines.length > 0) {
      yield { event: eventName, data: dataLines.join('\n') };
    }
    eventName = undefined;
    dataLines = [];
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        if (line === '') {
          yield* flush();
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }
    if (buffer.length > 0) {
      const line = buffer.replace(/\r$/, '');
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    yield* flush();
  } finally {
    reader.releaseLock();
  }
}

/** Parse a JSON payload, tolerating the `[DONE]` sentinel used by SSE APIs. */
export function parseSseData(data: string): unknown {
  const trimmed = data.trim();
  if (trimmed === '' || trimmed === '[DONE]') return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
