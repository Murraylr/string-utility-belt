import { describe, expect, it } from 'vitest'
import {
  looksLikeCsv, looksLikeHtml, looksLikeMarkdown, looksLikeSql, looksLikeXml, looksLikeYaml, parsesAsJson,
} from './textHeuristics'

describe('parsesAsJson', () => {
  it('accepts objects, arrays and primitives', () => {
    expect(parsesAsJson('{"a":1}')).toBe(true)
    expect(parsesAsJson('[1,2,3]')).toBe(true)
    expect(parsesAsJson('true')).toBe(true)
  })
  it('rejects plain text and empty input', () => {
    expect(parsesAsJson('hello world')).toBe(false)
    expect(parsesAsJson('')).toBe(false)
  })
})

describe('looksLikeXml', () => {
  it('detects an XML declaration', () => {
    expect(looksLikeXml('<?xml version="1.0"?><root/>')).toBe(true)
  })
  it('detects a matching root element', () => {
    expect(looksLikeXml('<root><child>x</child></root>')).toBe(true)
  })
  it('rejects plain text', () => {
    expect(looksLikeXml('hello world')).toBe(false)
  })
})

describe('looksLikeHtml', () => {
  it('detects a doctype or html tag', () => {
    expect(looksLikeHtml('<!DOCTYPE html><html></html>')).toBe(true)
    expect(looksLikeHtml('<html lang="en"></html>')).toBe(true)
  })
  it('rejects generic xml', () => {
    expect(looksLikeHtml('<root/>')).toBe(false)
  })
})

describe('looksLikeSql', () => {
  it('detects common statement keywords', () => {
    expect(looksLikeSql('SELECT * FROM users')).toBe(true)
    expect(looksLikeSql('insert into t values (1)')).toBe(true)
  })
  it('rejects prose that happens to contain "select"', () => {
    expect(looksLikeSql('please select an option below')).toBe(false)
  })
})

describe('looksLikeCsv', () => {
  it('accepts consistent comma counts across lines', () => {
    expect(looksLikeCsv('a,b,c\n1,2,3\n4,5,6')).toBe(true)
  })
  it('rejects a single line or inconsistent commas', () => {
    expect(looksLikeCsv('a,b,c')).toBe(false)
    expect(looksLikeCsv('a,b\nc,d,e')).toBe(false)
  })
  it('rejects lines with no commas', () => {
    expect(looksLikeCsv('hello\nworld')).toBe(false)
  })
})

describe('looksLikeMarkdown', () => {
  it('detects headings and fenced code blocks', () => {
    expect(looksLikeMarkdown('# Title\n\nbody')).toBe(true)
    expect(looksLikeMarkdown('```js\ncode\n```')).toBe(true)
  })
  it('rejects plain prose', () => {
    expect(looksLikeMarkdown('just some text')).toBe(false)
  })
})

describe('looksLikeYaml', () => {
  it('detects a document marker', () => {
    expect(looksLikeYaml('---\na: 1')).toBe(true)
  })
  it('detects mostly key: value lines', () => {
    expect(looksLikeYaml('a: 1\nb: 2\nc: 3')).toBe(true)
  })
  it('rejects prose with an occasional colon', () => {
    expect(looksLikeYaml('note: this is a sentence, not yaml, really')).toBe(false)
  })
})

describe('looksLikeHtml / looksLikeXml — anchoring', () => {
  it('only calls a document html when it starts that way (comments allowed first)', () => {
    expect(looksLikeHtml('<!-- generated -->\n<!doctype html><p>x</p>')).toBe(true)
    expect(looksLikeHtml('# Notes\n\n```\n<html>\n```')).toBe(false)
  })
  it('accepts a self-closing root but not two sibling roots', () => {
    expect(looksLikeXml('<root/>')).toBe(true)
    expect(looksLikeXml('<root attr="1" />')).toBe(true)
    expect(looksLikeXml('<a/><b/>')).toBe(false)
  })
})
