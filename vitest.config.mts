import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/test/unit/**/*.test.ts', 'src/test/packaging/**/*.test.ts'],
          setupFiles: ['src/test/component/setup.ts'],
        },
      },
      {
        extends: true,
        plugins: [svelte({ hot: false })] as any,
        test: {
          name: 'component',
          environment: 'jsdom',
          environmentOptions: {
            jsdom: { url: 'http://localhost' },
          },
          include: ['src/test/component/**/*.test.ts'],
          setupFiles: ['src/test/component/setup.ts'],
        },
        resolve: {
          conditions: ['browser'],
        },
      },
    ],
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
