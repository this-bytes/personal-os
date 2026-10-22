import { cn } from '@personal-os/ui';
import type { Participant } from '@personal-os/contracts';
import type { AgentConnectionDetail } from '../../lib/types';
import { AgentOrb } from './AgentOrb';

/**
 * Who is in the room.
 *
 * Each participant wears their own orb — the agent's hue from the same ring
 * the map uses — with the name and the runtime that speaks for them. The hue
 * is an identity and never a meaning: it says who, not what.
 */

export interface PresenceListProps {
  participants: Participant[];
  agents: AgentConnectionDetail[];
  className?: string;
}

export function PresenceList({
  participants,
  agents,
  className,
}: PresenceListProps): React.JSX.Element {
  if (participants.length === 0) {
    return <p className={cn('text-[11px] italic text-slate-500', className)}>Nobody here yet.</p>;
  }

  return (
    <ul className={cn('space-y-1.5', className)} aria-label="Participants in the room">
      {participants.map((participant) => {
        const agent = participant.agentConnectionId
          ? agents.find((candidate) => candidate.id === participant.agentConnectionId)
          : undefined;
        const name = participant.displayName;
        return (
          <li
            key={participant.id}
            className="flex items-center gap-2.5 rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5"
          >
            <AgentOrb
              name={name}
              agentId={participant.agentConnectionId ?? null}
              owner={participant.type === 'human'}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-slate-200">{name}</p>
              <p className="truncate font-mono text-[10px] text-slate-500">
                {agent ? `${agent.adapterType} · ${agent.status}` : participant.type}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
