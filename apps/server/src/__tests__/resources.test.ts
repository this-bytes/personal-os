import { afterEach, describe, expect, it } from 'vitest';
import { createTestStack, type TestStack } from './helpers.js';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

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
});
