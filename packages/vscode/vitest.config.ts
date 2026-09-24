import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Optional scoped config for running just this package's tests (Node environment,
 * no jsdom setup). The tests also run under the repo root config — nothing in them
 * resolves the host-only `vscode` module, which the commands receive as a parameter.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
