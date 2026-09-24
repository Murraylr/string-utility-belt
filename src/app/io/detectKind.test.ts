import { describe, expect, it } from 'vitest'
import { detectKind } from './detectKind'

describe('detectKind', () => {
  it('detects a json value regardless of its text form', () => {
    expect(detectKind({ a: 1 }, '{\n  "a": 1\n}')).toBe('json')
  })
  it('detects a JSON-parsable string', () => {
    expect(detectKind('[1,2,3]', '[1,2,3]')).toBe('json')
  })
  it('detects html before generic xml', () => {
    expect(detectKind('<html><body>hi</body></html>', '<html><body>hi</body></html>')).toBe('html')
  })
  it('detects xml', () => {
    expect(detectKind('<root><a/></root>', '<root><a/></root>')).toBe('xml')
  })
  it('detects sql', () => {
    expect(detectKind('SELECT 1', 'SELECT 1')).toBe('sql')
  })
  it('detects csv', () => {
    const csv = 'a,b\n1,2\n3,4'
    expect(detectKind(csv, csv)).toBe('csv')
  })
  it('detects markdown', () => {
    expect(detectKind('# Title', '# Title')).toBe('markdown')
  })
  it('keeps markdown with a --- horizontal rule as markdown (only a leading --- starts a YAML document)', () => {
    const md = '# Title\n\nintro\n\n---\n\nmore text'
    expect(detectKind(md, md)).toBe('markdown')
    const yaml = '---\nname: x\nlist:\n  - a'
    expect(detectKind(yaml, yaml)).toBe('yaml')
  })
  it('falls back to plain text', () => {
    expect(detectKind('just some words', 'just some words')).toBe('text')
  })
})
