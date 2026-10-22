import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatActivity, RunControl } from '@personal-os/contracts';
import {
  activityDurationMs,
  activityLabel,
  activityTone,
  countTurns,
  formatDuration,
  groupActivityByTurn,
  operationState,
  runStateOf,
} from '../../lib/chat';
import { ActivityTimeline } from '../chat/ActivityTimeline';
import { RunControls } from '../chat/RunControls';

/**
 * The trace, and what the owner may do about it.
 *
 * The trace is the panel's answer to "what is the agent doing right now", so
 * the checks are about what it says: the tool's name, the state, the
 * duration when it is knowable, and the input and output when they are
 * opened. A control that cannot be used has to say why.
 */

function activity(overrides: Partial<ChatActivity> = {}): ChatActivity {
  return {
    id: 'act_1',
    executionId: 'ex_1',
    conversationId: 'cnv_1',
    kind: 'tool',
    event: 'tool.started',
    toolName: 'read_resource',
    status: 'running',
    startedAt: '2026-10-22T09:38:31.000Z',
    endedAt: null,
    summary: null,
    ...overrides,
  };
}

function run(overrides: Partial<RunControl> = {}): RunControl {
  return {
    state: 'running',
    options: [
      { operation: 'stop', available: true, reason: null },
      {
        operation: 'steer',
        available: false,
        reason: 'This turn captured no steering capability, so it cannot be steered.',
      },
      { operation: 'queue', available: true, reason: null },
    ],
    ...overrides,
  };
}

describe('activity is grouped under the turn it belongs to', () => {
  it('keeps the turns apart and the order they arrived in', () => {
    const groups = groupActivityByTurn([
      activity({ id: 'a1', executionId: 'ex_1' }),
      activity({ id: 'a2', executionId: 'ex_2' }),
      activity({ id: 'a3', executionId: 'ex_1' }),
    ]);

    expect(groups.map((group) => group.executionId)).toEqual(['ex_1', 'ex_2']);
    expect(groups[0]?.activities.map((item) => item.id)).toEqual(['a1', 'a3']);
  });

  it('has no group at all when nothing happened', () => {
    expect(groupActivityByTurn([])).toEqual([]);
  });
});

describe('a trace row says what happened', () => {
  it('names the event and the tool', () => {
    expect(activityLabel(activity())).toBe('tool.started');
  });

  it('says the state when the row is only a state', () => {
    expect(activityLabel(activity({ event: null, status: 'running' }))).toBe('turn · running');
  });

  it('has a duration only when both ends are known', () => {
    expect(activityDurationMs(activity())).toBeNull();
    expect(
      activityDurationMs(
        activity({ startedAt: '2026-10-22T09:38:31.000Z', endedAt: '2026-10-22T09:38:33.400Z' }),
      ),
    ).toBe(2400);
  });

  it('words the duration the way the trace reads it', () => {
    expect(formatDuration(240)).toBe('240ms');
    expect(formatDuration(1400)).toBe('1.4s');
    expect(formatDuration(null)).toBeNull();
  });

  it('wears the accent only while the work is in flight', () => {
    expect(activityTone(activity({ status: 'running' }))).toBe('live');
    expect(activityTone(activity({ status: 'done' }))).toBe('ok');
    expect(activityTone(activity({ status: 'failed' }))).toBe('failed');
    expect(activityTone(activity({ status: 'unknown' }))).toBe('caution');
  });
});

describe('the trace is drawn', () => {
  it('shows the tool, the state and the time', () => {
    render(
      <ActivityTimeline
        activities={[
          activity({
            status: 'done',
            endedAt: '2026-10-22T09:38:33.400Z',
            summary: 'rev 2',
          }),
        ]}
      />,
    );

    expect(screen.getByText('tool.started')).toBeInTheDocument();
    expect(screen.getByText('read_resource')).toBeInTheDocument();
    expect(screen.getByText('rev 2')).toBeInTheDocument();
  });

  it('says that nothing has happened yet when there is nothing', () => {
    render(<ActivityTimeline activities={[]} />);

    expect(screen.getByText('No events yet.')).toBeInTheDocument();
  });

  it('closes the trace with what the turn cost and how long it took', () => {
    render(
      <ActivityTimeline
        activities={[activity()]}
        run={{
          spendUnits: 8,
          startedAt: '2026-10-22T09:38:31.000Z',
          finishedAt: '2026-10-22T09:41:15.000Z',
        }}
      />,
    );

    expect(screen.getByText(/spend 8 units/)).toBeInTheDocument();
    expect(screen.getByText(/duration 2m 44s/)).toBeInTheDocument();
  });
});

describe('the run controls say what they can do', () => {
  it('reads the state of the run', () => {
    expect(runStateOf(run())).toBe('running');
    expect(runStateOf(null)).toBe('unknown');
  });

  it('says why a control cannot be used', () => {
    const steer = operationState(run(), 'steer');

    expect(steer.available).toBe(false);
    expect(steer.reason).toContain('cannot be steered');
  });

  it('offers the stop and the queue, and refuses the steer with its reason', () => {
    render(
      <RunControls run={run()} delivery="queue" onDeliveryChange={() => {}} onStop={() => {}} />,
    );

    expect(screen.getByRole('button', { name: /stop/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /queue for the next turn/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /steer now/i })).toBeDisabled();
    expect(screen.getByText('steering unavailable')).toBeInTheDocument();
  });

  it('says that a stop request is not a cancellation', () => {
    render(
      <RunControls
        run={run({
          state: 'stopping',
          options: [
            {
              operation: 'stop',
              available: false,
              reason: 'A stop was already requested for this turn.',
            },
            {
              operation: 'steer',
              available: false,
              reason: 'This turn captured no steering capability, so it cannot be steered.',
            },
            { operation: 'queue', available: true, reason: null },
          ],
        })}
        delivery="queue"
        onDeliveryChange={() => {}}
        onStop={() => {}}
      />,
    );

    expect(screen.getByText('stop requested')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeDisabled();
  });
});

describe('turns are counted, not shared', () => {
  it('counts the replies that belong to a turn', () => {
    expect(
      countTurns([{ executionId: 'ex_1' }, { executionId: null }, { executionId: 'ex_2' }]),
    ).toBe(2);
  });
});
