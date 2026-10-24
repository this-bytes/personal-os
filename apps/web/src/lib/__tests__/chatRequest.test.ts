import { describe, expect, it } from 'vitest';
import { messageRequest } from '../chat';

/**
 * What a message carries.
 *
 * The message points at the resource the upload became, and the kind of thing
 * it points at is what the panel draws: a picture is a picture in the
 * transcript, and the bytes are read from the resource.
 */

describe('the message the composer sends', () => {
  it('carries the owner\'s words', () => {
    const request = messageRequest('What does it say?', {
      delivery: 'queue',
      attachments: [],
    });

    expect(request.content).toEqual([{ type: 'text', text: 'What does it say?' }]);
  });

  it('carries a file as a reference to its resource', () => {
    const request = messageRequest('Read it', {
      delivery: 'queue',
      attachments: [
        { resourceId: 'res_1', displayName: 'notes.txt', mimeType: 'text/plain' },
      ],
    });

    expect(request.content).toEqual([
      { type: 'text', text: 'Read it' },
      { type: 'file', resourceId: 'res_1' },
    ]);
  });

  it('carries a picture as a picture, and not as a file', () => {
    const request = messageRequest('What does it say?', {
      delivery: 'queue',
      attachments: [
        { resourceId: 'res_1', displayName: 'marker.png', mimeType: 'image/png' },
      ],
    });

    // The panel draws an image part as the picture, and the bytes are read
    // from the resource. A row that says a file's name is not that.
    expect(request.content[1]).toEqual({
      type: 'image',
      resourceId: 'res_1',
      displayName: 'marker.png',
      mimeType: 'image/png',
      url: '/api/resources/res_1/content',
    });
  });

  it('carries a file and a picture as the two things they are', () => {
    const request = messageRequest('Read both', {
      delivery: 'queue',
      attachments: [
        { resourceId: 'res_1', displayName: 'notes.txt', mimeType: 'text/plain' },
        { resourceId: 'res_2', displayName: 'marker.png', mimeType: 'image/png' },
      ],
    });

    expect(request.content.map((part) => part.type)).toEqual(['text', 'file', 'image']);
  });

  it('carries the delivery mode with the message', () => {
    const request = messageRequest('Now', { delivery: 'steer', attachments: [] });

    expect(request.delivery).toBe('steer');
  });
});
