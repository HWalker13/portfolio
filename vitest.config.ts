import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'integrations/**/*.test.mjs'],
    environment: 'node',
  },
});
