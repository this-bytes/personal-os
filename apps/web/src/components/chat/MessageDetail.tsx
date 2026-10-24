/**
 * The server's account of how a message ended.
 *
 * The server writes a sentence about what it did with a turn - that it ran,
 * that it was stopped, that it was refused - and the panel shows that sentence
 * as it is given. The client does not reword it, because a reader who is told
 * a turn was refused has to be able to trust that the refusal is the server's
 * and not the panel's opinion of it.
 *
 * It sits under the owner's own words as well as under an agent's. The
 * sentence is about the turn, and the turn is the owner's as much as anybody
 * else's: an owner whose message was refused is owed the same account of it
 * that an owner reading an agent's reply is.
 */
export interface MessageDetailProps {
  /** The server's sentence, when the server wrote one. */
  detail?: string;
}

export function MessageDetail({ detail }: MessageDetailProps): React.JSX.Element | null {
  if (!detail) return null;
  return <p className="text-[11px] leading-snug text-slate-500">{detail}</p>;
}
