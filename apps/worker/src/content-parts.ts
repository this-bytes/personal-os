import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { resourceFiles, resources, type Database } from '@personal-os/server/db';
import type { AgentTurnPart, ContentPart } from '@personal-os/contracts';

/**
 * Why a file was left out of the turn.
 *
 * The two reasons are different and the agent is told the true one: a route
 * that cannot carry attachments says so, and a file whose bytes are not text
 * says that instead.
 */
export type LeftOutReason = 'the route cannot carry attachments' | 'the file is not text';

/** A file the turn could not carry, and why. */
export interface LeftOutFile {
  /** The name the owner gave it. */
  name: string;
  reason: LeftOutReason;
}

/**
 * The parts a turn carries.
 *
 * A file the owner attached is resolved here: the resource names it and the
 * store holds its bytes, and the turn carries the content, because an adapter
 * is given a reference it cannot follow.
 *
 * **The message's text is not here.** It crossed in the turn's message before
 * this existed, and carrying it twice would have the runtime read the owner's
 * words twice. What the text does not carry is the file.
 *
 * **A file whose bytes are not text is not carried.** Carrying bytes is each
 * protocol's own shape, and a route that cannot take them says so. The files
 * that were left out are named, with the reason, so the turn can say so rather
 * than let an agent answer as if it had read a file it never saw.
 */
export function resolveTurnParts(
  db: Database,
  content: ContentPart[],
  options: { carryAttachments: boolean },
): { parts: AgentTurnPart[]; leftOut: LeftOutFile[] } {
  const parts: AgentTurnPart[] = [];
  const leftOut: LeftOutFile[] = [];

  for (const part of content) {
    if (part.type !== 'file' && part.type !== 'attachment') continue;

    const resource = db
      .select({ title: resources.title })
      .from(resources)
      .where(eq(resources.id, part.resourceId))
      .get();
    const name =
      part.type === 'attachment' ? part.displayName : (resource?.title ?? part.resourceId);

    if (!options.carryAttachments) {
      leftOut.push({ name, reason: 'the route cannot carry attachments' });
      continue;
    }

    const file = db
      .select({ path: resourceFiles.path, mimeType: resourceFiles.mimeType })
      .from(resourceFiles)
      .where(eq(resourceFiles.resourceId, part.resourceId))
      .get();
    if (!file) {
      leftOut.push({ name, reason: 'the file is not text' });
      continue;
    }

    let text: string;
    try {
      text = readFileSync(file.path, 'utf8');
    } catch {
      // The bytes are not there, or they are not text. Either way the file
      // cannot be carried, and saying so is better than carrying half of it.
      leftOut.push({ name, reason: 'the file is not text' });
      continue;
    }
    if (text.includes('\u0000')) {
      leftOut.push({ name, reason: 'the file is not text' });
      continue;
    }

    parts.push({
      type: 'file',
      resourceId: part.resourceId,
      filename: name,
      mimeType: part.type === 'attachment' ? (part.mimeType ?? file.mimeType) : file.mimeType,
      text,
    });
  }

  return { parts, leftOut };
}

/**
 * The sentence a turn carries when it could not carry a file.
 *
 * An agent that does not know it cannot see a file answers as if it had, so
 * the turn says it plainly — and says **why**, because "this route cannot
 * carry attachments" is the wrong answer to a file that is not text.
 */
export function attachmentNote(leftOut: LeftOutFile[]): string {
  if (leftOut.length === 0) return '';

  const them = leftOut.length === 1 ? 'it' : 'them';
  const sentences: string[] = [];

  const cannotCarry = leftOut.filter(
    (file) => file.reason === 'the route cannot carry attachments',
  );
  if (cannotCarry.length > 0) {
    sentences.push(
      `This route cannot carry attachments, so you cannot see ${namesOf(cannotCarry)}.`,
    );
  }

  const notText = leftOut.filter((file) => file.reason === 'the file is not text');
  if (notText.length > 0) {
    sentences.push(
      `You cannot see ${namesOf(notText)}, because ${notText.length === 1 ? 'its' : 'their'} bytes are not text.`,
    );
  }

  const attached = namesOf(leftOut);
  return `The owner attached ${attached}. ${sentences.join(' ')} Say so if you are asked about ${them}.`;
}

/** The names of the files, as the turn names them. */
function namesOf(files: LeftOutFile[]): string {
  return files.map((file) => `"${file.name}"`).join(', ');
}
