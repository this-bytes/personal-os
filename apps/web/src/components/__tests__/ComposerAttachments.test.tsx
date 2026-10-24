import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '../Composer';

/**
 * A room that cannot carry an attachment.
 *
 * A file the owner attaches and the runtime never sees is a file the owner
 * believes was read. The composer refuses it, and says which agent cannot take
 * it.
 */

vi.mock('../../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'wsp_1' }),
}));

describe('the composer and attachments', () => {
  it('refuses the file when the room cannot carry one, and says why', () => {
    render(
      <Composer
        participants={[]}
        onSend={vi.fn()}
        attachments={{
          available: false,
          reason: 'OpenCode cannot take an attachment on this route.',
        }}
      />,
    );

    expect(screen.getByLabelText('Upload a file')).toBeDisabled();
    expect(screen.getByLabelText('Attach a resource')).toBeDisabled();
    // The reason is on screen, not only in a tooltip.
    expect(
      screen.getByText('OpenCode cannot take an attachment on this route.'),
    ).toBeInTheDocument();
  });

  it('offers the file when the room can carry one', () => {
    render(
      <Composer
        participants={[]}
        onSend={vi.fn()}
        attachments={{ available: true, reason: null }}
      />,
    );

    expect(screen.getByLabelText('Upload a file')).toBeEnabled();
    expect(screen.getByLabelText('Attach a resource')).toBeEnabled();
  });
});
