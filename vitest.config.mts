import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Minimal Vitest setup — unit tests for pure `lib` modules only.
 *
 * Scope is deliberately narrow: no jsdom, no React, no Next plugin. Tests live
 * next to the code they cover as `*.test.ts` under `src/app/lib/`. Run with
 * `npm test` (CI) or `npm run test:watch` (local).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  test: {
    include: ['src/app/lib/**/*.test.ts'],
    environment: 'node',
  },
});
