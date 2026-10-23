/** Small shared helpers used by the built-in adapters. */

import type {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  SpawnOptions,
} from 'node:child_process';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

/**
 * Start a command in a way that works on every platform.
 *
 * **On Windows an npm-installed CLI is a `.cmd` shim**, and a child process
 * may not start one on its own: the command interpreter is what runs it. So
 * a shim is started through `ComSpec`, with the arguments quoted, so that a
 * path with a space in it stays one argument and the prompt still arrives on
 * standard input.
 *
 * A `%` inside an argument is still read as a variable reference by the
 * interpreter. The arguments here are the owner's own configuration, and the
 * owner's message travels on standard input rather than on the command line.
 */
export function spawnExecutable(
  executable: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
): ChildProcessWithoutNullStreams {
  const base = {
    cwd: options.cwd ?? process.cwd(),
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'] as SpawnOptions['stdio'],
    shell: false,
    windowsHide: true,
  };

  const isShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
  if (!isShim) {
    return spawn(executable, args, base) as ChildProcessWithoutNullStreams;
  }

  const comspec = process.env['ComSpec'] ?? 'cmd.exe';
  const line = [executable, ...args].map(quoteForCmd).join(' ');
  // The arguments are passed verbatim: the interpreter is the one that parses
  // this line, and a second round of quoting would only split an argument
  // that was meant to stay whole.
  return spawn(comspec, ['/d', '/s', '/c', `"${line}"`], {
    ...base,
    windowsVerbatimArguments: true,
  }) as ChildProcessWithoutNullStreams;
}

/** Quote one argument for the Windows command interpreter. */
function quoteForCmd(argument: string): string {
  if (argument.length === 0) return '""';
  if (!/[\s"]/.test(argument)) return argument;
  const escaped = argument.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
  return `"${escaped}"`;
}

/**
 * Locate an executable on PATH without spawning it.
 *
 * Windows resolves a command through PATHEXT, so `codex` is `codex.cmd` there
 * and `codex.ps1` beside it. The lookup never runs the command: an adapter
 * that is asked whether it can connect should not start a process to find out.
 */
export async function resolveExecutable(command: string): Promise<string | null> {
  const hasSeparator = command.includes('/') || command.includes('\\');
  if (hasSeparator) {
    try {
      await access(command, constants.X_OK);
      return command;
    } catch {
      return null;
    }
  }

  const pathValue = process.env['PATH'] ?? '';
  const extensions =
    process.platform === 'win32'
      ? (process.env['PATHEXT'] ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : [''];

  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, command + extension);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return null;
}

/**
 * Stop a child process and wait until it is really gone.
 *
 * The wait is the point. A kill that is not waited for is a request, and a
 * caller that returns before the child has exited leaves a process behind —
 * which is how a finished turn ends up owning a stray agent. A process that
 * ignores the first signal is killed outright, and even that is waited for.
 */
export async function terminateChild(child: ChildProcess, graceMs = 2_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  let settle: () => void = () => undefined;
  const exited = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const onExit = () => settle();
  child.once('close', onExit);
  child.once('error', onExit);

  try {
    child.kill('SIGTERM');
    const escalation = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // The process is already gone; nothing left to kill.
      }
    }, graceMs);
    escalation.unref?.();

    // A child that cannot be killed must not hang the caller either.
    const guard = setTimeout(() => settle(), graceMs + 5_000);
    guard.unref?.();

    await exited;
    clearTimeout(escalation);
    clearTimeout(guard);
  } finally {
    child.off('close', onExit);
    child.off('error', onExit);
  }
}

/**
 * Build a minimal environment for a supervised child process.
 *
 * Server secrets are never inherited; only an explicit allow-list plus the
 * values the owner configured. The CLI adapter and the MCP adapter both start
 * a child process, so the rule lives in one place — a second copy is a second
 * chance to leak.
 */
export function buildSanitizedEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const keep = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'TMPDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'SystemRoot',
    'ComSpec',
    'PATHEXT',
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of keep) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  for (const [key, value] of Object.entries(extra)) {
    env[key] = value;
  }
  return env;
}

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

/**
 * Replace `{{name}}` placeholders in a JSON document.
 *
 * The templates the adapters publish are JSON documents — a tool's arguments
 * and an HTTP request's body — so a value that goes into one has to be
 * escaped for it. A message with a newline in it is ordinary text, and
 * substituting it raw makes the document invalid: the turn then fails on the
 * way to the tool, with a complaint about the template rather than about the
 * message.
 *
 * Whether a value is escaped depends on where it lands. Inside a JSON string
 * literal the value is text, and it is escaped. Anywhere else it is part of
 * the document's structure — a number, a boolean — and it is substituted as
 * it is, because quoting it would change the document's shape.
 */
export function interpolateJson(template: string, vars: Record<string, string>): string {
  const placeholder = /\{\{\s*([\w.-]+)\s*\}\}/g;
  let out = '';
  let inString = false;
  let index = 0;

  while (index < template.length) {
    const char = template[index];

    if (inString && char === '\\') {
      // An escape belongs to the template, not to the value.
      out += char + (template[index + 1] ?? '');
      index += 2;
      continue;
    }

    placeholder.lastIndex = index;
    const match = placeholder.exec(template);
    if (match && match.index === index) {
      const value = vars[match[1]!];
      out += value === undefined ? match[0] : inString ? escapeJson(value) : value;
      index += match[0].length;
      continue;
    }

    if (char === '"') inString = !inString;
    out += char;
    index += 1;
  }

  return out;
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
