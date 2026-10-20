import { describe, expect, it } from 'vitest';
import {
  AGENT_MEMORY_CONTEXT_BUDGET,
  PINNED_MEMORY_TAG,
  buildAgentMemoryBrief,
  memorySpecSchema,
  orderAgentMemories,
  type AgentMemoryEntry,
} from '../resource.js';

/**
 * The agent memory scope.
 *
 * A memory belongs to a workspace, a conversation, a goal — or to an agent.
 * The scope names are ours: nothing imports a plugin's scope vocabulary.
 */
describe('the agent memory scope', () => {
  it('accepts a memory scoped to an agent that names the agent', () => {
    const parsed = memorySpecSchema.parse({
      scope: 'agent',
      agentConnectionId: 'agt_1',
      key: 'note',
      value: 'the owner prefers sources',
    });

    expect(parsed.scope).toBe('agent');
    expect(parsed.agentConnectionId).toBe('agt_1');
  });

  it('refuses a memory scoped to an agent that names nobody', () => {
    const parsed = memorySpecSchema.safeParse({ scope: 'agent', key: 'note', value: 'x' });

    expect(parsed.success).toBe(false);
  });

  it('leaves the other scopes exactly as they were', () => {
    const parsed = memorySpecSchema.parse({ scope: 'workspace', key: 'note', value: 'x' });

    expect(parsed.scope).toBe('workspace');
    expect(parsed.agentConnectionId).toBeUndefined();
  });

  it('still defaults to the workspace scope', () => {
    const parsed = memorySpecSchema.parse({ key: 'note', value: 'x' });

    expect(parsed.scope).toBe('workspace');
  });
});

describe("the order of an agent's memories", () => {
  it('puts the pinned ones first, then the most recent', () => {
    const entries: AgentMemoryEntry[] = [
      { key: 'older', value: 'a', tags: [], updatedAt: '2026-01-01T00:00:00.000Z' },
      { key: 'newer', value: 'b', tags: [], updatedAt: '2026-03-01T00:00:00.000Z' },
      {
        key: 'pinned',
        value: 'c',
        tags: [PINNED_MEMORY_TAG],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    expect(orderAgentMemories(entries).map((entry) => entry.key)).toEqual([
      'pinned',
      'newer',
      'older',
    ]);
  });
});

describe('the brief an agent reads', () => {
  it('carries the memory in the text', () => {
    const brief = buildAgentMemoryBrief([
      { key: 'prefers', value: 'sources', tags: [], updatedAt: '2026-03-01T00:00:00.000Z' },
    ]);

    expect(brief.text).toContain('prefers: sources');
    expect(brief.used).toBe(brief.text.length);
    expect(brief.dropped).toBe(0);
  });

  it('stays within the budget', () => {
    const entries: AgentMemoryEntry[] = Array.from({ length: 10 }, (_, index) => ({
      key: `memory-${index}`,
      value: 'x'.repeat(2_000),
      tags: [],
      updatedAt: '2026-03-01T00:00:00.000Z',
    }));

    const brief = buildAgentMemoryBrief(entries);

    expect(brief.used).toBeLessThanOrEqual(AGENT_MEMORY_CONTEXT_BUDGET);
    expect(brief.dropped).toBeGreaterThan(0);
  });

  it('leaves out what does not fit rather than cutting it in half', () => {
    const brief = buildAgentMemoryBrief([
      { key: 'small', value: 'a', tags: [], updatedAt: '2026-03-01T00:00:00.000Z' },
      {
        key: 'huge',
        value: 'x'.repeat(AGENT_MEMORY_CONTEXT_BUDGET),
        tags: [],
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    ]);

    expect(brief.entries.map((entry) => entry.key)).toEqual(['small']);
    expect(brief.text).not.toContain('huge');
    expect(brief.dropped).toBe(1);
  });

  it('keeps a pinned memory when the newer ones would fill the budget', () => {
    const brief = buildAgentMemoryBrief([
      {
        key: 'pinned',
        value: 'p',
        tags: [PINNED_MEMORY_TAG],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      { key: 'newer', value: 'n', tags: [], updatedAt: '2026-03-01T00:00:00.000Z' },
    ]);

    expect(brief.entries.map((entry) => entry.key)).toEqual(['pinned', 'newer']);
  });
});
