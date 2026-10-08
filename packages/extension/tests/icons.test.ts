// @vitest-environment node
/**
 * The toolbar and store icons are the String Utility Belt keycap mark (made by
 * scripts/icons.ts), not a placeholder: each size in the manifest exists at that
 * size and actually has a mark on it (a solid or empty square would pass a
 * dimensions-only check).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'))

/** Decodes a non-interlaced 8-bit RGBA PNG into its pixels. */
function decodeRgbaPng(file: Buffer): { width: number; height: number; pixels: Uint8Array } {
  expect(file.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  let width = 0
  let height = 0
  const idat: Buffer[] = []
  for (let at = 8; at < file.length;) {
    const length = file.readUInt32BE(at)
    const type = file.toString('ascii', at + 4, at + 8)
    const data = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      expect([data[8], data[9], data[12]], 'expected 8-bit RGBA, non-interlaced').toEqual([8, 6, 0])
    } else if (type === 'IDAT') idat.push(data)
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const pixels = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? pixels[y * stride + x - 4] : 0
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const c = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const predictor = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]
      pixels[y * stride + x] = (line[x] + predictor) & 0xff
    }
  }
  return { width, height, pixels }
}

const sizes = Object.entries<string>(manifest.icons)

describe('extension icons', () => {
  it('declares 16, 32, 48 and 128 px, the same set for the toolbar button', () => {
    expect(sizes.map(([size]) => size)).toEqual(['16', '32', '48', '128'])
    expect(manifest.action.default_icon).toEqual(manifest.icons)
  })

  it.each(sizes)('%s px is that size and shows a light mark on a dark tile', (size, path) => {
    const { width, height, pixels } = decodeRgbaPng(readFileSync(resolve(root, path)))
    expect([width, height]).toEqual([Number(size), Number(size)])
    let tile = 0
    let mark = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 200) continue
      const luma = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
      if (luma < 140) tile++
      else if (luma > 220) mark++
    }
    const area = width * height
    expect(tile / area, 'the accent tile covers much of the icon').toBeGreaterThan(0.25)
    expect(mark / area, 'the cream key is visible on it').toBeGreaterThan(0.03)
  })
})
