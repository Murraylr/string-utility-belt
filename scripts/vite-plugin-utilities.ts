import type { Plugin, ViteDevServer } from 'vite'
import { spawn } from 'node:child_process'
import path from 'node:path'

/**
 * Dev-server only: regenerate the utility manifest when a utility is added,
 * removed or edited, so "create a folder and it appears" keeps working without
 * restarting `npm run dev`. The generator writes only files whose content
 * changed, and Vite's HMR picks those up.
 */
export function utilityManifest(): Plugin {
  const UTILITY_FILE = /[\\/]src[\\/]utilities[\\/][^\\/_][^\\/]*[\\/]index\.tsx?$/
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false

  const run = (server: ViteDevServer) => {
    if (running) { pending = true; return }
    running = true
    const root = server.config.root
    const child = spawn(process.execPath, [path.join(root, 'node_modules/vite-node/vite-node.mjs'), 'scripts/gen.ts'], {
      cwd: root, stdio: ['ignore', 'inherit', 'inherit'],
    })
    child.on('exit', () => {
      running = false
      if (pending) { pending = false; run(server) }
    })
  }

  return {
    name: 'utility-manifest',
    apply: 'serve',
    configureServer(server) {
      // vitest also spins up a Vite server; the manifest freshness test covers it
      if (process.env.VITEST) return
      const onFs = (file: string) => {
        if (!UTILITY_FILE.test(file)) return
        clearTimeout(timer)
        timer = setTimeout(() => run(server), 300)
      }
      server.watcher.on('add', onFs)
      server.watcher.on('unlink', onFs)
      server.watcher.on('change', onFs)
    },
  }
}
