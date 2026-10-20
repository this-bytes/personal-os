import { useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Badge, Button, Input, Select } from '@personal-os/ui';
import type { Participant } from '@personal-os/contracts';
import type { AgentConnectionDetail } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface ParticipantManagerProps {
  participants: Participant[];
  agents: AgentConnectionDetail[];
  busy?: boolean;
  onAdd: (input: {
    type: 'human' | 'agent';
    agentConnectionId?: string;
    displayName: string;
  }) => void;
  onRemove: (participantId: string) => void;
}

/**
 * The participant roster of a conversation.
 *
 * Every participant is shown with the live connection status of the agent
 * behind it, so a broken connection is visible before a turn is sent.
 */
export function ParticipantManager({
  participants,
  agents,
  busy,
  onAdd,
  onRemove,
}: ParticipantManagerProps): React.JSX.Element {
  const [agentId, setAgentId] = useState('');
  const [humanName, setHumanName] = useState('');

  const available = useMemo(
    () =>
      agents.filter(
        (agent) => !participants.some((participant) => participant.agentConnectionId === agent.id),
      ),
    [agents, participants],
  );

  const agentById = useMemo(() => {
    const map = new Map<string, AgentConnectionDetail>();
    for (const agent of agents) map.set(agent.id, agent);
    return map;
  }, [agents]);

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {participants.map((participant) => {
          const agent = participant.agentConnectionId
            ? agentById.get(participant.agentConnectionId)
            : undefined;
          return (
            <li
              key={participant.id}
              className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                {participant.displayName}
              </span>
              <Badge variant={participant.type === 'agent' ? 'info' : 'outline'}>
                {participant.type}
              </Badge>
              {agent ? <StatusBadge status={agent.status} /> : null}
              {agent && !agent.enabled ? <Badge variant="warning">disabled</Badge> : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={busy}
                aria-label={`Remove ${participant.displayName}`}
                onClick={() => onRemove(participant.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
        {participants.length === 0 ? (
          <li className="rounded-md border border-dashed border-slate-800 px-2.5 py-3 text-center text-[11px] text-slate-500">
            No participants yet. Add an agent so the conversation can be routed.
          </li>
        ) : null}
      </ul>

      <div className="space-y-2 border-t border-slate-800 pt-3">
        <p className="pos-field-label">Add a participant</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="Agent connection"
            className="h-8 text-xs"
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
          >
            <option value="">Agent connection…</option>
            {available.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.adapterType})
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="sm"
            className="h-8"
            disabled={busy || !agentId}
            onClick={() => {
              const agent = available.find((item) => item.id === agentId);
              if (!agent) return;
              onAdd({ type: 'agent', agentConnectionId: agent.id, displayName: agent.name });
              setAgentId('');
            }}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add agent
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Human participant name"
            className="h-8 text-xs"
            placeholder="Human participant name…"
            value={humanName}
            onChange={(event) => setHumanName(event.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            className="h-8"
            disabled={busy || humanName.trim().length === 0}
            onClick={() => {
              onAdd({ type: 'human', displayName: humanName.trim() });
              setHumanName('');
            }}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add human
          </Button>
        </div>
      </div>
    </div>
  );
}
