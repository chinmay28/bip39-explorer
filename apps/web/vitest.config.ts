import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@data': fileURLToPath(new URL('../../data', import.meta.url)) },
  },
  define: { __APP_VERSION__: JSON.stringify('v0.0.0-test') },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
