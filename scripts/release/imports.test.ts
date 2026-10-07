// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importGraph, moduleSpecifiers, packageName } from './imports'

let dir: string
const write = (files: Record<string, string>) => {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    writeFileSync(path.join(dir, file), content)
  }
}

beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'release-imports-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('moduleSpecifiers', () => {
  it('finds static, re-exported, side-effect, dynamic and require imports', () => {
    expect(moduleSpecifiers([
      "import a, { b } from './a'",
      "import * as c from \"c-pkg\"",
      "export { d } from '@/d'",
      "export * from './e'",
      "import 'side-effect'",
      "const f = await import('lazy-pkg')",
      "const g = require('cjs-pkg')",
      "import {\n  multi,\n  line,\n} from 'multi-line'",
    ].join('\n'))).toEqual(['./a', 'c-pkg', '@/d', './e', 'side-effect', 'lazy-pkg', 'cjs-pkg', 'multi-line'])
  })

  it('skips type-only imports, which the build erases, but not inline type modifiers', () => {
    expect(moduleSpecifiers("import type { A } from 'types-only'\nexport type { B } from './types'\nimport { type C, d } from 'mixed'"))
      .toEqual(['mixed'])
  })
})

describe('packageName', () => {
  it('names the package a specifier imports, and nothing for Node built-ins', () => {
    expect(packageName('yaml')).toBe('yaml')
    expect(packageName('@modelcontextprotocol/sdk/server/mcp.js')).toBe('@modelcontextprotocol/sdk')
    expect(packageName('lodash/fp')).toBe('lodash')
    expect(packageName('node:fs')).toBeNull()
    expect(packageName('fs')).toBeNull()
    expect(packageName('fs/promises')).toBeNull()
  })
})

describe('importGraph', () => {
  it('follows relative and @/ imports and HTML scripts, collecting the npm packages they import', () => {
    write({
      'pkg/page.html': '<html><script type="module" src="./src/page.ts"></script></html>',
      'pkg/src/page.ts': "import { x } from './lib'\nimport type { T } from 'typed-only'\n",
      'pkg/src/lib/index.ts': "import '@/core/engine'\nimport { readFileSync } from 'node:fs'\nexport const x = await import('yaml')\n",
      'src/core/engine.ts': "import { parse } from 'smol-toml'\nimport data from './data.json'\n",
      'src/core/data.json': '{}',
      'src/core/unused.ts': "import 'never-reached'\n",
    })
    const graph = importGraph(dir, ['pkg/page.html'])
    expect([...graph.files].sort()).toEqual(['pkg/page.html', 'pkg/src/lib/index.ts', 'pkg/src/page.ts', 'src/core/data.json', 'src/core/engine.ts'])
    expect([...graph.packages].sort()).toEqual(['smol-toml', 'yaml'])
  })

  it('fails on an entry or a local import that resolves to no file', () => {
    write({ 'a.ts': "import './missing'\n" })
    expect(() => importGraph(dir, ['nope.ts'])).toThrow(/build entry nope\.ts does not exist/)
    expect(() => importGraph(dir, ['a.ts'])).toThrow(/a\.ts imports "\.\/missing", which resolves to no file/)
  })
})
