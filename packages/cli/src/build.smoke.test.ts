// @vitest-environment node
/**
 * Exercises the actual built binary (packages/cli/dist/subelt.mjs), not the
 * in-process `main()`. Skipped when the build hasn't been run — see the
 * repo root's `npm run build:cli`.
 */
import { execFile } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const DIST_DIR = path.resolve(__dirname, '../dist')
const DIST = path.join(DIST_DIR, 'subelt.mjs')
const hasBuild = existsSync(DIST)

/** Run the binary at `bin` with `args`, feeding `stdin`. */
async function run(bin: string, args: string[], stdin = '') {
  const child = execFileAsync(process.execPath, [bin, ...args], { encoding: 'utf8' })
  // util.promisify(execFile) exposes the ChildProcess as `.child`, so stdin can be written directly.
  child.child.stdin?.end(stdin)
  return child
}

function distFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? distFiles(path.join(dir, e.name)) : e.name.endsWith('.mjs') ? [path.join(dir, e.name)] : [])
}

describe.skipIf(!hasBuild)('built binary', () => {
  it('encodes piped stdin', async () => {
    const { stdout } = await run(DIST, ['base64_encode'], 'hello\n')
    expect(stdout).toBe('aGVsbG8K')
  })

  it('imports nothing but Node built-ins and its own chunks (npx installs no dependencies)', () => {
    const builtins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])
    const bare: string[] = []
    for (const file of distFiles(DIST_DIR)) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/(?:^import[^'"\n]*?from\s*|^import\s*|\bimport\()\s*['"]([^'"]+)['"]/gm)) {
        const spec = m[1]
        if (!spec.startsWith('.') && !builtins.has(spec)) bare.push(`${path.basename(file)}: ${spec}`)
      }
    }
    expect(bare).toEqual([])
  })

  it('runs from a copy of dist/ with no node_modules anywhere above it', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'subelt-standalone-'))
    try {
      cpSync(DIST_DIR, dir, { recursive: true })
      const bin = path.join(dir, 'subelt.mjs')
      expect((await run(bin, ['base64_encode'], 'hello\n')).stdout).toBe('aGVsbG8K')
      // a lazily-imported dependency chunk (yaml) loads from the copy too
      expect((await run(bin, ['yaml_to_json'], 'a: 1\n')).stdout).toContain('"a": 1')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30000)

  it('types piped text as text, like the app (md5 prints hex)', async () => {
    const { stdout } = await run(DIST, ['md5'], 'hello')
    expect(stdout).toBe('5d41402abc4b2a76b9719d911017c592')
  })

  it('runs custom JS on a worker thread and kills it at the timeout', async () => {
    const ok = await run(DIST, ['--allow-custom-js', 'custom_js:code=console.log("dbg"); return input.toUpperCase()'], 'hi')
    expect(ok.stdout).toBe('HI')
    expect(ok.stderr).toContain('dbg')
    const t0 = Date.now()
    await expect(run(DIST, ['--allow-custom-js', 'custom_js:code=for(;;) await 0,timeoutMs=300'], 'hi'))
      .rejects.toMatchObject({ code: 1, stderr: expect.stringMatching(/timed out/) })
    expect(Date.now() - t0).toBeLessThan(10000)
  }, 30000)

  it('supports --version and --help', async () => {
    const version = await execFileAsync(process.execPath, [DIST, '--version'])
    expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
    const help = await execFileAsync(process.execPath, [DIST, '--help'])
    expect(help.stdout).toMatch(/^subelt/)
  })

  it('exits 2 on a usage error', async () => {
    await expect(execFileAsync(process.execPath, [DIST, '--nope'])).rejects.toMatchObject({ code: 2 })
  })
})

if (!hasBuild) {
  // Vitest requires at least one assertion path to run; document why nothing ran.
  it.skip('build smoke test skipped: packages/cli/dist/subelt.mjs not built yet (run npm run build:cli)', () => {})
}
