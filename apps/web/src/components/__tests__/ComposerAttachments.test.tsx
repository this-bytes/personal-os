import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '../Composer';

/**
 * A room that cannot carry what the owner attaches.
 *
 * A file the owner attaches and the runtime never sees is a file the owner
 * believes was read. The composer refuses it, and says which agent cannot take
 * it.
 *
 * A picture is a separate verdict. A route that takes a file's words is not
 * thereby a route that takes a picture's bytes, and the panel says which agent
 * cannot take the picture.
 */

vi.mock('../../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'wsp_1' }),
}));

/** A room where nothing can be carried. */
const NOTHING = {
  available: false,
  reason: 'OpenCode cannot take an attachment on this route.',
  pictures: false,
  pictureReason: 'OpenCode cannot take a picture on this route.',
};

/** A room where everything can be carried. */
const EVERYTHING = {
  available: true,
  reason: null,
  pictures: true,
  pictureReason: null,
};

describe('the composer and attachments', () => {
  it('refuses the file when the room cannot carry one, and says why', () => {
    render(<Composer participants={[]} onSend={vi.fn()} attachments={NOTHING} />);

    expect(screen.getByLabelText('Upload a file')).toBeDisabled();
    expect(screen.getByLabelText('Attach a resource')).toBeDisabled();
    // The reason is on screen, not only in a tooltip.
    expect(
      screen.getByText('OpenCode cannot take an attachment on this route.'),
    ).toBeInTheDocument();
  });

  it('offers the file when the room can carry one', () => {
    render(<Composer participants={[]} onSend={vi.fn()} attachments={EVERYTHING} />);

    expect(screen.getByLabelText('Upload a file')).toBeEnabled();
    expect(screen.getByLabelText('Attach a resource')).toBeEnabled();
  });

  it('refuses a picture the room cannot carry, and says why', () => {
    render(
      <Composer
        participants={[]}
        onSend={vi.fn()}
        attachments={{
          ...EVERYTHING,
          pictures: false,
          pictureReason: 'OpenCode cannot take a picture on this route.',
        }}
      />,
    );

    // The room can take a file's words, so the upload is offered.
    expect(screen.getByLabelText('Upload a file')).toBeEnabled();

    const file = new File([new Uint8Array([1, 2, 3])], 'marker.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose a file to upload'), {
      target: { files: [file] },
    });

    // The picture is refused, and the reason is the server's own.
    expect(screen.getByText('OpenCode cannot take a picture on this route.')).toBeInTheDocument();
  });

  it('offers the upload when the room can carry a picture but not a file', () => {
    render(
      <Composer
        participants={[]}
        onSend={vi.fn()}
        attachments={{ ...NOTHING, pictures: true, pictureReason: null }}
      />,
    );

    // A room that can take a picture still offers the upload: the refusal is
    // decided by what the owner picked.
    expect(screen.getByLabelText('Upload a file')).toBeEnabled();
    expect(screen.getByLabelText('Attach a resource')).toBeEnabled();
  });
});
