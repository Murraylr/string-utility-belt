// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { payloadOf } from './pipeline'

describe('payloadOf', () => {
  it('takes the payload of a #/p/ or #/embed/ link, or the last path segment', () => {
    expect(payloadOf(' https://example.com/#/p/abc ')).toBe('abc')
    expect(payloadOf('https://example.com/app/#/embed/xyz')).toBe('xyz')
    expect(payloadOf('https://example.com/abc')).toBe('abc')
    expect(payloadOf('abc')).toBe('abc')
  })

  it('reads the link on the last line, in linear time however many #/p/ precede it', () => {
    expect(payloadOf('#/p/old\nhttps://example.com/#/p/new')).toBe('new')
    expect(payloadOf(`${'#/p/a'.repeat(100_000)}\nbare`)).toBe('a\nbare')
  })
})
