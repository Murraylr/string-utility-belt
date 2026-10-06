// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { globToRegExp } from './glob'

const matches = (glob: string, path: string) => globToRegExp(glob).test(path)

describe('globToRegExp', () => {
  it('matches literal paths exactly', () => {
    expect(matches('index.html', 'index.html')).toBe(true)
    expect(matches('index.html', 'src/index.html')).toBe(false)
    expect(matches('index.html', 'indexXhtml')).toBe(false)
  })

  it('keeps * and ? inside one path segment', () => {
    expect(matches('scripts/check-*.ts', 'scripts/check-bundle.ts')).toBe(true)
    expect(matches('scripts/check-*.ts', 'scripts/seo/check-x.ts')).toBe(false)
    expect(matches('src/utilities/*/guide.md', 'src/utilities/pad/guide.md')).toBe(true)
    expect(matches('src/utilities/*/guide.md', 'src/utilities/a/b/guide.md')).toBe(false)
    expect(matches('v?.ts', 'v1.ts')).toBe(true)
    expect(matches('v?.ts', 'v/.ts')).toBe(false)
  })

  it('lets a trailing ** match everything below a directory, but not the directory\'s siblings', () => {
    expect(matches('src/core/**', 'src/core/runner.ts')).toBe(true)
    expect(matches('src/core/**', 'src/core/a/b/c.ts')).toBe(true)
    expect(matches('src/core/**', 'src/corelib/x.ts')).toBe(false)
  })

  it('lets **/ match zero or more whole directories', () => {
    expect(matches('**/*.test.ts', 'a.test.ts')).toBe(true)
    expect(matches('**/*.test.ts', 'src/x/a.test.ts')).toBe(true)
    expect(matches('**/__fixtures__/**', 'scripts/__fixtures__/sample-dist/index.html')).toBe(true)
    expect(matches('**/tests/**', 'packages/extension/tests/icons.test.ts')).toBe(true)
    expect(matches('**/tests/**', 'packages/extension/src/tests.ts')).toBe(false)
  })

  it('expands {a,b} alternatives, wildcards included', () => {
    expect(matches('**/*.test.{ts,tsx}', 'src/App.test.tsx')).toBe(true)
    expect(matches('**/*.test.{ts,tsx}', 'src/App.test.jsx')).toBe(false)
    expect(matches('{src,worker}/*.ts', 'worker/api.ts')).toBe(true)
    expect(matches('a.{*.json,md}', 'a.x.json')).toBe(true)
  })

  it('treats regex metacharacters as literals', () => {
    expect(matches('a+b(c).ts', 'a+b(c).ts')).toBe(true)
    expect(matches('a+b(c).ts', 'aab(c).ts')).toBe(false)
    expect(matches('$x^.md', '$x^.md')).toBe(true)
  })

  it('refuses braces it does not support', () => {
    expect(() => globToRegExp('a{b')).toThrow(/braces/)
    expect(() => globToRegExp('a}b')).toThrow(/unbalanced/)
    expect(() => globToRegExp('{a,{b,c}}')).toThrow(/braces/)
  })
})
