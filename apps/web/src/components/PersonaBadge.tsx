import { Badge } from '@personal-os/ui';
import { personaSourceLabels, type PersonaSource } from '@personal-os/contracts';

interface PersonaBadgeProps {
  /** The role in force, when the persona has one. */
  role?: string;
  /** Where the persona in force came from. */
  source: PersonaSource;
  className?: string;
}

/**
 * Which persona is in force, and where it came from.
 *
 * The source is always named. A conversation that overrides the role must
 * never display the connection's value as if it were the base, so the source
 * is part of the display rather than a detail.
 */
export function PersonaBadge({ role, source, className }: PersonaBadgeProps): React.JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="truncate text-[11px] text-slate-300">
        {role && role.length > 0 ? role : 'no role'}
      </span>
      <Badge variant={source === 'default' ? 'outline' : 'info'}>
        persona: {personaSourceLabels[source]}
      </Badge>
    </span>
  );
}
