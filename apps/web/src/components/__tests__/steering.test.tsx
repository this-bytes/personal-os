import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messageRequest } from '../../lib/chat';
import { Composer } from '../Composer';

/**
 * Steering, from the composer's side.
 *
 * The owner picks a delivery, and the mode has to reach the server with the
 * message: a steer that quietly became a queued message is a lie the owner
 * did not agree to. And a control that cannot be used says why.
 */

describe('the request the composer sends', () => {
  it('carries the delivery mode with the message', () => {
    const request = messageRequest('do it differently', {
      delivery: 'steer',
      attachments: [],
    });

    expect(request.delivery).toBe('steer');
    expect(request.content).toEqual([{ type: 'text', text: 'do it differently' }]);
  });

  it('carries an attachment as a reference to a resource', () => {
    const request = messageRequest('look at this', {
      delivery: 'queue',
      attachments: [{ resourceId: 'res_1' }],
    });

    expect(request.delivery).toBe('queue');
    expect(request.content).toEqual([
      { type: 'text', text: 'look at this' },
      { type: 'file', resourceId: 'res_1' },
    ]);
  });
});

describe('the composer', () => {
  const steerable = { available: true, reason: null };

  it('sends a steer with the message when the owner asks for one', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <Composer
        participants={[]}
        delivery="steer"
        steer={steerable}
        onSend={onSend}
        routingMode="mentions"
        depth={0}
        maxTurns={8}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Write a message/), {
      target: { value: 'do it differently' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send into the running turn' }));

    expect(onSend).toHaveBeenCalledWith('do it differently', {
      delivery: 'steer',
      attachments: [],
    });
  });

  it('will not send a steer the runtime cannot take', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <Composer
        participants={[]}
        delivery="steer"
        steer={{
          available: false,
          reason: 'That connection cannot take input while its turn is running.',
        }}
        onSend={onSend}
        routingMode="mentions"
        depth={0}
        maxTurns={8}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Write a message/), {
      target: { value: 'do it differently' },
    });
    const button = screen.getByRole('button', { name: 'Send into the running turn' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      'That connection cannot take input while its turn is running.',
    );
  });
});
