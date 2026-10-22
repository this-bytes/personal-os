import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Composer } from '../Composer';

/**
 * A file the owner attaches to a message.
 *
 * The composer reads the file, sends it, and attaches the resource the
 * server answers with — the same shape of attachment the owner gets from
 * picking a resource that already exists.
 */

vi.mock('../../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'wsp_1' }),
}));

const RESOURCE = {
  id: 'res_file',
  workspaceId: 'wsp_1',
  type: 'document',
  schemaVersion: 1,
  revision: 1,
  title: 'notes.txt',
  data: { kind: 'file', filename: 'notes.txt', mimeType: 'text/plain', size: 2 },
  createdBy: 'usr_1',
  updatedAt: '2026-10-23T00:00:00.000Z',
};

/** A reply from the server, in the shape the API answers with. */
function reply(status: number, body: unknown): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The file the owner chose. */
function chosenFile(): File {
  return new File([new Uint8Array([104, 105])], 'notes.txt', { type: 'text/plain' });
}

/** Choose a file, the way the owner does. */
async function choose(file: File): Promise<void> {
  const input = screen.getByLabelText('Choose a file to upload');
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(input).toBeInTheDocument());
}

describe('the composer uploads a file', () => {
  it('sends the file and attaches the resource the server answers with', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      reply(201, { resource: RESOURCE }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onSend = vi.fn(
      (
        _text: string,
        _options: {
          delivery: string;
          attachments: { resourceId: string; displayName: string; mimeType?: string }[];
        },
      ) => {},
    );

    render(<Composer participants={[]} onSend={onSend} />);
    await choose(chosenFile());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/resources/upload');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(body.workspaceId).toBe('wsp_1');
    expect(body.filename).toBe('notes.txt');
    expect(body.mimeType).toBe('text/plain');
    expect(body.contentBase64).toBe(btoa('hi'));

    // The resource the server answered with is attached, by reference.
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Send message'));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    expect(onSend.mock.calls[0]?.[1].attachments).toEqual([
      { resourceId: 'res_file', displayName: 'notes.txt', mimeType: 'text/plain' },
    ]);
  });

  it("shows the server's sentence when the upload is refused", async () => {
    const sentence = 'That file is larger than the 10 MB this panel accepts.';
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      reply(422, { error: { code: 'validation_failed', message: sentence } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Composer participants={[]} onSend={vi.fn()} />);
    await choose(chosenFile());

    // The server's words, word for word.
    await waitFor(() => expect(screen.getByText(sentence)).toBeInTheDocument());
    expect(screen.queryByText('notes.txt')).toBeNull();
  });
});
