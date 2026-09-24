// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseArgv, UsageError } from './args'

describe('parseArgv', () => {
  it('collects bare step arguments', () => {
    const args = parseArgv(['trim', 'base64_encode'])
    expect(args.stepArgs).toEqual(['trim', 'base64_encode'])
  })

  it('parses -i/-t/-o/-p/-s/--name with their values', () => {
    const args = parseArgv(['-i', 'in.txt', '-o', 'out.txt', '-p', 'pipe.json', '--name', 'foo', 'trim'])
    expect(args.inputFile).toBe('in.txt')
    expect(args.outputFile).toBe('out.txt')
    expect(args.pipelineFile).toBe('pipe.json')
    expect(args.pipelineName).toBe('foo')
    expect(args.stepArgs).toEqual(['trim'])
  })

  it('parses -t and -s', () => {
    const args = parseArgv(['-t', 'hello', '-s', 'https://x/#/p/abc'])
    expect(args.text).toBe('hello')
    expect(args.share).toBe('https://x/#/p/abc')
  })

  it('parses boolean flags', () => {
    const args = parseArgv(['--json', '--previews', '--display', '--allow-custom-js', '-b', 'trim'])
    expect(args.json).toBe(true)
    expect(args.previews).toBe(true)
    expect(args.display).toBe(true)
    expect(args.allowCustomJs).toBe(true)
    expect(args.bytes).toBe(true)
    expect(parseArgv(['--bytes']).bytes).toBe(true)
    expect(parseArgv(['trim']).bytes).toBe(false)
  })

  it('rejects conflicting or orphaned options', () => {
    expect(() => parseArgv(['-t', 'x', '-i', 'f'])).toThrow(/cannot be combined/)
    expect(() => parseArgv(['--name', 'x'])).toThrow(/--name only applies/)
    expect(() => parseArgv(['-t', 'x', '--bytes', 'trim'])).toThrow(/--bytes/)
  })

  it('refuses to allow custom JS for a share link', () => {
    expect(() => parseArgv(['--allow-custom-js', '--share', 'abc'])).toThrow(/cannot be combined with --share/)
    expect(parseArgv(['--allow-custom-js', '-p', 'mine.json']).allowCustomJs).toBe(true)
  })

  it('parses --list with an optional category', () => {
    expect(parseArgv(['--list']).listCategory).toBeUndefined()
    expect(parseArgv(['--list', 'Encoding']).listCategory).toBe('Encoding')
    expect(parseArgv(['--list', '--json']).listCategory).toBeUndefined()
  })

  it('parses --describe and --search', () => {
    expect(parseArgv(['--describe', 'trim']).describe).toBe('trim')
    expect(parseArgv(['--search', 'base64']).search).toBe('base64')
  })

  it('parses -h/-v', () => {
    expect(parseArgv(['-h']).help).toBe(true)
    expect(parseArgv(['--help']).help).toBe(true)
    expect(parseArgv(['-v']).version).toBe(true)
    expect(parseArgv(['--version']).version).toBe(true)
  })

  it('throws a UsageError for an option missing its value', () => {
    expect(() => parseArgv(['-i'])).toThrow(UsageError)
    expect(() => parseArgv(['--pipeline'])).toThrow(/requires a value/)
  })

  it('throws a UsageError for an unknown option', () => {
    expect(() => parseArgv(['--nope'])).toThrow(/unknown option/)
  })
})
