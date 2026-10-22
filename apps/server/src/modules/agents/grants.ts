import { defaultAgentToolGrants, type McpToolName } from '@personal-os/contracts';

/**
 * The tools a connection may call.
 *
 * A connection with no stored grants may call the default agent set. A
 * connection with a stored list may call exactly that list, and an empty list
 * means it may call nothing at all.
 *
 * This is the one rule about what a grant means, so every place that reads a
 * grant reads it through here.
 */
export function effectiveToolGrants(granted: McpToolName[] | null | undefined): McpToolName[] {
  return granted ?? [...defaultAgentToolGrants];
}

/**
 * Whether two grant sets are the same set.
 *
 * A grant is a set: the order the tools happen to be stored in is not part of
 * what the grant means, so two lists holding the same tools are one grant and
 * not two.
 */
export function sameToolGrants(left: McpToolName[], right: McpToolName[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((tool, index) => tool === b[index]);
}
