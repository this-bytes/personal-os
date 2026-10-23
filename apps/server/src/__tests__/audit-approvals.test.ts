import { afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './helpers.js';
import type { DatabaseHandle } from '../db/client.js';
import { createAuditService } from '../modules/audit/service.js';
import { createApprovalsService } from '../modules/approvals/service.js';
import { EventsService } from '../modules/events/service.js';

let handle: DatabaseHandle | null = null;

afterEach(() => {
  handle?.close();
  handle = null;
});

describe('the audit trail', () => {
  it('records who did what', () => {
    handle = createTestDatabase();
    const audit = createAuditService(handle.db);

    const entry = audit.record({
      workspaceId: 'wsp_1',
      actorType: 'human',
      actorId: 'usr_1',
      action: 'agent.created',
      targetType: 'agent',
      targetId: 'agt_1',
      metadata: { adapterType: 'echo' },
    });

    expect(entry.actorType).toBe('human');
    expect(entry.actorId).toBe('usr_1');
    expect(entry.action).toBe('agent.created');
    expect(entry.targetId).toBe('agt_1');
    expect(entry.result).toBe('success');
  });

  it('lists entries newest first', () => {
    handle = createTestDatabase();
    const audit = createAuditService(handle.db);

    audit.record({ workspaceId: 'wsp_1', actorType: 'human', actorId: 'usr_1', action: 'first' });
    audit.record({ workspaceId: 'wsp_1', actorType: 'human', actorId: 'usr_1', action: 'second' });

    const entries = audit.list('wsp_1');
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe('second');
  });

  it('does not mix workspaces', () => {
    handle = createTestDatabase();
    const audit = createAuditService(handle.db);

    audit.record({ workspaceId: 'wsp_1', actorType: 'human', actorId: 'usr_1', action: 'a' });
    audit.record({ workspaceId: 'wsp_2', actorType: 'human', actorId: 'usr_1', action: 'b' });

    expect(audit.list('wsp_1')).toHaveLength(1);
  });
});

describe('approvals', () => {
  it('starts pending', () => {
    handle = createTestDatabase();
    const approvals = createApprovalsService(handle.db, new EventsService(handle.db));

    const approval = approvals.request({
      workspaceId: 'wsp_1',
      executionId: 'exe_1',
      summary: 'Delete the production database',
    });

    expect(approval.status).toBe('pending');
    expect(approval.decidedBy).toBeNull();
  });

  it('records a decision', () => {
    handle = createTestDatabase();
    const approvals = createApprovalsService(handle.db, new EventsService(handle.db));

    const approval = approvals.request({
      workspaceId: 'wsp_1',
      summary: 'Run a destructive command',
    });
    const decided = approvals.decide(approval.id, {
      approved: true,
      reason: 'It is my own homelab',
      decidedBy: 'usr_1',
    });

    expect(decided.status).toBe('approved');
    expect(decided.reason).toBe('It is my own homelab');
    expect(decided.decidedBy).toBe('usr_1');
    expect(decided.decidedAt).not.toBeNull();
  });

  it('refuses to decide the same request twice', () => {
    handle = createTestDatabase();
    const approvals = createApprovalsService(handle.db, new EventsService(handle.db));

    const approval = approvals.request({ workspaceId: 'wsp_1', summary: 'Something' });
    approvals.decide(approval.id, { approved: true, decidedBy: 'usr_1' });

    expect(() => approvals.decide(approval.id, { approved: false, decidedBy: 'usr_1' })).toThrow(
      /already been/i,
    );
  });

  it('filters by status', () => {
    handle = createTestDatabase();
    const approvals = createApprovalsService(handle.db, new EventsService(handle.db));

    const first = approvals.request({ workspaceId: 'wsp_1', summary: 'One' });
    approvals.request({ workspaceId: 'wsp_1', summary: 'Two' });
    approvals.decide(first.id, { approved: true, decidedBy: 'usr_1' });

    expect(approvals.list('wsp_1', 'pending')).toHaveLength(1);
    expect(approvals.list('wsp_1', 'approved')).toHaveLength(1);
  });
});
