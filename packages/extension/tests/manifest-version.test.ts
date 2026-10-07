// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkManifestVersion } from '../vite.config'

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8'))

describe('extension version', () => {
  it('manifest.json carries a version the Chrome Web Store accepts', () => {
    expect(() => checkManifestVersion(manifest.version)).not.toThrow()
  })

  it('checkManifestVersion accepts 1-4 integers from 0 to 65535', () => {
    for (const v of ['1', '1.4', '1.4.0', '0.0.0.1', '65535.0.0']) expect(() => checkManifestVersion(v), v).not.toThrow()
  })

  it('checkManifestVersion refuses what the store would reject, naming the file', () => {
    for (const v of ['', '1.4.0-beta', '01.4.0', '1.65536.0', '1.2.3.4.5', '1..2', 'v1.4.0']) {
      expect(() => checkManifestVersion(v), v).toThrow(/manifest\.json has version/)
    }
    expect(() => checkManifestVersion(undefined)).toThrow(/manifest\.json has version undefined/)
    expect(() => checkManifestVersion(140)).toThrow(/manifest\.json has version 140/)
  })
})
