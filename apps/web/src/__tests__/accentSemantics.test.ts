/** Current UI semantics; independent of retired design briefs and source-line counts. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../..');
const read = (file: string): string => readFileSync(file, 'utf8');

/** The text between two markers, or null when the first one is not there. */
function between(source: string, start: string, end: string): string | null {
  const from = source.indexOf(start);
  if (from < 0) return null;
  const to = source.indexOf(end, from + start.length);
  if (to < 0) return null;
  return source.slice(from, to);
}

/** The first line after a marker that carries something. */
function nextLine(source: string, marker: string): string | null {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const row = source
    .slice(at + marker.length)
    .split('\n')
    .find((line) => line.trim().length > 0);
  return row ?? null;
}

/** The badge variant on the element that carries a label. */
function badgeVariant(source: string, label: string): string | null {
  const at = source.indexOf(label);
  if (at < 0) return null;
  const before = [...source.slice(0, at).matchAll(/<Badge variant="([^"]+)"/g)];
  return before.length > 0 ? (before[before.length - 1]?.[1] ?? null) : null;
}

describe('decision and failure color semantics', () => {
  it('splits the one site that carried two meanings, and the accent stays on the review side', () => {
    const board = read(path.join(webRoot, 'src', 'components', 'TaskBoard.tsx'));

    // The badges. A task in review is waiting on the owner, so it wears the
    // accent; a task whose outcome is unknown is a caution, so it does not.
    expect(badgeVariant(board, 'awaiting acceptance'), 'the badge a task in review wears').toBe(
      'accent',
    );
    expect(
      badgeVariant(board, 'outcome unknown'),
      'the badge a task with an unknown outcome wears',
    ).not.toBe('accent');

    // The block both statuses share, and the split inside it. The accent has
    // to be somewhere: a rule that forbids a colour and never says where it
    // goes is a rule that erodes from the other side.
    const block = between(
      board,
      "{task.status === 'review' || task.status === 'unknown' ? (",
      ') : null}',
    );
    expect(block, 'the acceptance decision block is gone').not.toBeNull();
    const split = /task\.status === 'review'\s*\?\s*'([^']*)'\s*:\s*'([^']*)'/.exec(block ?? '');
    expect(split, 'the acceptance block no longer splits on the review status').not.toBeNull();
    expect(
      split?.[1],
      'a task in review is waiting on the owner, so its half of the block wears the accent',
    ).toMatch(/accent-/);
    expect(
      split?.[2],
      'a task whose outcome is unknown is a caution, so its half of the block does not',
    ).not.toMatch(/accent-/);
  });

  it('sends the two failures it named to the error colour', () => {
    // The routing-blocked notice: the message was not delivered. It failed.
    const detail = read(path.join(webRoot, 'src', 'pages', 'ConversationDetail.tsx'));
    const blocked = nextLine(detail, 'routingNotice.routing.blocked');
    expect(blocked, 'the routing-blocked notice is gone').not.toBeNull();
    expect(blocked, 'the routing-blocked notice wears the error colour').toMatch(/\berr\b/);
    expect(blocked, 'the routing-blocked notice does not wear the accent').not.toMatch(/accent-/);

    // The revision conflict: the save cannot land. It failed.
    const editor = read(path.join(webRoot, 'src', 'components', 'ResourceEditor.tsx'));
    const conflict = between(editor, '{conflict ? (', ') : null}');
    expect(conflict, 'the revision-conflict notice is gone').not.toBeNull();
    expect(conflict, 'the revision conflict wears the error colour').toMatch(/\berr\b/);
    expect(conflict, 'the revision conflict does not wear the accent').not.toMatch(/accent-/);
  });
});
