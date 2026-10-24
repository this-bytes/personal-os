import { describe, expect, it } from 'vitest';
import { buildTurnInput } from '../codex-app-server.js';

/**
 * The App Server route and a picture.
 *
 * The pinned protocol's `UserInput` takes an image by url or by file id, and a
 * local image by path. The route sends the bytes as a data url: a path is a
 * path on the runtime's machine, and the rule is that the content travels.
 */

/** The bytes of a picture, as the turn carries them. */
const BYTES = 'SU1BR0VSLU1BU0VS';

describe("the App Server route's turn input", () => {
  it('carries a picture as an image by url, with the bytes', () => {
    const items = buildTurnInput({
      conversationId: 'cnv_1',
      message: 'What does it say?',
      context: '',
      executionId: 'exe_1',
      parts: [
        {
          type: 'image',
          resourceId: 'res_1',
          filename: 'marker.png',
          mimeType: 'image/png',
          data: BYTES,
        },
      ],
    });

    const image = items.find((item) => item.type === 'image');
    expect(image?.type).toBe('image');
    expect(image?.url).toBe(`data:image/png;base64,${BYTES}`);
  });

  it('does not hand the runtime a path', () => {
    const items = buildTurnInput({
      conversationId: 'cnv_1',
      message: 'What does it say?',
      context: '',
      executionId: 'exe_1',
      parts: [
        {
          type: 'image',
          resourceId: 'res_1',
          filename: 'marker.png',
          mimeType: 'image/png',
          data: BYTES,
        },
      ],
    });

    // The protocol takes a local image by path, and the runtime would take it.
    // A path is a path on the runtime's machine, and this picture is not on
    // it, so the bytes travel instead.
    const image = items.find((item) => item.type === 'image');
    expect(image?.path).toBeUndefined();
    expect(JSON.stringify(items)).not.toContain('res_1');
  });

  it("carries the owner's words once", () => {
    const items = buildTurnInput({
      conversationId: 'cnv_1',
      message: 'What does it say?',
      context: '',
      executionId: 'exe_1',
      parts: [
        {
          type: 'image',
          resourceId: 'res_1',
          filename: 'marker.png',
          mimeType: 'image/png',
          data: BYTES,
        },
      ],
    });

    const texts = items.filter((item) => item.type === 'text');
    expect(texts).toHaveLength(1);
    expect(String(texts[0]?.text).match(/What does it say\?/g)).toHaveLength(1);
  });

  it('carries a file and a picture as the two items they are', () => {
    const items = buildTurnInput({
      conversationId: 'cnv_1',
      message: 'Read both',
      context: '',
      executionId: 'exe_1',
      parts: [
        {
          type: 'file',
          resourceId: 'res_1',
          filename: 'notes.txt',
          mimeType: 'text/plain',
          text: 'the file says hello',
        },
        {
          type: 'image',
          resourceId: 'res_2',
          filename: 'marker.png',
          mimeType: 'image/png',
          data: BYTES,
        },
      ],
    });

    // The protocol has no item for "a file with its content", so the file
    // travels as text that names it. The picture has an item of its own.
    expect(items.filter((item) => item.type === 'image')).toHaveLength(1);
    expect(
      items.filter((item) => typeof item.text === 'string' && item.text.includes('notes.txt')),
    ).toHaveLength(1);
  });
});
