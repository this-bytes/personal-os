import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, ListChecks, ShieldCheck, X } from 'lucide-react';
import { Badge, Button, Card, CardContent, Select, Textarea } from '@personal-os/ui';
import type { FactoryTask, TaskStatus } from '@personal-os/contracts';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, TaskWithEvidence } from '../lib/types';

const COLUMNS: Array<{ status: TaskStatus; label: string; hint: string }> = [
  { status: 'open', label: 'Open', hint: 'Waiting to be picked up' },
  { status: 'active', label: 'Active', hint: 'An agent is working on it' },
  {
    status: 'review',
    label: 'Review',
    hint: 'The agent reported completion — it is not accepted yet',
  },
  { status: 'done', label: 'Done', hint: 'Accepted by a human' },
];

interface TaskBoardProps {
  tasks: FactoryTask[];
  agents: AgentConnectionDetail[];
  goalTitles: Record<string, string>;
}

export function TaskBoard({ tasks, agents, goalTitles }: TaskBoardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = (status: TaskStatus): FactoryTask[] =>
    tasks.filter((task) => task.status === status);
  const other = tasks.filter((task) => task.status === 'blocked' || task.status === 'cancelled');

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const items = grouped(column.status);
          return (
            <section key={column.status} className="flex min-w-0 flex-col gap-2">
              <header className="flex items-baseline justify-between gap-2 px-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {column.label}
                  <span className="ml-1.5 text-slate-600">{items.length}</span>
                </h3>
              </header>
              <p className="px-0.5 text-[10px] leading-snug text-slate-600">{column.hint}</p>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-800 px-2 py-3 text-center text-[11px] text-slate-600">
                    Empty
                  </p>
                ) : null}
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    agents={agents}
                    goalTitles={goalTitles}
                    expanded={expanded === task.id}
                    onToggle={() => setExpanded(expanded === task.id ? null : task.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {other.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Blocked and cancelled <span className="ml-1.5 text-slate-600">{other.length}</span>
          </h3>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {other.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                agents={agents}
                goalTitles={goalTitles}
                expanded={expanded === task.id}
                onToggle={() => setExpanded(expanded === task.id ? null : task.id)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

interface TaskCardProps {
  task: FactoryTask;
  agents: AgentConnectionDetail[];
  goalTitles: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
}

function TaskCard({
  task,
  agents,
  goalTitles,
  expanded,
  onToggle,
}: TaskCardProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [assignee, setAssignee] = useState(task.assigneeId ?? '');
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery<TaskWithEvidence>({
    queryKey: ['task', task.id],
    queryFn: () => api.get<TaskWithEvidence>(`/tasks/${task.id}`),
    enabled: expanded,
  });

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['task', task.id] });
  };

  const assign = useMutation({
    mutationFn: async (agentConnectionId: string) =>
      api.post<{ task: FactoryTask }>(`/tasks/${task.id}/assign`, { agentConnectionId }),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const accept = useMutation({
    mutationFn: async (satisfied: boolean) =>
      api.post<{ task: FactoryTask }>(`/tasks/${task.id}/accept`, {
        satisfied,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      setError(null);
      setReason('');
      await invalidate();
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  const agent = agents.find((item) => item.id === task.assigneeId);
  const goalTitle = task.goalId ? goalTitles[task.goalId] : undefined;

  return (
    <Card className="border-slate-800">
      <CardContent className="p-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start gap-1.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          )}
          <span className="min-w-0 flex-1 text-xs font-medium text-slate-100">{task.title}</span>
        </button>

        {goalTitle ? (
          <p className="mt-1 pl-5 text-[10px] text-slate-500">goal: {goalTitle}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-5">
          {agent ? (
            <Badge variant="info">{agent.name}</Badge>
          ) : (
            <Badge variant="outline">unassigned</Badge>
          )}
          {task.acceptanceCriteria.length > 0 ? (
            <Badge variant="outline">
              <ListChecks className="h-2.5 w-2.5" />
              {task.acceptanceCriteria.length}
            </Badge>
          ) : null}
          {task.status === 'review' ? <Badge variant="warning">awaiting acceptance</Badge> : null}
        </div>

        {expanded ? (
          <div className="mt-2.5 space-y-2.5 border-t border-slate-800 pt-2.5">
            {task.description ? (
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                {task.description}
              </p>
            ) : null}

            {task.acceptanceCriteria.length > 0 ? (
              <div>
                <p className="pos-field-label">Acceptance criteria</p>
                <ul className="space-y-0.5">
                  {task.acceptanceCriteria.map((criterion, index) => (
                    <li
                      key={`${criterion}-${index}`}
                      className="flex items-start gap-1.5 text-[11px] text-slate-300"
                    >
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                      {criterion}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <p className="pos-field-label">Evidence</p>
              {detail.isLoading ? (
                <p className="text-[11px] text-slate-500">Loading evidence…</p>
              ) : (detail.data?.evidence ?? []).length === 0 ? (
                <p className="text-[11px] text-slate-500">No evidence recorded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {(detail.data?.evidence ?? []).map((evidence) => (
                    <li
                      key={evidence.id}
                      className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-[11px] text-slate-300"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{evidence.kind}</Badge>
                        <span className="text-[10px] text-slate-600">
                          {new Date(evidence.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words">{evidence.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="pos-field-label">Assign to an agent</p>
              <div className="flex items-center gap-1.5">
                <Select
                  aria-label="Assign to agent"
                  className="h-7 text-[11px]"
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                >
                  <option value="">Choose an agent…</option>
                  {agents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-[11px]"
                  disabled={!assignee || assign.isPending}
                  onClick={() => assign.mutate(assignee)}
                >
                  Assign
                </Button>
              </div>
            </div>

            {task.status === 'review' ? (
              <div className="space-y-1.5 rounded-md border border-amber-800/50 bg-amber-950/20 p-2">
                <p className="flex items-start gap-1.5 text-[11px] text-amber-200">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The agent reported that it finished. That is not acceptance — decide here whether
                  the criteria are actually met.
                </p>
                <Textarea
                  aria-label="Acceptance reason"
                  className="min-h-[52px] text-[11px]"
                  placeholder="Why you accept or reject this task…"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(true)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={accept.isPending || reason.trim().length === 0}
                    onClick={() => accept.mutate(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
