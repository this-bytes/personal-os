import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These integration files spawn servers and Git processes. CPU-count-sized
    // pools overload mounted workspaces and make process deadlines race startup.
    // Independent checkouts still run independently; callers can override via CLI.
    maxWorkers: 2,
  },
});
