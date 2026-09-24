import { describe, it, expect } from 'vitest'

// Everything ParamsEditor pulls in eagerly. CodeMirror must only be reachable through
// CodeParam's dynamic `import('./CodeEditor')`, or it lands back in the entry chunk.
const sources = import.meta.glob(['../ParamsEditor.tsx', './*.ts', './*.tsx', '!./*.test.*'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

const staticImports = (src: string) =>
  [...src.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map(m => m[1])

describe('lazy CodeMirror boundary', () => {
  it('finds the modules it is guarding', () => {
    expect(Object.keys(sources)).toContain('./CodeEditor.tsx')
    expect(Object.keys(sources)).toContain('../ParamsEditor.tsx')
  })

  it('only CodeEditor.tsx statically imports CodeMirror packages', () => {
    for (const [file, src] of Object.entries(sources)) {
      if (file === './CodeEditor.tsx') continue
      const cm = staticImports(src).filter(s => /codemirror/.test(s))
      expect(cm, file).toEqual([])
    }
  })

  it('nothing statically imports CodeEditor; CodeParam loads it with import()', () => {
    for (const [file, src] of Object.entries(sources)) {
      expect(staticImports(src).filter(s => /CodeEditor$/.test(s)), file).toEqual([])
    }
    expect(sources['./CodeParam.tsx']).toMatch(/import\(\s*['"]\.\/CodeEditor['"]\s*\)/)
  })
})
