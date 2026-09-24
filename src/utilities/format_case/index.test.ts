import { describe, it, expect } from 'vitest'
import util from './index'

describe('format_case', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('format_case')
    expect(util.name).toBe('format case')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.mode).toMatchObject({ options: ['camel', 'pascal', 'snake', 'kebab', 'upper', 'lower', 'title', 'sentence'] })
    expect(util.params.mode.default).toBe('camel')
  })

  it('converts to camelCase', () => {
    expect(util.apply('Hello world', { mode: 'camel' })).toBe('helloWorld')
    expect(util.apply('foo-bar-baz', { mode: 'camel' })).toBe('fooBarBaz')
  })

  it('preserves accented letters instead of deleting them', () => {
    expect(util.apply('café latte', { mode: 'camel' })).toBe('caféLatte')
    expect(util.apply('café', { mode: 'snake' })).toBe('café')
    expect(util.apply('über schnell', { mode: 'kebab' })).toBe('über-schnell')
  })

  it('sentence mode returns whitespace-only input unchanged instead of crashing', () => {
    expect(util.apply('   ', { mode: 'sentence' })).toBe('   ')
  })

  it('converts to PascalCase', () => {
    expect(util.apply('hello world', { mode: 'pascal' })).toBe('HelloWorld')
    expect(util.apply('foo-bar', { mode: 'pascal' })).toBe('FooBar')
  })

  it('converts to snake_case', () => {
    expect(util.apply('Hello world', { mode: 'snake' })).toBe('hello_world')
    expect(util.apply('HelloWorld', { mode: 'snake' })).toBe('hello_world')
  })

  it('converts to kebab-case', () => {
    expect(util.apply('Hello world', { mode: 'kebab' })).toBe('hello-world')
    expect(util.apply('HelloWorld', { mode: 'kebab' })).toBe('hello-world')
  })

  it('converts to upper', () => {
    expect(util.apply('hello', { mode: 'upper' })).toBe('HELLO')
  })

  it('converts to lower', () => {
    expect(util.apply('HELLO', { mode: 'lower' })).toBe('hello')
  })

  it('converts to title case', () => {
    expect(util.apply('hello world', { mode: 'title' })).toBe('Hello World')
    expect(util.apply('hELLO wORLD', { mode: 'title' })).toBe('Hello World')
    expect(util.apply('hello world. this is a test.', { mode: 'title' })).toBe('Hello World. This Is A Test.')
  })

  it('converts to sentence case (capitalizes first char only)', () => {
    // toSentenceCase only uppercases first char, does not lowercase rest
    expect(util.apply('hello world', { mode: 'sentence' })).toBe('Hello world')
    expect(util.apply('HELLO WORLD', { mode: 'sentence' })).toBe('HELLO WORLD')
  })

  it('defaults to camel when mode is omitted', () => {
    expect(util.apply('hello world', {})).toBe('helloWorld')
  })

  it('handles empty string', () => {
    expect(util.apply('', { mode: 'camel' })).toBe('')
    expect(util.apply('', { mode: 'snake' })).toBe('')
    expect(util.apply('', { mode: 'upper' })).toBe('')
  })

  it('handles single word', () => {
    expect(util.apply('hello', { mode: 'camel' })).toBe('hello')
    expect(util.apply('hello', { mode: 'pascal' })).toBe('Hello')
    expect(util.apply('hello', { mode: 'snake' })).toBe('hello')
    expect(util.apply('hello', { mode: 'kebab' })).toBe('hello')
  })

  it('handles camelCase input', () => {
    expect(util.apply('helloWorld', { mode: 'snake' })).toBe('hello_world')
    expect(util.apply('helloWorld', { mode: 'kebab' })).toBe('hello-world')
  })

  it('handles non-alphabetic characters', () => {
    expect(util.apply('12345!@#$', { mode: 'upper' })).toBe('12345!@#$')
    expect(util.apply('12345!@#$', { mode: 'lower' })).toBe('12345!@#$')
  })
})
