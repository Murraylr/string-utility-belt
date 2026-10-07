// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dependencyClosure, packageOfKey, type Lockfile } from './lockfile'

const LOCK: Lockfile = {
  packages: {
    '': { dependencies: { a: '^1', unrelated: '^1' } },
    'node_modules/a': { version: '1.0.0', dependencies: { b: '^2', '@s/c': '^1' }, optionalDependencies: { 'not-installed': '^1' } },
    // a's b is nested: the hoisted b is another major used by someone else
    'node_modules/a/node_modules/b': { version: '2.0.0', dependencies: { d: '^1' } },
    'node_modules/b': { version: '1.0.0' },
    'node_modules/@s/c': { version: '1.0.0', peerDependencies: { d: '^1' } },
    'node_modules/d': { version: '1.0.0' },
    'node_modules/unrelated': { version: '1.0.0' },
  },
}

describe('dependencyClosure', () => {
  it('collects what the named packages pull in, resolving nested node_modules like Node', () => {
    expect([...dependencyClosure(LOCK, ['a'])].sort()).toEqual([
      'node_modules/@s/c', 'node_modules/a', 'node_modules/a/node_modules/b', 'node_modules/d',
    ])
  })

  it('skips packages npm did not install, and handles an empty lockfile', () => {
    expect([...dependencyClosure(LOCK, ['missing'])]).toEqual([])
    expect([...dependencyClosure({}, ['a'])]).toEqual([])
  })

  it('follows workspace links to the linked package', () => {
    const lock: Lockfile = {
      packages: {
        'node_modules/ws': { link: true, resolved: 'packages/ws' },
        'packages/ws': { version: '1.0.0', dependencies: { d: '^1' } },
        'node_modules/d': { version: '1.0.0' },
      },
    }
    expect([...dependencyClosure(lock, ['ws'])].sort()).toEqual(['node_modules/d', 'packages/ws'])
  })
})

describe('packageOfKey', () => {
  it('names the package a lockfile key installs', () => {
    expect(packageOfKey('node_modules/yaml')).toBe('yaml')
    expect(packageOfKey('node_modules/a/node_modules/@s/c')).toBe('@s/c')
  })
})
