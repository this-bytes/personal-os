import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { resourceFiles, resources, type Database } from '@personal-os/server/db';
import type { AgentTurnPart, ContentPart } from '@personal-os/contracts';

/**
 * Why a part was left out of the turn.
 *
 * The reasons are different and the agent is told the true one: a route that
 * cannot carry attachments says so, a route that cannot carry pictures says
 * that instead, and a file whose bytes are neither text nor a picture says
 * that.
 */
export type LeftOutReason =
  | 'the route cannot carry attachments'
  | 'the route cannot carry pictures'
  | 'the file is not text';

/** A part the turn could not carry, and why. */
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
 * **A picture is carried, as bytes.** A file's content is text and a
 * picture's content is not, so the two travel in two kinds of part and on two
 * capabilities: a route that takes a file's words is not thereby a route that
 * takes a picture.
 *
 * **What is left out is named, with the reason**, so the turn can say so
 * rather than let an agent answer as if it had seen a picture it never saw.
 */
export function resolveTurnParts(
  db: Database,
  content: ContentPart[],
  options: { carryAttachments: boolean; carryImages: boolean },
): { parts: AgentTurnPart[]; leftOut: LeftOutFile[] } {
  const parts: AgentTurnPart[] = [];
  const leftOut: LeftOutFile[] = [];

  for (const part of content) {
    if (part.type !== 'file' && part.type !== 'attachment' && part.type !== 'image') continue;

    const resource = db
      .select({ title: resources.title })
      .from(resources)
      .where(eq(resources.id, part.resourceId))
      .get();
    const name =
      part.type === 'attachment' || part.type === 'image'
        ? part.displayName
        : (resource?.title ?? part.resourceId);

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

    const mimeType =
      part.type === 'file' ? file.mimeType : (part.mimeType ?? file.mimeType);

    // A picture is a picture by what it says it is. The part knows its kind,
    // and the resource's own row knows it too, and either is enough.
    if (isAPicture(mimeType)) {
      if (!options.carryImages) {
        leftOut.push({ name, reason: 'the route cannot carry pictures' });
        continue;
      }

      let data: string;
      try {
        data = readFileSync(file.path).toString('base64');
      } catch {
        // The bytes are not there. A picture the turn cannot read is a picture
        // the turn does not carry.
        leftOut.push({ name, reason: 'the file is not text' });
        continue;
      }

      parts.push({
        type: 'image',
        resourceId: part.resourceId,
        filename: name,
        mimeType,
        data,
      });
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
      mimeType,
      text,
    });
  }

  return { parts, leftOut };
}

/**
 * Whether a thing is a picture.
 *
 * The mime type says so, and the mime type is the thing's own claim about
 * itself — a picture is a picture by what it is, not by where it came from.
 */
function isAPicture(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

/**
 * The sentence a turn carries when it could not carry a part.
 *
 * An agent that does not know it cannot see a file answers as if it had, so
 * the turn says it plainly — and says **why**, because "this route cannot
 * carry attachments" is the wrong answer to a picture.
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

  const cannotCarryPictures = leftOut.filter(
    (file) => file.reason === 'the route cannot carry pictures',
  );
  if (cannotCarryPictures.length > 0) {
    sentences.push(
      `This route cannot carry pictures, so you cannot see ${namesOf(cannotCarryPictures)}.`,
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
