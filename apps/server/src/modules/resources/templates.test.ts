import { describe, expect, it } from 'vitest';
import { findTemplate, listTemplates, mergeTemplateSpec, resourceTemplates } from './templates.js';

/**
 * The merge rules, and the registry they are read from.
 *
 * The merge is not a judge: it merges, and the owning provider judges the
 * result. These are the rules it merges by, and they are pure functions, so
 * they are pinned here without a database.
 */

function template(id: string): {
  type: 'dashboard' | 'document' | 'data-source' | 'automation' | 'task' | 'memory';
  spec: unknown;
} {
  const found = findTemplate(resourceTemplates, { id });
  if (!found) throw new Error(`no template "${id}"`);
  return { type: found.type, spec: found.spec };
}

describe('the registry', () => {
  it('publishes one template for each of the six kinds, and every one has a guide', () => {
    const kinds = ['dashboard', 'document', 'data-source', 'automation', 'task', 'memory'];
    for (const kind of kinds) {
      const published = listTemplates(resourceTemplates, kind as never);
      expect(published, `the ${kind} kind published no template`).toHaveLength(1);
      const guide = published[0]!.guide;
      expect(guide.summary.length).toBeGreaterThan(0);
      expect(guide.whenToUse.length).toBeGreaterThan(0);
      expect(guide.whenNotToUse.length).toBeGreaterThan(0);
      expect(guide.mistakes.length).toBeGreaterThan(0);
      expect(guide.checklist.length).toBeGreaterThan(0);
    }
  });

  it('lists the templates of every kind when no kind is named', () => {
    expect(listTemplates(resourceTemplates)).toHaveLength(6);
  });

  it('names a field the agent has to set as one it has to set', () => {
    const dashboard = findTemplate(resourceTemplates, { id: 'dashboard.metrics' })!;
    const binding = dashboard.guide.fields.find((field) => field.path === 'widgets[].dataSourceId');
    expect(binding?.mustSet).toBe(true);
  });
});

describe('the merge', () => {
  it('keeps what the caller did not name', () => {
    const { type, spec } = template('document.brief');
    const merged = mergeTemplateSpec(type, spec, { content: 'mine' }) as Record<string, unknown>;

    expect(merged.content).toBe('mine');
    // The format and the tags are the template's, because the caller named
    // neither.
    expect(merged.format).toBe('markdown');
    expect(merged.tags).toEqual(['brief']);
  });

  it('replaces an array wholesale, because an array is a single choice', () => {
    const { type, spec } = template('document.brief');
    const merged = mergeTemplateSpec(type, spec, { tags: ['only'] }) as Record<string, unknown>;

    expect(merged.tags).toEqual(['only']);
  });

  it('merges a dashboard’s widgets by the widget’s own id', () => {
    const { type, spec } = template('dashboard.metrics');
    const merged = mergeTemplateSpec(type, spec, {
      widgets: [{ id: 'summary', dataSourceId: 'ds_1' }],
    }) as { widgets: Record<string, unknown>[] };

    // The widget the caller named is updated field by field, and keeps the
    // parts it did not name.
    const summary = merged.widgets.find((widget) => widget.id === 'summary')!;
    expect(summary.dataSourceId).toBe('ds_1');
    expect(summary.type).toBe('metric');
    expect(summary.title).toBe('Records');

    // The widget the caller did not name survives.
    expect(merged.widgets.some((widget) => widget.id === 'recent')).toBe(true);
    expect(merged.widgets).toHaveLength(2);
  });

  it('appends a widget the template does not have, after the template’s widgets', () => {
    const { type, spec } = template('dashboard.metrics');
    const merged = mergeTemplateSpec(type, spec, {
      widgets: [{ id: 'extra', type: 'text', title: 'Extra' }],
    }) as { widgets: { id: string }[] };

    expect(merged.widgets.map((widget) => widget.id)).toEqual(['summary', 'recent', 'extra']);
  });

  it('replaces a widget whose type changed, because a metric is not a table', () => {
    const { type, spec } = template('dashboard.metrics');
    const merged = mergeTemplateSpec(type, spec, {
      widgets: [{ id: 'summary', type: 'chart' }],
    }) as { widgets: Record<string, unknown>[] };

    const summary = merged.widgets.find((widget) => widget.id === 'summary')!;
    expect(summary.type).toBe('chart');
    // The widget is the caller's, whole: it keeps no binding from the
    // template.
    expect(summary.binding).toBeUndefined();
  });

  it('replaces the spec when the shape key changes, so a data source keeps no payload', () => {
    const { type, spec } = template('data-source.json');
    const merged = mergeTemplateSpec(type, spec, {
      kind: 'http',
      url: 'https://example.com/rows.json',
    }) as Record<string, unknown>;

    expect(merged.kind).toBe('http');
    expect(merged.payload).toBeUndefined();
  });

  it('replaces a memory whole when its scope changes', () => {
    const { type, spec } = template('memory.decision-note');
    const merged = mergeTemplateSpec(type, spec, {
      scope: 'agent',
      agentConnectionId: 'agt_1',
      key: 'notes.decision',
      value: { decision: 'Ship it', why: 'It works' },
    }) as Record<string, unknown>;

    expect(merged.scope).toBe('agent');
    expect(merged.value).toEqual({ decision: 'Ship it', why: 'It works' });
    // The template's tags did not survive the change of scope.
    expect(merged.tags).toBeUndefined();
  });

  it('replaces a memory’s value whole, because the value is the memory', () => {
    const { type, spec } = template('memory.decision-note');
    const merged = mergeTemplateSpec(type, spec, {
      value: { decision: 'Ship it' },
    }) as Record<string, unknown>;

    expect(merged.value).toEqual({ decision: 'Ship it' });
  });

  it('replaces an automation’s trigger and action whole', () => {
    const { type, spec } = template('automation.manual-prompt');
    const merged = mergeTemplateSpec(type, spec, {
      action: { type: 'agent.prompt', agentConnectionId: 'agt_1', prompt: 'Do the thing' },
    }) as Record<string, unknown>;

    const action = merged.action as Record<string, unknown>;
    expect(action.agentConnectionId).toBe('agt_1');
    expect(action.prompt).toBe('Do the thing');
    // The trigger was not named, so it is the template’s.
    expect(merged.trigger).toEqual({ type: 'manual' });
  });

  it('keeps the template’s spec when the caller names nothing', () => {
    const { type, spec } = template('document.brief');
    expect(mergeTemplateSpec(type, spec, undefined)).toEqual(spec);
  });
});
