import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * The product's two measures of itself.
 *
 * A measure is a count, its denominator, and a ratio. The ratio is never
 * returned without the two it came from, because a client that reads the
 * ratio has to know what it is a ratio of.
 */
export const measureSchema = z.object({
  count: z.number().int().min(0),
  denominator: z.number().int().min(0),
  /**
   * The exact fraction `count / denominator`, between 0 and 1.
   *
   * It is `null` when there is no denominator. A share of nothing is not
   * zero: a panel that greets its owner with 0% reads as broken, and the
   * product's first report on itself must not be a lie by omission.
   */
  ratio: z.number().min(0).max(1).nullable(),
});
export type Measure = z.infer<typeof measureSchema>;

/** The two measures, for one workspace. */
export const measuresSchema = z.object({
  workspaceId: idSchema,
  /** The share of the workspace's resources that an agent authored. */
  agentAuthoredResources: measureSchema,
  /** The share of the workspace's audited operations that an agent performed. */
  agentPerformedOperations: measureSchema,
});
export type Measures = z.infer<typeof measuresSchema>;
