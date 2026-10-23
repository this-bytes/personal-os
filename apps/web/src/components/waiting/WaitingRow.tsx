import { Link } from 'react-router-dom';
import { Badge, Button } from '@personal-os/ui';
import type { PersonaSource, WaitingItem } from '@personal-os/contracts';
import { PersonaBadge } from '../PersonaBadge';

/**
 * One row of "waiting on you".
 *
 * The same row appears in the waiting list on the conversations page and in
 * the room itself, so a request reads the same in both places and there is
 * one set of words for it. A row is a request, a decision or a grant to widen,
 * and the row says which of the three it is and carries the action that
 * settles it.
 */
export interface WaitingRowProps {
  item: WaitingItem;
  /** The agent that raised it, when the surface already knows the name. */
  agent?: { name: string };
  /** The persona in force for that agent, when the surface knows it. */
  persona?: { role?: string; source: PersonaSource } | null;
  /** True while a decision of this surface is in flight. */
  busy: boolean;
  /**
   * Where the title leads.
   *
   * The waiting list sends the owner to the place where the item is decided.
   * The room is already that place, so the room's row leads nowhere and says
   * its title plainly.
   */
  href?: string | null;
  onDecide: (approvalId: string, approved: boolean) => void;
  onResolve: (executionId: string, outcome: 'completed' | 'failed') => void;
  onWidenGrant: (agentConnectionId: string, toolName: string) => void;
}

export function WaitingRow({
  item,
  agent,
  persona,
  busy,
  href,
  onDecide,
  onResolve,
  onWidenGrant,
}: WaitingRowProps): React.JSX.Element {
  // The waiting item is keyed across kinds, so the approval's own id and the
  // turn's execution id are both behind the kind.
  const approvalId = item.id.startsWith('approval:') ? item.id.slice('approval:'.length) : null;
  const executionId = item.id.startsWith('turn:') ? item.id.slice('turn:'.length) : null;
  const grant = capabilityGrant(item);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-800 px-3 py-2.5 transition-colors hover:border-slate-700">
      <div className="min-w-0">
        {href ? (
          <Link
            to={href}
            className="block truncate text-xs font-medium text-slate-100 hover:text-white hover:underline"
          >
            {item.title}
          </Link>
        ) : (
          <p className="block truncate text-xs font-medium text-slate-100">{item.title}</p>
        )}
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{item.detail}</p>
        {/*
         * The tool the agent was refused is named by the row itself.
         *
         * The row's title carries it too, but the title is the server's
         * sentence and this is the fact: a tool name is what the owner acts
         * with, and the row has to be able to show it without being read.
         */}
        {item.toolName ? (
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            Tool: <span className="font-mono text-slate-300">{item.toolName}</span>
          </p>
        ) : null}
        {item.agentConnectionId ? (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span className="text-slate-400">{agent?.name ?? item.agentConnectionId}</span>
            {persona ? (
              <>
                <span className="text-slate-700">·</span>
                <PersonaBadge role={persona.role} source={persona.source} />
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {/*
         * Every row of this rail is waiting on the owner, so every row wears
         * the accent — PRODUCT.md 11 says the accent means live or waiting on
         * you, and a row in another colour would say the rail is not waiting
         * on you. The four reasons a row can be here are carried by its
         * label, not by four different colours: a colour that has to mean
         * four things is a colour that stops meaning any of them.
         *
         * "Blocked" is one of them. A blocked item in this rail is an item
         * waiting on the owner, not a failure that happened; failures live in
         * the conversation and in the editor.
         */}
        <Badge variant="accent">{labelFor(item)}</Badge>
        {approvalId ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onDecide(approvalId, true)}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onDecide(approvalId, false)}
            >
              Reject
            </Button>
          </>
        ) : null}
        {executionId ? (
          <>
            {/* The owner's own conclusion about a turn they were told to
                check: it did run, or it did not. Nothing is decided here for
                them — the server only records what they say. */}
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onResolve(executionId, 'completed')}
            >
              It ran
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onResolve(executionId, 'failed')}
            >
              It did not run
            </Button>
          </>
        ) : null}
        {grant ? (
          /* The action the row carries.
           *
           * The owner who sees a blocked capability is told what is blocked
           * and used to be sent elsewhere to find the grant. The row carries
           * the grant's own tool name and the agent it was refused to, so the
           * widening happens here, on the row that asked for it.
           */
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onWidenGrant(grant.agentConnectionId, grant.toolName)}
          >
            Grant the tool
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The grant this row can widen, when the row is one.
 *
 * A capability row names the agent that was refused and the tool it was
 * refused, and those two are the whole of the action. A row that is not a
 * capability has no grant to widen: it is a decision, a task or a turn.
 */
export function capabilityGrant(
  item: WaitingItem,
): { agentConnectionId: string; toolName: string } | null {
  if (item.kind !== 'capability') return null;
  if (!item.agentConnectionId || !item.toolName) return null;
  return { agentConnectionId: item.agentConnectionId, toolName: item.toolName };
}

/**
 * Where the owner acts on the item.
 *
 * An approval is a request inside a conversation and a turn happened inside
 * one, so the conversation is where they are read. A task is decided on the
 * factory board, and the link opens the exact card so the decision is one
 * click away. A capability is acted on from the row itself, so its link goes
 * to the agents page where the grant lives.
 */
export function targetFor(item: WaitingItem): string {
  if (item.kind === 'task') {
    return item.taskId ? `/factory?task=${item.taskId}` : '/factory';
  }
  return item.conversationId ? `/conversations/${item.conversationId}` : '/agents';
}

/**
 * What the item is, in the owner's words.
 *
 * An unknown outcome is not a failure to fix and not a decision to make. It
 * is something to check, and it is labelled that way so the owner does not
 * read it as a task that failed and may simply be repeated.
 *
 * A capability has a name of its own because it is not one of the other
 * three. It carries the reason `pending`, so a label that went by the reason
 * would call it "Blocked" and send the owner looking for work that is stuck
 * rather than for a grant they can widen. The kind is named before the
 * reason is read, so a capability is never filed under somebody else's
 * name.
 */
export function labelFor(item: WaitingItem): string {
  if (item.kind === 'approval') return 'Approval';
  if (item.kind === 'capability') return 'Needs a grant';
  if (item.reason === 'review') return 'In review';
  if (item.reason === 'unknown') return 'Check this';
  return 'Blocked';
}
