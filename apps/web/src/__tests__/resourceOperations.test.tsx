import '@testing-library/jest-dom/vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canExecuteResource,
  canPublishResource,
  resourceTypeSchema,
  type Resource,
  type ResourceType,
} from '@personal-os/contracts';
import { ApiError } from '../lib/api';
import { ResourceEditor } from '../components/ResourceEditor';

/**
 * The panel believes the server.
 *
 * The audit measured a panel that said a resource had been published and that
 * it had run, for kinds where nothing had happened. The server now refuses the
 * operations a kind does not have and reports the ones it does, and this file
 * holds the panel to that:
 *
 *  1. the panel offers only the actions that can succeed, so it never offers a
 *     button that can only be refused;
 *  2. the panel renders the outcome the response claimed, and a queued run is
 *     not shown as a run that happened;
 *  3. a refusal is shown as a refusal, and no success is claimed in its place.
 *
 * **The support is declared once, in the contracts package.** The panel reads
 * it; the server refuses by it. This file checks that the panel reads it rather
 * than declaring it again, and the server's own gate checks that the
 * declaration matches what the code really does.
 */

const { post, get, patch } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), patch: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
  ApiError: class ApiError extends Error {
    readonly code: string;
    readonly status: number;

    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
    }
  },
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

/** The panel's own source, on disk. */
const editorPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'components',
  'ResourceEditor.tsx',
);

function resourceOf(type: ResourceType): Resource {
  return {
    id: 'res_1',
    workspaceId: 'wsp_1',
    type,
    schemaVersion: 1,
    revision: 1,
    title: `A ${type}`,
    data: {},
    createdBy: 'owner',
    updatedAt: new Date().toISOString(),
  };
}

function renderEditor(type: ResourceType): { onChanged: ReturnType<typeof vi.fn> } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChanged = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ResourceEditor
        open
        onOpenChange={() => undefined}
        workspaceId="wsp_1"
        resource={resourceOf(type)}
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  );
  return { onChanged };
}

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  patch.mockReset();
});

describe('the actions the panel offers', () => {
  it.each([...resourceTypeSchema.options])('offers a %s only what it can do', (type) => {
    renderEditor(type);

    const publish = screen.queryByRole('button', { name: /Publish/ });
    const execute = screen.queryByRole('button', { name: /Execute/ });

    // The declaration is the contract, so the panel follows it rather than
    // offering a button that can only be refused.
    if (canPublishResource(type)) {
      expect(publish).toBeInTheDocument();
    } else {
      expect(publish).not.toBeInTheDocument();
    }
    if (canExecuteResource(type)) {
      expect(execute).toBeInTheDocument();
    } else {
      expect(execute).not.toBeInTheDocument();
    }
  });

  it('says what a kind cannot do, rather than leaving a gap', () => {
    renderEditor('document');

    expect(screen.getByText('A document cannot be published or executed.')).toBeInTheDocument();
  });

  it('says what a kind cannot publish, and still offers what it can', () => {
    renderEditor('data-source');

    expect(screen.getByText('A data source cannot be published.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Execute/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument();
  });
});

describe('the outcome the panel renders', () => {
  it('says a resource was published when the server says it was', async () => {
    post.mockResolvedValue({ outcome: 'published', resource: resourceOf('dashboard') });
    renderEditor('dashboard');

    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));

    await waitFor(() => expect(screen.getByText('Published.')).toBeInTheDocument());
    expect(screen.getByText('The dashboard is live.')).toBeInTheDocument();
  });

  it('does not say a queued run ran', async () => {
    post.mockResolvedValue({ outcome: 'queued', result: { output: { queued: true } } });
    renderEditor('automation');

    fireEvent.click(screen.getByRole('button', { name: /Execute/ }));

    await waitFor(() => expect(screen.getByText('Queued.')).toBeInTheDocument());
    expect(
      screen.getByText('The run was accepted and has not finished. It has not run yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('It ran.')).not.toBeInTheDocument();
  });

  it('says a resource ran when the server says it ran', async () => {
    post.mockResolvedValue({ outcome: 'succeeded', result: { output: { rows: [1, 2] } } });
    renderEditor('data-source');

    fireEvent.click(screen.getByRole('button', { name: /Execute/ }));

    await waitFor(() => expect(screen.getByText('It ran.')).toBeInTheDocument());
    expect(
      screen.getByText('The data source ran and produced the output below.'),
    ).toBeInTheDocument();
  });
});

describe('a refusal', () => {
  it('is shown as a refusal, and claims no success', async () => {
    post.mockRejectedValue(
      new ApiError(
        'bad_request',
        'A document cannot be published. A dashboard and an automation can be.',
        400,
      ),
    );
    renderEditor('dashboard');

    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));

    await waitFor(() => expect(screen.getByText(/The server refused/)).toBeInTheDocument());
    expect(screen.getByText(/A document cannot be published/)).toBeInTheDocument();
    expect(screen.queryByText('Published.')).not.toBeInTheDocument();
  });

  it('is not swallowed into the success the response did not claim', async () => {
    // The server refused, so the panel must not clear the error and refresh as
    // though it had published.
    post.mockRejectedValue(new ApiError('bad_request', 'This resource cannot be published.', 400));
    const { onChanged } = renderEditor('dashboard');

    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));

    await waitFor(() => expect(screen.getByText(/The server refused/)).toBeInTheDocument());
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("the panel's declaration", () => {
  it('reads the published support rather than declaring it again', () => {
    const source = fs.readFileSync(editorPath, 'utf8');

    expect(source, 'the panel must read the published support, not declare its own').not.toMatch(
      /(?:const|let)\s+\w*(?:PUBLISH|EXECUT)\w*\s*[:=]/,
    );

    expect(source).toMatch(
      /import\s*\{[^}]*canPublishResource[^}]*\}\s*from '@personal-os\/contracts'/,
    );
    expect(source).toMatch(
      /import\s*\{[^}]*canExecuteResource[^}]*\}\s*from '@personal-os\/contracts'/,
    );
  });
});
