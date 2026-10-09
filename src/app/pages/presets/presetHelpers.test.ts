import { describe, expect, it } from 'vitest'
import { MANIFEST } from '@/utilities/_generated/manifest'
import type { PipelineStep } from '@/types/utility'
import { changedParams, describeString, revealInvisible, stepTitle, stringPairs } from './presetHelpers'

const metas = new Map(MANIFEST.map(m => [m.id, m]))

describe('stepTitle', () => {
  it('names a run-on-each step by what it splits into, unless it has a label', () => {
    const each: PipelineStep = { id: 'e', type: 'each', split: { mode: 'json-values' }, steps: [] }
    expect(stepTitle(each, id => metas.get(id))).toBe('Run on each value')
    expect(stepTitle({ ...each, split: { mode: 'lines' as const } }, id => metas.get(id))).toBe('Run on each line')
    expect(stepTitle({ ...each, label: 'decode every value' }, id => metas.get(id))).toBe('decode every value')
  })
})

describe('revealInvisible', () => {
  it('draws carriage returns, special spaces, zero-width characters and trailing whitespace as symbols, with a legend', () => {
    const raw = '﻿#!/bin/bash\r\nset -e  x\r\necho hi​  \t\n'
    expect(revealInvisible(raw)).toEqual({
      text: '⟨BOM⟩#!/bin/bash␍\nset -e⍽⍽x␍\necho hi⟨ZWSP⟩··⇥\n',
      legend: ['⟨…⟩ invisible character', '␍ carriage return', '⍽ no-break or other special space', '· trailing space or ⇥ tab'],
    })
  })

  it('names control characters, and leaves ordinary text, inner tabs and emoji joiners alone', () => {
    expect(revealInvisible('\u001B[31mred\u0007').text).toBe('⟨ESC⟩[31mred⟨U+0007⟩')
    const plain = 'a\tb c\n👨‍💻 ❤️'
    expect(revealInvisible(plain)).toEqual({ text: plain, legend: [] })
  })
})

describe('describeString / stringPairs', () => {
  it('names empty and whitespace-only values', () => {
    expect(describeString('')).toBe('(empty)')
    expect(describeString(' ')).toBe('(one space)')
    expect(describeString('   ')).toBe('(3 spaces)')
    expect(describeString('\t')).toBe('(tab)')
    expect(describeString('\n')).toBe('(newline)')
    expect(describeString('(^|\\n) *— *')).toBe('(^|\\n) *— *')
  })

  it('recognises rule tables, and nothing else', () => {
    expect(stringPairs([['ﬁ', 'fi'], ['(^|\\n) *— *', '$1- ']])).toEqual([['ﬁ', 'fi'], ['(^|\\n) *— *', '$1- ']])
    expect(stringPairs([])).toBeNull()
    expect(stringPairs(['a', 'b'])).toBeNull()
    expect(stringPairs([['a', 1]])).toBeNull()
    expect(stringPairs('a')).toBeNull()
  })
})

describe('changedParams', () => {
  it('lists only non-default params, each with the label the editor shows', () => {
    const step = { id: 's', utilityId: 'yaml_to_json', enabled: true, params: { indent: 2, allDocuments: true } }
    expect(changedParams(step, id => metas.get(id))).toEqual([
      { key: 'allDocuments', label: metas.get('yaml_to_json')!.params.allDocuments.label, value: true },
    ])
  })
})
