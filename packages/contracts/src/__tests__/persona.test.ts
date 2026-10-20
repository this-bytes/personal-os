import { describe, expect, it } from 'vitest';
import { resolvePersona } from '../agent.js';

/**
 * The persona in force.
 *
 * Most specific first, whole entity: an override replaces the connection's
 * base rather than merging with it, so a conversation that sets only a role
 * does not silently keep the connection's instructions.
 */
describe('the persona in force', () => {
  it('is the conversation override when the conversation sets one', () => {
    const resolved = resolvePersona({
      override: { role: 'Conversation role' },
      base: { role: 'Connection role', instructions: 'Connection instructions' },
    });

    expect(resolved.source).toBe('conversation');
    expect(resolved.persona?.role).toBe('Conversation role');
  });

  it('replaces the base whole, and never merges it field by field', () => {
    const resolved = resolvePersona({
      override: { role: 'Conversation role' },
      base: { role: 'Connection role', instructions: 'Connection instructions' },
    });

    // A half-overridden persona is a stranger: the connection's
    // instructions do not survive the override.
    expect(resolved.persona?.instructions).toBeUndefined();
  });

  it('is the connection base when the conversation sets nothing', () => {
    const resolved = resolvePersona({
      base: { role: 'Connection role', instructions: 'Connection instructions' },
    });

    expect(resolved.source).toBe('connection');
    expect(resolved.persona).toEqual({
      role: 'Connection role',
      instructions: 'Connection instructions',
    });
  });

  it('falls through to the base when the override says nothing', () => {
    const resolved = resolvePersona({
      override: {},
      base: { role: 'Connection role' },
    });

    expect(resolved.source).toBe('connection');
    expect(resolved.persona?.role).toBe('Connection role');
  });

  it('is the runtime default when neither says anything', () => {
    const resolved = resolvePersona({});

    expect(resolved.source).toBe('default');
    expect(resolved.persona).toBeUndefined();
  });

  it('treats a persona that is only blank as no persona at all', () => {
    const resolved = resolvePersona({
      override: { role: '   ' },
      base: { role: 'Connection role' },
    });

    expect(resolved.source).toBe('connection');
  });
});
