import { describe, it, expect } from 'vitest'
import util from './index'

describe('format_case', () => {
  it('to camel', async () => {
    const out = await util.apply('Hello world', { mode: 'camel' })
    expect(out).toBe('helloWorld')
  })
  it('to pascal', async () => {
    const out = await util.apply('hello world', { mode: 'pascal' })
    expect(out).toBe('HelloWorld')
  })
  it('to snake', async () => {
    const out = await util.apply('Hello world', { mode: 'snake' })
    expect(out).toBe('hello_world')
  })
  it('to kebab', async () => {
    const out = await util.apply('Hello world', { mode: 'kebab' })
    expect(out).toBe('hello-world')
  })
  it('to title', async () => {
    const out = await util.apply('hello world. this is a test.', { mode: 'title' })
    expect(out).toBe('Hello World. This Is A Test.')
  })
  it('to sentence', async () => {
    const out = await util.apply('hello world. this is a test.', { mode: 'sentence' })
    expect(out).toBe('Hello world. This is a test.')
  })

   it('should convert to camel case by default', () => {
        expect(util.apply('hello World', {})).toBe('helloWorld')
    })

    it('should convert to lower case', () => {
        expect(util.apply('Hello WORLD', { mode: 'lower' })).toBe('hello world')
    })

    it('should convert to title case', () => {
        expect(util.apply('hello world', { mode: 'title' })).toBe('Hello World')
        expect(util.apply('hELLO wORLD', { mode: 'title' })).toBe('Hello World')
    })

    it('should handle empty string', () => {
        expect(util.apply('', { mode: 'upper' })).toBe('')
        expect(util.apply('', { mode: 'lower' })).toBe('')
        expect(util.apply('', { mode: 'title' })).toBe('')
    })

    it('should use default mode if params is missing', () => {
        expect(util.apply('abc def', {})).toBe('abcDef')
    })

    it('should handle strings with no alphabetic characters', () => {
        expect(util.apply('12345!@#$', { mode: 'upper' })).toBe('12345!@#$')
        expect(util.apply('12345!@#$', { mode: 'lower' })).toBe('12345!@#$')
        expect(util.apply('12345!@#$', { mode: 'title' })).toBe('12345!@#$')
    })

    it('should handle string with a mixture of alphanumeric characters', () => {
        expect(util.apply('Hello 3v1l World!', { mode: 'upper' })).toBe('HELLO 3V1L WORLD!')
        expect(util.apply('Hello 3v1l World!', { mode: 'lower' })).toBe('hello 3v1l world!')
        expect(util.apply('Hello 3v1l World!', { mode: 'title' })).toBe('Hello 3v1l World!')
        expect(util.apply('hElLo 3v1l wOrLd!', { mode: 'title' })).toBe('Hello 3v1l World!')
    })
    it('should handle sentence case', () => {
        expect(util.apply('hello world. this is a test.', { mode: 'sentence' })).toBe('Hello world. This is a test.')
        expect(util.apply('HELLO WORLD. THIS IS A TEST.', { mode: 'sentence' })).toBe('Hello world. This is a test.')
        expect(util.apply('hElLo wOrLd. tHiS iS a tEsT.', { mode: 'sentence' })).toBe('Hello world. This is a test.')
        expect(util.apply('hElLo wOrLd. 3tHiS iS a tEsT.', { mode: 'sentence' })).toBe('Hello world. 3This is a test.')
        expect(util.apply('', { mode: 'sentence' })).toBe('')
    })
})
