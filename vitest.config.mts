import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // must mirror tsconfig.json "paths"
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 15_000,
    // Serialise. Parallel workers contend for CPU and skew the timing budgets
    // asserted in scheduler.perf.test.ts.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
  },
});
