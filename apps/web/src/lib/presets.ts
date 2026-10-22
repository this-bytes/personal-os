/**
 * The preset catalogue, as the client sees it.
 *
 * The catalogue is published data that lives in the contracts package and is
 * served by the server at `GET /api/agent-presets`. The client reads it from
 * there, so the server owns one view of it and the browser cannot hold a
 * copy that has drifted.
 *
 * A preset is a **starting template**, not a claim that an integration works.
 * The client shows that difference: a template nobody has run against a real
 * runtime wears the caution treatment and says so, because the owner is the
 * one who has to decide whether to trust it.
 */

import { useQuery } from '@tanstack/react-query';
import type { AdapterPreset, AdapterType } from '@personal-os/contracts';
import { api, errorMessage } from './api';

export interface AgentPresets {
  /** The catalogue. Empty while it loads, and empty when it could not be read. */
  presets: AdapterPreset[];
  /** Whether the catalogue is still being read. */
  loading: boolean;
  /** Why the catalogue could not be read, when it could not. */
  error: string | null;
}

/**
 * Read the preset catalogue.
 *
 * A failure here is a notice, not a failure: the form still works with no
 * template chosen, so the catalogue is allowed to be missing.
 */
export function useAgentPresets(): AgentPresets {
  const query = useQuery<AdapterPreset[]>({
    queryKey: ['agent-presets'],
    queryFn: () =>
      api.get<{ presets: AdapterPreset[] }>('/agent-presets').then((response) => response.presets),
    staleTime: 5 * 60 * 1000,
  });

  return {
    presets: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? errorMessage(query.error) : null,
  };
}

/** The presets of one adapter type, in the order the catalogue holds them. */
export function presetsForType(presets: AdapterPreset[], type: AdapterType): AdapterPreset[] {
  return presets.filter((preset) => preset.adapterType === type);
}

/**
 * The preset the catalogue holds under an id, or nothing when it holds none.
 */
export function findPreset(presets: AdapterPreset[], id: string | null): AdapterPreset | undefined {
  if (!id) return undefined;
  return presets.find((preset) => preset.id === id);
}
