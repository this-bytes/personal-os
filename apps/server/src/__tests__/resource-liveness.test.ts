import { afterEach, describe, expect, it } from 'vitest';
import { createTestStack, type TestStack } from './helpers.js';
import {
  listTemplates,
  mergeTemplateSpec,
  resourceTemplates,
} from '../modules/resources/templates.js';
import type { Resource } from '@personal-os/contracts';

let stack: TestStack | null = null;

afterEach(() => {
  stack?.close();
  stack = null;
});

/** The one template of a kind the registry publishes. */
function templateOf(type: 'dashboard' | 'automation') {
  const template = listTemplates(resourceTemplates, type)[0];
  if (!template) throw new Error(`the registry publishes no ${type} template`);
  return template;
}

/** The spec a dashboard carries, as the contract publishes it. */
function dashboardSpec(resource: Resource): { published: boolean } {
  return resource.data as { published: boolean };
}

/**
 * The MCP `resource.create` path, reproduced exactly: the template is
 * resolved, the caller's values are merged into its spec, and the result is
 * handed to the owning provider.
 *
 * The merge is the MCP tool's own, so this case measures the real path
 * rather than a shape that resembles it.
 */
function fromTemplate(
  type: 'dashboard' | 'automation',
  override: Record<string, unknown>,
): { data: unknown; template: { id: string; version: number } } {
  const template = templateOf(type);
  return {
    data: mergeTemplateSpec(type, template.spec, override),
    template: { id: template.id, version: template.version },
  };
}

describe('a resource is never born live', () => {
  it('makes a dashboard from a template a draft, whatever the caller asked for', () => {
    stack = createTestStack();
    const { data, template } = fromTemplate('dashboard', { published: true });

    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'dashboard',
      title: 'Homelab',
      data,
      author: { kind: 'owner' },
      template,
    });

    expect(dashboardSpec(created).published).toBe(false);
    expect(created.templateId).toBe(template.id);
  });

  it('makes a dashboard made outright a draft as well', () => {
    stack = createTestStack();

    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'dashboard',
      title: 'Homelab',
      data: { widgets: [], refreshSeconds: 30, published: true },
      author: { kind: 'owner' },
    });

    expect(dashboardSpec(created).published).toBe(false);
  });

  it('keeps an automation made from a template disabled, whatever the caller asked for', () => {
    stack = createTestStack();
    const { data, template } = fromTemplate('automation', { enabled: true });

    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'automation',
      title: 'A summary, on demand',
      data,
      author: { kind: 'owner' },
      template,
    });

    expect((created.data as { enabled: boolean }).enabled).toBe(false);
  });

  it('still lets a dashboard be published, which is a separate act', () => {
    stack = createTestStack();
    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'dashboard',
      title: 'Homelab',
      data: { widgets: [], refreshSeconds: 30 },
      author: { kind: 'owner' },
    });
    expect(dashboardSpec(created).published).toBe(false);

    const published = stack.resources.publish(created.id);

    expect(dashboardSpec(published).published).toBe(true);
    expect(published.revision).toBe(created.revision + 1);
  });

  it('still lets an update make a dashboard live, because that is deliberate too', () => {
    stack = createTestStack();
    const created = stack.resources.create({
      workspaceId: 'wsp_1',
      type: 'dashboard',
      title: 'Homelab',
      data: { widgets: [], refreshSeconds: 30 },
      author: { kind: 'owner' },
    });

    const updated = stack.resources.update(created.id, {
      expectedRevision: created.revision,
      data: { widgets: [], refreshSeconds: 30, published: true },
    });

    expect(dashboardSpec(updated).published).toBe(true);
  });
});
