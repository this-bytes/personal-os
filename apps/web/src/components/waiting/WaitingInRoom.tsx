import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@personal-os/ui';
import type { Participant, Persona, WaitingItem } from '@personal-os/contracts';
import { api, errorMessage } from '../../lib/api';
import type { AgentConnectionDetail, ApprovalDecision, ExecutionResolution } from '../../lib/types';
import { useWorkspace } from '../../state/workspace';
import { useServerEvents } from '../../state/events';
import { ErrorState } from '../ErrorState';
import { WaitingRow } from './WaitingRow';
import { personaFor } from '../WaitingList';

/**
 * What is waiting on the owner, in the room.
 *
 * A request that arrives in a conversation is answered in that conversation.
 * The owner does not have to leave the room to find what the room is asking
 * of them, and the answer is given where the question was asked.
 *
 * The rows are the waiting list's own rows: the same request reads the same
 * way in both places, and there is one set of words for it.
 */

const SAFETY_NET_REFETCH_MS = 15_000;

const QUERY_KEY = 'waiting';

export interface WaitingInRoomProps {
  /** The conversation the room is showing. */
  conversationId: string;
  /** The agents the room already knows, by id. */
  agents: Array<{ id: string; name: string; persona?: Persona }>;
  /** The agents taking part in this conversation. */
  participants: Participant[];
}

export function WaitingInRoom({
  conversationId,
  agents,
  participants,
}: WaitingInRoomProps): React.JSX.Element | null {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { subscribe } = useServerEvents();
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<string | null>(null);

  const waiting = useQuery<WaitingItem[]>({
    queryKey: [QUERY_KEY, activeWorkspaceId, conversationId],
    queryFn: () =>
      api
        .get<{ items: WaitingItem[] }>('/waiting', {
          workspaceId: activeWorkspaceId ?? undefined,
          conversationId,
        })
        .then((response) => response.items),
    enabled: Boolean(activeWorkspaceId),
    refetchInterval: SAFETY_NET_REFETCH_MS,
  });

  // The room follows the same events the waiting list does: an agent asked
  // for something, and a decision was taken — here or on any other surface.
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'task.updated' || event.type === 'approval.decided') {
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
        return;
      }
      if (event.type === 'execution.event' && event.event.type === 'approval.requested') {
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      }
    });
  }, [subscribe, queryClient]);

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const conversationsById = useMemo(
    () => new Map([[conversationId, { participants }]]),
    [conversationId, participants],
  );

  /**
   * The decision is taken here, where the request was made.
   *
   * The decision itself is the server's: this only sends it. What the
   * decision *did* is the server's to say as well, and the account of it comes
   * back with the decision — a turn that continued and a turn that closed are
   * told apart in words.
   */
  const decide = useMutation({
    mutationFn: async (input: { approvalId: string; approved: boolean }) =>
      api.post<ApprovalDecision>(`/approvals/${input.approvalId}/decide`, {
        approved: input.approved,
        reason: input.approved ? 'Approved in the conversation.' : 'Rejected in the conversation.',
      }),
    onSuccess: async (result) => {
      setDecisionError(null);
      setDecisionNote(result.detail);
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      setDecisionError(errorMessage(error));
      setDecisionNote(null);
    },
  });

  /** The owner's own conclusion about a turn they were told to check. */
  const resolveTurn = useMutation({
    mutationFn: async (input: { executionId: string; outcome: 'completed' | 'failed' }) =>
      api.post<ExecutionResolution>(`/executions/${input.executionId}/resolve`, {
        outcome: input.outcome,
      }),
    onSuccess: async (result) => {
      setDecisionError(null);
      setDecisionNote(result.detail);
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      setDecisionError(errorMessage(error));
      setDecisionNote(null);
    },
  });

  /**
   * The owner widens the grant from the row.
   *
   * The route is the one the contract publishes: it widens that agent's grant
   * to include the one tool and leaves the rest of the grant as it was, so the
   * action that unblocks an agent cannot take anything away.
   */
  const widenGrant = useMutation({
    mutationFn: async (input: { agentConnectionId: string; toolName: string }) =>
      api.post<{ agent: AgentConnectionDetail }>(`/agents/${input.agentConnectionId}/grants`, {
        tool: input.toolName,
      }),
    onSuccess: async (_result, input) => {
      setDecisionError(null);
      setDecisionNote(`The grant now includes the "${input.toolName}" tool.`);
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      setDecisionError(errorMessage(error));
      setDecisionNote(null);
    },
  });

  const items = waiting.data ?? [];

  // A room with nothing waiting on the owner shows nothing. The room is for
  // the conversation, and a rail of empty panels is not the conversation.
  if (!waiting.isError && items.length === 0 && !decisionNote && !decisionError) return null;

  const busy = decide.isPending || resolveTurn.isPending || widenGrant.isPending;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Waiting on you</span>
          {items.length > 0 ? (
            <span className="font-mono text-[10px] font-normal text-slate-600">{items.length}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        {waiting.isError ? (
          <ErrorState
            title="What is waiting could not be loaded"
            message={errorMessage(waiting.error)}
            onRetry={() => void waiting.refetch()}
          />
        ) : null}

        {items.length > 0 ? (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.id}>
                <WaitingRow
                  item={item}
                  agent={
                    item.agentConnectionId ? agentsById.get(item.agentConnectionId) : undefined
                  }
                  persona={personaFor(item, agentsById, conversationsById)}
                  busy={busy}
                  onDecide={(approvalId, approved) => decide.mutate({ approvalId, approved })}
                  onResolve={(executionId, outcome) => resolveTurn.mutate({ executionId, outcome })}
                  onWidenGrant={(agentConnectionId, toolName) =>
                    widenGrant.mutate({ agentConnectionId, toolName })
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}

        {decisionNote ? (
          <p className="text-[11px] leading-snug text-slate-400">{decisionNote}</p>
        ) : null}

        {decisionError ? (
          <p className="text-[11px] text-red-300">The decision was not recorded: {decisionError}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
