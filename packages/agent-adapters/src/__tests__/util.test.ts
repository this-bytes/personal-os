/**
 * The executable lookup, on its own.
 *
 * The lookup is what an adapter's `connect()` waits for before it can say
 * whether it can chat, so it is worth pinning on its own: what it finds, and
 * the order it finds it in. The order matters because a lookup that answered
 * with the second match on PATH would run a different command than the one
 * the owner named.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveExecutable } from '../util.js';

const originalPath = process.env['PATH'];
const temporaryDirs: string[] = [];

afterEach(() => {
  if (originalPath === undefined) delete process.env['PATH'];
  else process.env['PATH'] = originalPath;
  for (const dir of temporaryDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * The name the lookup looks for.
 *
 * On Windows the lookup tries each extension in PATHEXT, so the file that
 * answers to a name carries the first of them. On POSIX there is no extension
 * and the name is the name.
 */
function candidateName(name: string): string {
  if (process.platform !== 'win32') return name;
  const extension = (process.env['PATHEXT'] ?? '.EXE').split(';').filter(Boolean)[0] ?? '.EXE';
  return name + extension;
}

/** A directory holding something that answers to `name`. */
function directoryWith(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-resolve-'));
  temporaryDirs.push(dir);
  const file = path.join(dir, candidateName(name));
  fs.writeFileSync(file, 'not really a command', 'utf8');
  // The lookup asks whether the file can be run, so it has to be runnable.
  fs.chmodSync(file, 0o755);
  return dir;
}

describe('finding an executable on PATH', () => {
  it('finds a command that is there', async () => {
    const dir = directoryWith('pos-probe-tool');
    process.env['PATH'] = [dir, originalPath].filter(Boolean).join(path.delimiter);

    expect(await resolveExecutable('pos-probe-tool')).toBe(
      path.join(dir, candidateName('pos-probe-tool')),
    );
  });

  it('answers null for a command that is not there', async () => {
    const dir = directoryWith('pos-probe-tool');
    process.env['PATH'] = [dir, originalPath].filter(Boolean).join(path.delimiter);

    expect(await resolveExecutable('pos-probe-tool-that-is-not-there')).toBeNull();
  });

  it('takes the first one on PATH, the way a shell would', async () => {
    const first = directoryWith('pos-probe-tool');
    const second = directoryWith('pos-probe-tool');
    process.env['PATH'] = [first, second, originalPath].filter(Boolean).join(path.delimiter);

    expect(await resolveExecutable('pos-probe-tool')).toBe(
      path.join(first, candidateName('pos-probe-tool')),
    );
  });

  it('takes a command with a separator as it is', async () => {
    const dir = directoryWith('pos-probe-tool');
    const file = path.join(dir, candidateName('pos-probe-tool'));

    expect(await resolveExecutable(file)).toBe(file);
    expect(await resolveExecutable(path.join(dir, 'not-there'))).toBeNull();
  });
});
