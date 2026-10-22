import type { Measure, Measures } from '@personal-os/contracts';
import type { AuditService } from '../audit/service.js';
import type { ResourceService } from '../resources/service.js';

/**
 * The product's two measures of itself.
 *
 * Both measures are counted from the data the product already keeps — the
 * authorship a resource carries, and the entries the audit trail holds — and
 * not from a counter that is incremented on some code path. A counter cannot
 * answer "of the things that exist, how many were made by an agent".
 */
export interface MeasuresService {
  /** The two measures, for one workspace. */
  measures(workspaceId: string): Measures;
}

export interface MeasuresServiceOptions {
  resources: ResourceService;
  audit: AuditService;
}

export function createMeasuresService(options: MeasuresServiceOptions): MeasuresService {
  const { resources, audit } = options;

  return {
    measures(workspaceId): Measures {
      const authorship = resources.authorshipCounts(workspaceId);
      const audited = audit.count(workspaceId);
      const performedByAgents = audit.count(workspaceId, 'agent');

      return {
        workspaceId,
        agentAuthoredResources: measure(authorship.agentAuthored, authorship.total),
        agentPerformedOperations: measure(performedByAgents, audited),
      };
    },
  };
}

/**
 * A measure from its count and its denominator.
 *
 * There is no ratio when there is no denominator: a share of nothing is not
 * zero, and the count is still returned.
 */
function measure(count: number, denominator: number): Measure {
  return { count, denominator, ratio: denominator === 0 ? null : count / denominator };
}
