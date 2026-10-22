import { hueFor } from '../../features/map/constellation';

/**
 * The orb an agent wears.
 *
 * The prototype's transcript gave every speaker a circle with their first
 * letter in it, and the circle wore that agent's own hue. The hue is an
 * identity and never a meaning: it says who spoke, not what happened, so it
 * is taken from the same ring the map uses and from nothing else.
 */

export interface AgentOrbProps {
  /** The name of the speaker. Its first letter is the letter in the orb. */
  name: string;
  /**
   * The agent connection's id.
   *
   * The id decides the hue, so the same agent always wears the same colour.
   * A speaker without one — the owner, or an agent the panel has not seen —
   * wears the owner's own gradient.
   */
  agentId?: string | null;
  /** Whether the speaker is the owner. */
  owner?: boolean;
  /** The size of the orb. */
  size?: 'sm' | 'md';
}

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-7 w-7 text-[11px]',
} as const;

export function AgentOrb({
  name,
  agentId,
  owner = false,
  size = 'md',
}: AgentOrbProps): React.JSX.Element {
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  const dimensions = SIZES[size];

  if (owner || !agentId) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 font-semibold text-slate-950`}
      >
        {letter}
      </span>
    );
  }

  const hue = hueFor(agentId);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-full font-semibold text-slate-950`}
      style={{ backgroundColor: `hsl(${hue} 68% 58%)` }}
    >
      {letter}
    </span>
  );
}
