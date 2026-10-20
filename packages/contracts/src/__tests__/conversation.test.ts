import { describe, expect, it } from 'vitest';
import {
  contentToText,
  extractMentionTokens,
  resolveMentions,
  type ContentPart,
} from '../index.js';

describe('mention extraction', () => {
  it('finds mentions at the start, middle and end of a message', () => {
    expect(extractMentionTokens('@Codex please look at this')).toEqual(['Codex']);
    expect(extractMentionTokens('hey @Codex and @OpenClaw, thoughts?')).toEqual([
      'Codex',
      'OpenClaw',
    ]);
  });

  it('ignores email-like text that is not a mention', () => {
    expect(extractMentionTokens('write to user@example.com')).toEqual([]);
  });

  it('de-duplicates repeated mentions', () => {
    expect(extractMentionTokens('@Echo @Echo @Echo')).toEqual(['Echo']);
  });
});

describe('mention resolution', () => {
  const participants = [
    { id: 'p1', displayName: 'Echo', agentConnectionId: 'a1' },
    { id: 'p2', displayName: 'Hermes CTO', agentConnectionId: 'a2' },
    { id: 'p3', displayName: 'Owner' },
  ];

  it('matches a mention against the display name', () => {
    const resolved = resolveMentions('@Echo status?', participants);
    expect(resolved.map((p) => p.id)).toEqual(['p1']);
  });

  it('matches a single word of a multi-word display name', () => {
    const resolved = resolveMentions('@CTO take a look', participants);
    expect(resolved.map((p) => p.id)).toEqual(['p2']);
  });

  it('is case insensitive', () => {
    const resolved = resolveMentions('@echo status?', participants);
    expect(resolved.map((p) => p.id)).toEqual(['p1']);
  });

  it('returns nothing when nobody is mentioned', () => {
    expect(resolveMentions('no mentions here', participants)).toEqual([]);
  });
});

describe('content projection', () => {
  it('joins text parts and ignores other kinds', () => {
    const content: ContentPart[] = [
      { type: 'text', text: 'first' },
      { type: 'artifact', resourceId: 'res_1' },
      { type: 'text', text: 'second' },
    ];
    expect(contentToText(content)).toBe('first\nsecond');
  });
});
