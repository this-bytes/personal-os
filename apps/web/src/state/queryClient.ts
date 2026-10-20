/**
 * The shared react-query client.
 *
 * Live updates arrive over SSE, so the client does not refetch on window
 * focus. A single retry is enough for a transient network hiccup; anything
 * else surfaces as an explicit error state.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
