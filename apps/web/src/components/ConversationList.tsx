import { Link } from 'react-router-dom';
import { MessageSquare, Pause, Users } from 'lucide-react';
import { Badge, cn } from '@personal-os/ui';
import type { ConversationDetail } from '../lib/types';

const ROUTING_LABEL: Record<string, string> = {
  mentions: 'mentions',
  coordinator: 'coordinator',
  autonomous: 'autonomous',
};

interface ConversationListProps {
  conversations: ConversationDetail[];
  activeId?: string;
}

/** The dense list of conversations in the active workspace. */
export function ConversationList({
  conversations,
  activeId,
}: ConversationListProps): React.JSX.Element {
  return (
    <ul className="space-y-1">
      {conversations.map((conversation) => {
        const agents = conversation.participants.filter(
          (participant) => participant.type === 'agent',
        );
        const isActive = conversation.id === activeId;
        return (
          <li key={conversation.id}>
            <Link
              to={`/conversations/${conversation.id}`}
              className={cn(
                'block rounded-md border px-3 py-2 transition-colors',
                isActive
                  ? 'border-indigo-500/40 bg-indigo-500/10'
                  : 'border-transparent hover:border-slate-800 hover:bg-slate-900',
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                  {conversation.title}
                </span>
                {conversation.paused ? (
                  <Badge variant="warning" className="shrink-0">
                    <Pause className="h-2.5 w-2.5" />
                    paused
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5 text-[11px] text-slate-500">
                <Badge variant="outline">
                  {ROUTING_LABEL[conversation.routingMode] ?? conversation.routingMode}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {agents.length} agent{agents.length === 1 ? '' : 's'}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
