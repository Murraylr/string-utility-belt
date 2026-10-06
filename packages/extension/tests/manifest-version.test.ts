// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkManifestVersion } from '../vite.config'

const json = (path: string) => JSON.parse(readFileSync(resolve(__dirname, path), 'utf8'))

describe('extension version', () => {
  it('manifest.json carries the root package.json version (the build refuses a mismatch)', () => {
    expect(json('../manifest.json').version).toBe(json('../../../package.json').version)
  })

  it('checkManifestVersion fails a mismatched or missing version, naming both files', () => {
    expect(() => checkManifestVersion('1.4.0', '1.4.0')).not.toThrow()
    expect(() => checkManifestVersion('1.3.0', '1.4.0')).toThrow(/manifest\.json has version "1\.3\.0" but the root package\.json has "1\.4\.0"/)
    expect(() => checkManifestVersion(undefined, '1.4.0')).toThrow(/manifest\.json has version undefined/)
  })
})
