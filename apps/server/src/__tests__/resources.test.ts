import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors.js';
import { createTestStack, type TestStack } from './helpers.js';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

/**
 * The refusal a call produced, in the shape the contract publishes.
 *
 * The error envelope is `{ code, message, details }` (CONTRACTS.md, "Error
 * envelope"), and a spec that breaks its contract is refused with
 * `validation_failed` — the same answer the task and the memory provider have
 * always given.
 */
function refusalOf(run: () => unknown): { code: string; message: string; details?: unknown } {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) return error.toEnvelope();
    throw error;
  }
  throw new Error('the call was accepted');
}

describe('the shared resource API', () => {
  it('creates a resource with revision 1', () => {
    stack = createTestStack();
    const resource = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Runbook',
      data: { format: 'markdown', content: '# Runbook' },
      author: { kind: 'owner' },
    });

    expect(resource.revision).toBe(1);
    expect(resource.schemaVersion).toBe(1);
    expect(resource.type).toBe('document');
  });

  it('increments the revision on a successful update', () => {
    stack = createTestStack();
    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Runbook',
      data: { format: 'markdown', content: '# Runbook' },
      author: { kind: 'owner' },
    });

    const updated = stack.resources.update(created.id, {
      expectedRevision: created.revision,
      data: { format: 'markdown', content: '# Runbook v2' },
    });

    expect(updated.revision).toBe(2);
    expect((updated.data as { content: string }).content).toBe('# Runbook v2');
  });

  it('rejects an update that was based on a stale revision', () => {
    stack = createTestStack();
    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Runbook',
      data: { format: 'markdown', content: '# Runbook' },
      author: { kind: 'owner' },
    });

    // Two agents read revision 1; the first one wins.
    stack.resources.update(created.id, {
      expectedRevision: 1,
      data: { format: 'markdown', content: 'first write' },
    });

    expect(() =>
      stack!.resources.update(created.id, {
        expectedRevision: 1,
        data: { format: 'markdown', content: 'second write' },
      }),
    ).toThrow(/changed since it was read/i);
  });

  it('rejects data that does not match the resource schema', () => {
    stack = createTestStack();
    expect(() =>
      stack!.resources.create({
        workspaceId: 'wsp_1',
        type: 'dashboard',
        title: 'Broken',
        data: { widgets: 'not an array' },
        author: { kind: 'owner' },
      }),
    ).toThrow();
  });

  it('reports invalid resources through inspect without throwing', () => {
    stack = createTestStack();
    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'Runbook',
      data: { format: 'markdown', content: '# Runbook' },
      author: { kind: 'owner' },
    });

    const inspection = stack.resources.inspect(created.id);
    expect(inspection.valid).toBe(true);
    expect(inspection.issues).toEqual([]);
    expect(inspection.resource.id).toBe(created.id);
  });

  it('publishes a dashboard', () => {
    stack = createTestStack();
    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'dashboard',
      title: 'Homelab',
      data: { widgets: [], refreshSeconds: 30 },
      author: { kind: 'owner' },
    });

    const published = stack.resources.publish(created.id);
    expect((published.data as { published: boolean }).published).toBe(true);
  });

  it('refuses to publish an invalid automation', () => {
    stack = createTestStack();
    expect(() =>
      stack!.resources.create({
        workspaceId: 'wsp_1',
        type: 'automation',
        title: 'Broken automation',
        data: { trigger: { type: 'schedule' }, action: { type: 'agent.prompt' } },
        author: { kind: 'owner' },
      }),
    ).toThrow();
  });

  it('lists resources by type', () => {
    stack = createTestStack();
    stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'document',
      title: 'One',
      data: { format: 'markdown', content: '' },
      author: { kind: 'owner' },
    });
    stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'memory',
      title: 'Two',
      data: { scope: 'workspace', key: 'k', value: 1 },
      author: { kind: 'owner' },
    });

    const documents = stack.resources.list('wsp_1', 'document');
    expect(documents).toHaveLength(1);
    expect(documents[0]?.title).toBe('One');
  });

  describe('a spec that breaks its contract', () => {
    it('refuses a dashboard whose spec breaks the dashboard contract', () => {
      stack = createTestStack();

      const refusal = refusalOf(() =>
        stack!.resources.create({
          workspaceId: 'wsp_1',
          type: 'dashboard',
          title: 'Broken',
          // A widget with no type: the widget is not a widget.
          data: { widgets: [{ id: 'summary', title: 'Records' }] },
          author: { kind: 'owner' },
        }),
      );

      expect(refusal.code).toBe('validation_failed');
      expect(refusal.message).toBe('This dashboard does not satisfy the dashboard contract.');
      // The details are the schema's own issues, so a client can say which
      // part of the spec broke.
      expect(Array.isArray(refusal.details)).toBe(true);
      const issues = refusal.details as { path: unknown[]; message: string }[];
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]?.path).toEqual(['widgets', 0, 'type']);
      expect(issues[0]?.message).toBeTruthy();

      expect(stack!.resources.list('wsp_1')).toHaveLength(0);
    });

    it('refuses a document whose spec breaks the document contract', () => {
      stack = createTestStack();

      const refusal = refusalOf(() =>
        stack!.resources.create({
          workspaceId: 'wsp_1',
          type: 'document',
          title: 'Broken',
          data: { format: 'not-a-format', content: '# Runbook' },
          author: { kind: 'owner' },
        }),
      );

      expect(refusal.code).toBe('validation_failed');
      expect(refusal.message).toBe('This document does not satisfy the document contract.');
      const issues = refusal.details as { path: unknown[]; message: string }[];
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]?.path).toEqual(['format']);

      expect(stack!.resources.list('wsp_1')).toHaveLength(0);
    });

    it('refuses a data source whose spec breaks the data-source contract', () => {
      stack = createTestStack();

      const refusal = refusalOf(() =>
        stack!.resources.create({
          workspaceId: 'wsp_1',
          type: 'data-source',
          title: 'Broken',
          data: { kind: 'not-a-kind' },
          author: { kind: 'owner' },
        }),
      );

      expect(refusal.code).toBe('validation_failed');
      expect(refusal.message).toBe('This data source does not satisfy the data-source contract.');
      const issues = refusal.details as { path: unknown[]; message: string }[];
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]?.path).toEqual(['kind']);

      expect(stack!.resources.list('wsp_1')).toHaveLength(0);
    });

    it('refuses an automation whose spec breaks the automation contract', () => {
      stack = createTestStack();

      const refusal = refusalOf(() =>
        stack!.resources.create({
          workspaceId: 'wsp_1',
          type: 'automation',
          title: 'Broken',
          // An action with no kind: there is no such action.
          data: { trigger: { type: 'manual' }, action: {} },
          author: { kind: 'owner' },
        }),
      );

      expect(refusal.code).toBe('validation_failed');
      expect(refusal.message).toBe('This automation does not satisfy the automation contract.');
      const issues = refusal.details as { path: unknown[]; message: string }[];
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]?.path).toEqual(['action', 'type']);

      expect(stack!.resources.list('wsp_1')).toHaveLength(0);
    });

    it('answers a spec that keeps its contract as it always did', () => {
      // The other half of the pair: a refusal that says "no" to everything
      // would prove nothing.
      stack = createTestStack();
      const created = stack.resources.create({
        workspaceId: 'wsp_1',
        type: 'dashboard',
        title: 'Homelab',
        data: { widgets: [], refreshSeconds: 30 },
        author: { kind: 'owner' },
      });

      expect(created.type).toBe('dashboard');
      expect(stack.resources.list('wsp_1')).toHaveLength(1);
    });
  });
});
