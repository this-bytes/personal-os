// @testing-library/jest-dom/vitest
//
// The components this repository took from elsewhere.
//
// `Trace` and `Code Block` are adapted from shadcn/ui (MIT). What upstream
// owns is the shape of a row and the shape of a code block; what this
// repository owns is what a row means and what colour it wears. These checks
// are about the half that came from upstream, because that is the half that
// has to survive a refresh: the composition, the slots, the accessibility
// rules, and the disclosure.
//
// They are also about the half that is ours: an outcome nobody can confirm is
// not a failure, and it must not be dressed as one.

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@personal-os/ui';
import { activityTraceStatus } from '../lib/chat';
import type { ChatActivity } from '@personal-os/contracts';

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

describe("the trace keeps upstream's slots and its accessibility rules", () => {
  it('names each slot, so a refresh that renames one is visible', () => {
    const { container } = render(
      <Trace>
        <TraceLine status="running">
          <TraceIcon>
            <span data-testid="dot" />
          </TraceIcon>
          <TraceDescription>09:38:31</TraceDescription>
          <TraceTitle>tool.started</TraceTitle>
        </TraceLine>
      </Trace>,
    );

    expect(container.querySelector('[data-slot="trace"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="trace-line"]')).toHaveAttribute(
      'data-status',
      'running',
    );
    expect(container.querySelector('[data-slot="trace-icon"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="trace-title"]')).toHaveTextContent('tool.started');
    expect(container.querySelector('[data-slot="trace-description"]')).toHaveTextContent(
      '09:38:31',
    );
  });

  it('hides the icon from assistive technology, so the title is the name', () => {
    const { container } = render(
      <TraceLine>
        <TraceIcon>
          <svg data-testid="glyph" />
        </TraceIcon>
        <TraceTitle>read_resource</TraceTitle>
      </TraceLine>,
    );

    expect(container.querySelector('[data-slot="trace-icon"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByText('read_resource')).toBeInTheDocument();
  });

  it('wears the running shimmer, and a finished row wears nothing', () => {
    const { container } = render(
      <Trace>
        <TraceLine status="running">
          <TraceTitle>working</TraceTitle>
        </TraceLine>
        <TraceLine>
          <TraceTitle>done</TraceTitle>
        </TraceLine>
      </Trace>,
    );

    const lines = container.querySelectorAll('[data-slot="trace-line"]');
    expect(lines[0]).toHaveAttribute('data-status', 'running');
    // The rule travels on the line, because the line is what knows the state.
    // The title is what shimmers; the finished row has no state, so the rule
    // does not reach its title at all.
    expect(lines[0]?.className).toContain(
      'data-[status=running]:*:data-[slot=trace-title]:shimmer',
    );
    expect(lines[1]).not.toHaveAttribute('data-status');
  });

  it('opens and closes as a disclosure', async () => {
    const { container } = render(
      <Trace>
        <TraceCollapsible>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceTitle>tool.started</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <p>the output</p>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>,
    );

    const trigger = container.querySelector('[data-slot="trace-collapsible-trigger"]');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('the output')).not.toBeInTheDocument();

    fireEvent.click(trigger as HTMLElement);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('the output')).toBeInTheDocument();
  });
});

describe('an outcome nobody can confirm is not a failure', () => {
  it('is neither running, nor an error, nor pending', () => {
    expect(activityTraceStatus(activity({ status: 'unknown' }))).toBeUndefined();
  });

  it('is running while the work is in flight', () => {
    expect(activityTraceStatus(activity({ status: 'running' }))).toBe('running');
  });

  it('is an error only when the work failed', () => {
    expect(activityTraceStatus(activity({ status: 'failed' }))).toBe('error');
  });

  it('is pending before the work started', () => {
    expect(activityTraceStatus(activity({ status: 'pending' }))).toBe('pending');
  });

  it('wears nothing once the work is done', () => {
    expect(activityTraceStatus(activity({ status: 'done' }))).toBeUndefined();
  });
});

describe("the code block keeps upstream's accessibility rules", () => {
  it('is a panel a keyboard can scroll, reading left to right', () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlockContent>{'const answer = 42;'}</CodeBlockContent>
      </CodeBlock>,
    );

    const pre = container.querySelector('[data-slot="code-block-content"]');
    expect(pre).toHaveAttribute('dir', 'ltr');
    expect(pre).toHaveAttribute('tabindex', '0');
    expect(pre).toHaveTextContent('const answer = 42;');
  });

  it('names the copy button, so a reader knows what it copies', () => {
    render(
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>ts</CodeBlockTitle>
        </CodeBlockHeader>
        <CodeBlockCopyButton value="const answer = 42;" copyLabel="Copy the code" />
      </CodeBlock>,
    );

    expect(screen.getByRole('button', { name: 'Copy the code' })).toBeInTheDocument();
  });

  it('announces the copy to a reader who cannot see it', () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlockCopyButton value="const answer = 42;" copiedLabel="Copied the code" />
      </CodeBlock>,
    );

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeInTheDocument();
    expect(live).toHaveClass('sr-only');
  });

  it('names its header', () => {
    const { container } = render(
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>ts</CodeBlockTitle>
        </CodeBlockHeader>
      </CodeBlock>,
    );

    expect(container.querySelector('[data-slot="code-block-title"]')).toHaveTextContent('ts');
  });
});
