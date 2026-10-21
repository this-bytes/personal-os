import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '@personal-os/contracts';
import { ChatMessageList } from '../ChatMessageList';

/**
 * The reason reaches the panel.
 *
 * When the owner closes a turn they were told to check, the server produces a
 * sentence about what they concluded and puts it on the message. The client
 * shows it as it is given: the account of what happened is the server's, and a
 * client that reworded it would be telling the owner something the server knows
 * better.
 *
 * These two cases pin that from both sides. The first says the server's words
 * are on screen, word for word — a client that prefaced, shortened or rephrased
 * the sentence would not find it. The second says nothing is put in their
 * place: a client that invented an account of its own when the server gave none
 * would fail here.
 */

const SENTENCE = 'You checked this turn: it did run, so the reply is recorded as complete.';

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg_1',
    conversationId: 'cnv_1',
    senderId: 'p_1',
    targetParticipantIds: [],
    kind: 'text',
    content: [{ type: 'text', text: 'The agent started and then stopped.' }],
    createdAt: '2026-10-21T00:00:00.000Z',
    status: 'complete',
    ...overrides,
  };
}

function renderList(messages: Message[]): void {
  render(<ChatMessageList messages={messages} participants={[]} agents={[]} streaming={[]} />);
}

describe('the reason reaches the panel', () => {
  it('shows the sentence the server produced, as it is given', () => {
    renderList([message({ detail: SENTENCE })]);

    // Exactly the server's words: an element whose text is the sentence and
    // nothing else.
    const shown = screen.getByText(SENTENCE);
    expect(shown).toBeInTheDocument();
    expect(shown.textContent).toBe(SENTENCE);
  });

  it('shows no account of its own when the server gave none', () => {
    renderList([message()]);

    expect(screen.queryByText(/it did run|it did not run/i)).toBeNull();
    expect(screen.queryByText(/checked this turn/i)).toBeNull();
    // The reply itself is still shown — only the account of it is absent.
    expect(screen.getByText('The agent started and then stopped.')).toBeInTheDocument();
  });
});
