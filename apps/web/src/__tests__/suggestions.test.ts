// The prompts an empty room offers.
//
// The function is pure, so the rule it follows can be tested here rather than
// in a browser: a room with no agents offers no mention, a room with one names
// it, and every prompt is an opening any agent can answer.

import { describe, expect, it } from 'vitest';
import type { Participant } from '@personal-os/contracts';
import { starterSuggestions } from '../lib/suggestions';

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: 'prt_1',
    conversationId: 'cnv_1',
    displayName: 'Cog',
    type: 'agent',
    agentConnectionId: 'agt_1',
    ...overrides,
  };
}

describe('the prompts an empty room offers', () => {
  it('names a participant of the room, so the room has somebody to ask', () => {
    const prompts = starterSuggestions([participant({ displayName: 'Cog' })]);

    expect(prompts[0]).toBe('@Cog, what can you do in this room?');
  });

  it('names no one when the room has no agent to name', () => {
    const prompts = starterSuggestions([
      participant({ type: 'human', displayName: 'Aaron', agentConnectionId: undefined }),
    ]);

    expect(prompts.some((prompt) => prompt.includes('@'))).toBe(false);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('offers openings, and every one of them is a complete utterance', () => {
    const prompts = starterSuggestions([participant()]);

    expect(prompts.length).toBe(4);
    for (const prompt of prompts) {
      // Three of them ask; the last one asks for a summary. All of them are
      // finished, so none of them reads as a fragment.
      expect(prompt.endsWith('?') || prompt.endsWith('.')).toBe(true);
    }
    expect(prompts.some((prompt) => prompt.endsWith('?'))).toBe(true);
  });

  it('says what it does not know, rather than what it cannot do', () => {
    // A prompt is an opening. It does not claim the agent can read a file or
    // run a command, because the agent may not be able to.
    const prompts = starterSuggestions([participant()]);

    for (const prompt of prompts) {
      expect(prompt).not.toMatch(/can (read|write|run|execute|deploy)/i);
    }
  });

  it('is the same every time, so a room that reloads does not reshuffle them', () => {
    const room = [participant()];

    expect(starterSuggestions(room)).toEqual(starterSuggestions(room));
  });
});
