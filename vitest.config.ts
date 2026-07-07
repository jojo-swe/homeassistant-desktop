import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/unit/**/*.test.ts', 'src/test/packaging/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/**/*.test.ts', 'src/test/**', 'src/main/**/*.d.ts', 'src/main/types.ts', 'src/main/index.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@test': resolve(__dirname, 'src/test'),
    },
  },
});
