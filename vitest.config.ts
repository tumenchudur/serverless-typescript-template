import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules/', 'dist/', '.serverless/', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.serverless/',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/index.ts',
        'drizzle/**',
        'scripts/**'
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@template/libs': path.resolve(__dirname, './packages/libs/src'),
      '@template/contracts': path.resolve(__dirname, './packages/contracts/src')
    }
  }
});
