import type { McpToolName } from '@personal-os/contracts';

/**
 * What the owner changed in the grant editor.
 *
 * `enable` is what the owner turned on and `disable` is what they turned off,
 * both measured against the grant the editor was opened with.
 */
export interface GrantChange {
  enable: McpToolName[];
  disable: McpToolName[];
}

/**
 * The change the owner made in the grant editor.
 *
 * The editor shows the grant the page read, and the owner turns some of it.
 * **What they turned is the change.** The rest of the grant is not theirs to
 * undo: a widening another writer committed after the page read is still that
 * writer's, and a save that carried the whole list would take it back.
 *
 * The function is pure, so the editor and the measurement of it use one rule
 * rather than two.
 */
export function grantChange(base: McpToolName[], selected: McpToolName[]): GrantChange {
  const baseSet = new Set(base);
  const selectedSet = new Set(selected);
  return {
    enable: selected.filter((tool) => !baseSet.has(tool)),
    disable: base.filter((tool) => !selectedSet.has(tool)),
  };
}
