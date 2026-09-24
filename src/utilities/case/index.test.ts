import { describe, it, expect } from 'vitest'
import util from './index'

describe('case utility', () => {
    it('should have correct metadata', () => {
        expect(util.id).toBe('case')
        expect(util.name).toBe('change case')
        expect(util.category).toBe('Formatting')
        expect(util.description).toBeTypeOf('string')
        expect(util.accepts).toBe('string')
        expect(util.produces).toBe('string')
        expect(util.params.mode.options).toEqual(['upper', 'lower', 'title', 'sentence'])
        expect(util.params.mode.default).toBe('upper')
    })

    it('should convert to upper case by default', () => {
        expect(util.apply('hello World', { mode: 'upper' })).toBe('HELLO WORLD')
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
        expect(util.apply('abc', {})).toBe('ABC')
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
        expect(util.apply('hello', { mode: 'sentence' })).toBe('Hello')
        expect(util.apply('HELLO', { mode: 'sentence' })).toBe('Hello')
        expect(util.apply('hElLo', { mode: 'sentence' })).toBe('Hello')
        expect(util.apply('', { mode: 'sentence' })).toBe('')
    })
});