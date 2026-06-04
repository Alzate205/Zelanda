import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // 'server-only' es un marcador de Next.js sin runtime; lo stubbeamos en tests.
      'server-only': path.resolve(__dirname, './test-stubs/server-only.ts'),
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    globals: true,
    // Los tests son lógica pura (sin DOM): 'node' es más rápido y estable que jsdom.
    environment: 'node',
    setupFiles: [],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
  },
});
