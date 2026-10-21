#!/usr/bin/env node
/**
 * What the factory's concurrency ceiling is, and why it is not a setting.
 *
 * The MiniMax Bot Mini App's dispatcher hard-codes `const MAX_RUNNING = 2`, so
 * the factory runs two tasks at once no matter how many bots are on the
 * roster. On 2026-10-21 that was half the factory, and it is the reason a
 * long run cannot use its budget: the slots, not the money, are the constraint.
 *
 * ## Why this is not just an edit away
 *
 * The obvious fix is to edit the constant and restart. That does not work, and
 * it fails in a way that costs a restart cycle:
 *
 *   1. The runtime lives in the official plugin's cache, under a directory
 *      named for the hash of its contents —
 *      `~/.minimax/v2/plugin-cache/official/sha256-tree-v1-<hash>/`.
 *   2. The host hashes the package to decide whether the candidate it is about
 *      to run is the candidate it prepared. Editing a file changes that hash,
 *      and the runtime refuses to start with `CANDIDATE_CHANGED`.
 *   3. Even with the file restored, the host still refuses to start if the
 *      package tree contains an EXTRA file — a `.orig` backup left next to the
 *      patched file is enough. That is a separate failure with the same error.
 *
 * So: **the cache is not the place to change this.** The supported path is a
 * local copy under a new plugin id (the host's own hint: "Official Plugins do
 * not support local editing or republishing ... use a new pluginId and the
 * local Creator workflow to save a local copy"). That also means the bot
 * team's liveboard — its roster, memories and chat history — would move to a
 * different directory and need copying across, and the MCP endpoint name
 * would change with it. That is a decision for the owner, not a silent edit.
 *
 * ## What this script does
 *
 * It reports the ceiling and the state of the queue, and it explains the
 * constraint. It deliberately does not patch the cache: patching it breaks the
 * runtime, and a script that quietly breaks the factory is worse than no
 * script.
 *
 * Usage: node scripts/raise-factory-concurrency.mjs [--slots N]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const slotsIndex = argv.indexOf('--slots');
const requested = slotsIndex >= 0 ? Number(argv[slotsIndex + 1]) : null;

function findDispatchers() {
  const cacheRoot = join(homedir(), '.minimax', 'v2', 'plugin-cache', 'official');
  if (!existsSync(cacheRoot)) return [];
  const found = [];
  for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(cacheRoot, entry.name, 'miniapp', 'node', 'task-dispatcher.mjs');
    if (existsSync(candidate)) found.push(candidate);
  }
  return found;
}

function readState() {
  const path = join(
    homedir(),
    '.minimax',
    'v2',
    'plugin-data',
    'liveboards',
    'minimax-bot',
    'state.json',
  );
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const dispatchers = findDispatchers();
if (dispatchers.length === 0) {
  console.error('No task-dispatcher.mjs found under the plugin cache. Is the Mini App installed?');
  process.exit(1);
}

console.log('Factory concurrency\n');

for (const path of dispatchers) {
  const source = readFileSync(path, 'utf8');
  const match = source.match(/const MAX_RUNNING = (\d+)/);
  const current = match ? Number(match[1]) : null;
  console.log(`  ceiling      ${current}`);
  console.log(`  dispatcher   ${path}`);
  if (requested !== null && current !== requested) {
    console.log(
      `\n  ${current} -> ${requested} is NOT applied by this script. The host hashes the`,
    );
    console.log('  plugin package and refuses to start a runtime whose contents changed');
    console.log('  (CANDIDATE_CHANGED). Patching the cache breaks the factory.');
  }
}

const state = readState();
if (state) {
  const tasks = (state.taskBatches ?? []).flatMap((batch) => batch.tasks ?? []);
  const byStatus = {};
  for (const task of tasks) byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
  const running = tasks.filter((task) => task.status === 'running');
  const queued = tasks.filter((task) => task.status === 'queued');

  console.log('\n  task states');
  for (const [status, count] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(4)}  ${status}`);
  }
  console.log(`\n  running (${running.length})`);
  for (const task of running) {
    const minutes = task.startedAt ? Math.round((Date.now() - task.startedAt) / 60000) : '?';
    console.log(`    ${task.id}  ${task.botId}  ${minutes}m  ${String(task.title).slice(0, 60)}`);
  }
  console.log(`\n  queued (${queued.length})`);
  for (const task of queued.slice(0, 12)) {
    console.log(`    ${task.id}  ${task.botId}  ${String(task.title).slice(0, 60)}`);
  }
  if (queued.length > 12) console.log(`    ... and ${queued.length - 12} more`);
}

console.log('\nThe ceiling is a constant in the plugin, not a setting in this repository.');
console.log('Raising it means a local copy of the plugin under a new plugin id, and');
console.log("moving the bot team's liveboard across. That is the owner's decision.");
