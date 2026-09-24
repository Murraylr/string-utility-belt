import { describe, expect, it } from 'vitest'
import { readFileAsInput } from './fileInput'

describe('readFileAsInput', () => {
  it('reads a small UTF-8 text file as a string', async () => {
    const file = new File(['café 日本語'], 'notes.txt', { type: 'text/plain' })
    const result = await readFileAsInput(file)
    expect(result.kind).toBe('text')
    expect(result.value).toBe('café 日本語')
    expect(result.meta).toEqual({ name: 'notes.txt', size: expect.any(Number), mime: 'text/plain' })
  })

  it('reads bytes that fail strict UTF-8 decoding as binary, even with a text/* MIME', () => {
    const invalid = new Uint8Array([0xff, 0xfe, 0x00, 0x01])
    const file = new File([invalid], 'mystery.txt', { type: 'text/plain' })
    return readFileAsInput(file).then(result => {
      expect(result.kind).toBe('binary')
      expect(result.value).toBeInstanceOf(Uint8Array)
      expect(Array.from(result.value as Uint8Array)).toEqual([0xff, 0xfe, 0x00, 0x01])
    })
  })

  it('reads a valid-UTF-8 file without a text MIME as text', async () => {
    const file = new File(['plain ascii'], 'data', { type: 'application/octet-stream' })
    const result = await readFileAsInput(file)
    expect(result.kind).toBe('text')
    expect(result.value).toBe('plain ascii')
  })

  it('treats a file over the 5 MB probe cap as binary without attempting to decode it', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1) // valid UTF-8 (all zero bytes) but oversized
    const file = new File([big], 'huge.bin', { type: 'text/plain' })
    const result = await readFileAsInput(file)
    expect(result.kind).toBe('binary')
  })

  it('captures name/size/mime metadata', async () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' })
    const result = await readFileAsInput(file)
    expect(result.meta.name).toBe('a.txt')
    expect(result.meta.size).toBe(3)
    expect(result.meta.mime).toBe('text/plain')
  })
})
