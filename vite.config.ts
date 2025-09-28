import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(async ({ mode, command }) => {
  const plugins = [react()];

  // Enable CF plugin only when not testing, and only when you actually want Workers
  const enableCloudflare =
    mode !== 'test' &&
    !process.env.VITEST &&                // Vitest guard
    (process.env.CF_PAGES || process.env.CF_WORKER); // opt-in via env

  if (enableCloudflare) {
    const cloudflare = (await import('@cloudflare/vite-plugin')).default;
    plugins.push(cloudflare());
  }

  return {
    plugins,
    // Vitest config (so it doesn't try to bring in the CF plugin)
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: 'vitest.setup.ts', // keep or remove if you don't use it
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  };
});