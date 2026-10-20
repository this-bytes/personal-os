import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Target } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  Textarea,
} from '@personal-os/ui';
import { api, errorMessage } from '../lib/api';
import type { AgentConnectionDetail, FactoryTask, Goal } from '../lib/types';
import { useWorkspace } from '../state/workspace';
import { EmptyState, ErrorState, LoadingState } from '../components/ErrorState';
import { Field } from '../components/Field';
import { TaskBoard } from '../components/TaskBoard';

export function Factory(): React.JSX.Element {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // A link from the waiting list points at one task, so the board opens that
  // card instead of making the owner find it.
  const focusedTaskId = searchParams.get('task');

  const goals = useQuery<Goal[]>({
    queryKey: ['goals', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{ goals: Goal[] }>('/goals', { workspaceId: activeWorkspaceId ?? undefined })
        .then((r) => r.goals),
    enabled: Boolean(activeWorkspaceId),
  });

  const tasks = useQuery<FactoryTask[]>({
    queryKey: ['tasks', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{ tasks: FactoryTask[] }>('/tasks', { workspaceId: activeWorkspaceId ?? undefined })
        .then((r) => r.tasks),
    enabled: Boolean(activeWorkspaceId),
  });

  const agents = useQuery<AgentConnectionDetail[]>({
    queryKey: ['agents', activeWorkspaceId],
    queryFn: () =>
      api
        .get<{
          agents: AgentConnectionDetail[];
        }>('/agents', { workspaceId: activeWorkspaceId ?? undefined })
        .then((r) => r.agents),
    enabled: Boolean(activeWorkspaceId),
  });

  const goalTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const goal of goals.data ?? []) map[goal.id] = goal.title;
    return map;
  }, [goals.data]);

  const createTask = useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      goalId: string | null;
      assigneeId: string | null;
      acceptanceCriteria: string[];
    }) =>
      api.post<{ task: FactoryTask }>('/tasks', {
        workspaceId: activeWorkspaceId,
        title: input.title,
        description: input.description,
        ...(input.goalId ? { goalId: input.goalId } : {}),
        ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
        acceptanceCriteria: input.acceptanceCriteria,
      }),
    onSuccess: async () => {
      setActionError(null);
      setTaskDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const createGoal = useMutation({
    mutationFn: async (input: { title: string; description: string }) =>
      api.post<{ goal: Goal }>('/goals', {
        workspaceId: activeWorkspaceId,
        title: input.title,
        description: input.description,
      }),
    onSuccess: async () => {
      setActionError(null);
      setGoalDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const taskList = tasks.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Factory</h1>
          <p className="text-xs text-slate-500">
            Goals, tasks and the acceptance decision. An agent reporting completion is not
            acceptance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setGoalDialogOpen(true)}>
            <Target className="h-4 w-4" />
            New goal
          </Button>
          <Button variant="primary" size="sm" onClick={() => setTaskDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>
      </header>

      {actionError ? <ErrorState title="The change was not applied" message={actionError} /> : null}

      <Card>
        <CardContent className="p-3">
          <p className="pos-field-label">Goals</p>
          {goals.isError ? (
            <ErrorState
              title="The goals could not be loaded"
              message={errorMessage(goals.error)}
              onRetry={() => void goals.refetch()}
            />
          ) : null}
          {goals.isLoading ? <LoadingState label="Loading goals…" /> : null}
          {!goals.isLoading && (goals.data ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-800 px-3 py-3 text-center text-[11px] text-slate-500">
              No goals yet. A goal outlives any single agent, so it is the durable unit of intent.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {(goals.data ?? []).map((goal) => (
              <Badge key={goal.id} variant="outline" title={goal.description}>
                {goal.title}
                <span className="text-slate-600">{goal.status}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {tasks.isError ? (
        <ErrorState
          title="The tasks could not be loaded"
          message={errorMessage(tasks.error)}
          onRetry={() => void tasks.refetch()}
        />
      ) : null}

      {tasks.isLoading ? <LoadingState label="Loading tasks…" /> : null}

      {!tasks.isLoading && !tasks.isError && taskList.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          message="Create a task, assign it to an agent, and it will move to review when the agent reports back."
        />
      ) : null}

      {taskList.length > 0 ? (
        <TaskBoard
          tasks={taskList}
          agents={agents.data ?? []}
          goalTitles={goalTitles}
          focusedTaskId={focusedTaskId ?? undefined}
        />
      ) : null}

      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        goals={goals.data ?? []}
        agents={agents.data ?? []}
        busy={createTask.isPending}
        error={createTask.isError ? errorMessage(createTask.error) : null}
        onSubmit={(input) => createTask.mutate(input)}
      />

      <CreateGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        busy={createGoal.isPending}
        error={createGoal.isError ? errorMessage(createGoal.error) : null}
        onSubmit={(input) => createGoal.mutate(input)}
      />
    </div>
  );
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: Goal[];
  agents: AgentConnectionDetail[];
  busy: boolean;
  error: string | null;
  onSubmit: (input: {
    title: string;
    description: string;
    goalId: string | null;
    assigneeId: string | null;
    acceptanceCriteria: string[];
  }) => void;
}

function CreateTaskDialog({
  open,
  onOpenChange,
  goals,
  agents,
  busy,
  error,
  onSubmit,
}: CreateTaskDialogProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [criteria, setCriteria] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      goalId: goalId || null,
      assigneeId: assigneeId || null,
      acceptanceCriteria: criteria
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            A task carries acceptance criteria. Only a human decision closes it.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Title" htmlFor="task-title">
            <Input
              id="task-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Draft the weekly digest"
            />
          </Field>

          <Field label="Description" htmlFor="task-description">
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Goal" htmlFor="task-goal">
              <Select
                id="task-goal"
                value={goalId}
                onChange={(event) => setGoalId(event.target.value)}
              >
                <option value="">No goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Assignee" htmlFor="task-assignee">
              <Select
                id="task-assignee"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Acceptance criteria"
            htmlFor="task-criteria"
            hint="One per line. These are what the acceptance decision is judged against."
          >
            <Textarea
              id="task-criteria"
              className="min-h-[70px]"
              value={criteria}
              onChange={(event) => setCriteria(event.target.value)}
              placeholder={'The digest lists every source\nEvery entry links to its source'}
            />
          </Field>

          {error ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
              {busy ? 'Creating…' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { title: string; description: string }) => void;
}

function CreateGoalDialog({
  open,
  onOpenChange,
  busy,
  error,
  onSubmit,
}: CreateGoalDialogProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>
            A goal stays valid even when the agent behind it changes.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            onSubmit({ title: title.trim(), description: description.trim() });
          }}
        >
          <Field label="Title" htmlFor="goal-title">
            <Input
              id="goal-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Keep the knowledge base current"
            />
          </Field>

          <Field label="Description" htmlFor="goal-description">
            <Textarea
              id="goal-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          {error ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
              {busy ? 'Creating…' : 'Create goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
