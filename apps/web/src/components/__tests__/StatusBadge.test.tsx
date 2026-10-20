import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AgentConnectionStatus } from '@personal-os/contracts';
import { StatusBadge } from '../StatusBadge';

/**
 * The status badge is the one place a reader learns whether an agent
 * connection is healthy, so the label for every status is pinned down here.
 */

describe('StatusBadge', () => {
  it.each<[AgentConnectionStatus, string]>([
    ['connected', 'connected'],
    ['degraded', 'degraded'],
    ['disconnected', 'disconnected'],
    ['error', 'error'],
    ['unknown', 'unknown'],
  ])('labels the %s status as %s', (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to unknown for a status the client does not know', () => {
    render(<StatusBadge status={'mystery' as AgentConnectionStatus} />);

    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
