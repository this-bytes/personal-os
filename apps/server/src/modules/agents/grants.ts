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
