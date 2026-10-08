import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { render, screen } from '@testing-library/react'
import { MANIFEST } from '@/utilities/_generated/manifest'
import { each, laneBranch, laneEach, laneStep, step } from '@/recipes/define'
import type { Recipe } from '@/recipes/types'
import { RecipeArticle, RecipeWidget } from './RecipeArticle'

const metas = new Map(MANIFEST.map(m => [m.id, m]))

const recipe: Recipe = {
  slug: 'conditions',
  name: 'Conditional steps',
  summary: 'A recipe with one step that runs on a match and one that is skipped on a match.',
  category: 'Frontend',
  primaryQuery: 'conditional steps',
  published: '2026-10-07',
  steps: [
    step('unquote', 'replace', { pattern: '^"|"$', replacement: '', regex: true, flags: 'g' }, 'Drops surrounding quotes when there are any.',
      { condition: { kind: 'regex', pattern: '^"' } }),
    step('upper', 'case', { mode: 'upper' }, 'Uppercases everything that is not already XML.',
      { condition: { kind: 'regex', pattern: '^\\s*<', negate: true } }),
  ],
  samples: [{ id: 'a', title: 'A', input: '"x"', output: 'X' }, { id: 'b', title: 'B', input: '<x/>', output: '<x/>' }],
}

describe('RecipeArticle', () => {
  it('names a run-on-each step by its split and links the utilities it runs on each item', () => {
    const perValue: Recipe = {
      ...recipe,
      steps: [each('values', { mode: 'json-values' }, [laneStep('b64', 'base64_decode')], 'Decodes every value of the object on its own.')],
    }
    render(<RecipeArticle recipe={perValue} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={[]} live={null} related={[]} />)
    expect(screen.getAllByText('Run on each value').length).toBeGreaterThan(0)
    expect(screen.getByText('Each value of the JSON object goes through:')).toBeInTheDocument()
    expect(screen.getAllByRole('link').some(a => a.getAttribute('href') === '/util/base64_decode/')).toBe(true)
  })

  it('shows every nested step with its label, utility link, changed params, condition and failure policy', () => {
    const nested: Recipe = {
      ...recipe,
      steps: [
        step('find', 'extract_preset', { type: ['jwt'], unique: true }, 'Finds every token in the pasted log, one per line.'),
        each('tokens', { mode: 'lines' }, [
          laneStep('payload', 'jwt_decode', { part: 'payload' }, { onError: 'stop', label: 'read the payload' }),
          laneEach('dates', { mode: 'json-values' }, [
            laneStep('date', 'timestamp_convert', { to: 'iso', timezone: 'UTC' }, { condition: { kind: 'regex', pattern: '^1[4-9]\\d{8}$' } }),
          ]),
        ], 'Decodes every token on its own and turns its timestamps into dates.', { onError: 'empty', includeEmpty: true }),
      ],
    }
    const { container } = render(<RecipeArticle recipe={nested} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={[]} live={null} related={[]} />)
    const text = container.textContent ?? ''
    expect(screen.getByText('Each line, empty ones included, goes through:')).toBeInTheDocument()
    expect(screen.getByText('A line whose steps fail comes out empty.')).toBeInTheDocument()
    expect(screen.getByText('If it fails, the steps after it do not run.')).toBeInTheDocument()
    expect(text).toContain('read the payload (jwt decode)')
    expect(screen.getByText('Each value of the JSON object goes through:')).toBeInTheDocument()
    expect(screen.getByText(/Runs only when its input matches/).textContent)
      .toBe('Runs only when its input matches ^1[4-9]\\d{8}$; otherwise the input passes through.')
    // the nested steps' non-default params, with the labels the editor shows
    const terms = screen.getAllByRole('term').map(t => t.textContent)
    expect(terms).toContain(metas.get('jwt_decode')!.params.part.label)
    expect(terms).toContain(metas.get('timestamp_convert')!.params.to.label)
    for (const id of ['extract_preset', 'jwt_decode', 'timestamp_convert']) {
      expect(screen.getAllByRole('link').some(a => a.getAttribute('href') === `/util/${id}/`)).toBe(true)
    }
  })

  it("shows a branch's lanes, an empty pass-through lane and how the lanes are merged", () => {
    const lanes: Recipe = {
      ...recipe,
      steps: [each('count', { mode: 'lines' }, [
        laneBranch('both', [[laneStep('n', 'text_stats', {}), laneStep('g', 'jsonpath', { path: '$.graphemes', mode: 'first', indent: 2 })], []],
          { mode: 'concat', separator: ' · ' }),
      ], 'Writes how many characters each line has in front of the line itself.')],
    }
    const { container } = render(<RecipeArticle recipe={lanes} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={[]} live={null} related={[]} />)
    expect(container.textContent).toContain('Every lane gets the same input, and their outputs are joined with  · :')
    expect(screen.getByText('Lane 1:')).toBeInTheDocument()
    expect(screen.getByText('Lane 2: its input, unchanged')).toBeInTheDocument()
    expect(screen.getByText('$.graphemes')).toBeInTheDocument()
  })

  it('renders nested steps in static markup, as the pre-render does', () => {
    const tracking: Recipe = {
      ...recipe,
      steps: [each('strip', { mode: 'lines' }, [
        laneStep('drop', 'query_params_normalize', { drop: 'utm_*,fbclid', sort: false }, { condition: { kind: 'regex', pattern: '^https?://\\S+$', flags: 'i' } }),
        laneStep('upper', 'case', { mode: 'upper' }),
      ], 'Cleans one link at a time and leaves every other line alone.')],
    }
    const html = renderToStaticMarkup(<RecipeArticle recipe={tracking} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={[]} live={null} related={[]} />)
    expect(html).toContain('utm_*,fbclid')
    expect(html).toContain('^https?://\\S+$</code> (ignoring case); otherwise the input passes through.')
    expect(html).toContain('href="/util/query_params_normalize/"')
  })

  it('names the top-level step a failing nested step is in, when a step is left out', () => {
    const nested: Recipe = {
      ...recipe,
      steps: [
        step('unquote', 'replace', { pattern: '"', replacement: '', regex: false }, 'Drops the quotes so every value reads as plain text.'),
        each('values', { mode: 'lines' }, [laneStep('b64', 'base64_decode')], 'Decodes every line of Base64 on its own.'),
      ],
    }
    render(<RecipeArticle recipe={nested} utility={id => metas.get(id)} guideHtml="" steps={[]} live={null} related={[]}
      skip={[{ id: 'unquote', error: { stepId: 'b64', message: 'not Base64' }, unchanged: false }]} />)
    expect(screen.getByText('The pipeline breaks: step 2 (Run on each line) fails with “not Base64”.')).toBeInTheDocument()
  })

  it('words a condition by what it does: runs on a match, or is skipped on a match', () => {
    render(<RecipeArticle recipe={recipe} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={[]} live={null} related={[]} />)
    expect(screen.getByText(/Runs only when its input matches/).textContent)
      .toBe('Runs only when its input matches ^"; otherwise the input passes through.')
    expect(screen.getByText(/Skipped \(its input passes through\)/).textContent)
      .toBe('Skipped (its input passes through) when the input matches ^\\s*<.')
  })

  it('shows invisible characters in step outputs as symbols, and rule tables as raw find → replace rows', () => {
    const rules = { ...recipe, steps: [step('dashes', 'multi_replace', { rules: [['(^|\\n) *— *', '$1- '], [' ', '']], regex: true }, 'Rewrites dashes at line starts and drops spaces.')] }
    render(<RecipeArticle recipe={rules} utility={id => metas.get(id)} guideHtml="" live={null} related={[]} skip={[]}
      steps={[{ id: 'dashes', output: { kind: 'text', text: 'a\u00A0b\r\n', size: 5, truncated: false } }]} />)
    expect(screen.getByText('a⍽b␍', { exact: false })).toBeTruthy()
    expect(screen.getByText(/Shown as symbols: ⍽ no-break or other special space, ␍ carriage return\./)).toBeTruthy()
    const cells = screen.getAllByRole('cell').map(c => c.textContent)
    expect(cells).toEqual(['(^|\\n) *— *', '→', '$1- ', '(one space)', '→', '(empty)'])
  })

  it('leaves out the skip section when it could not be worked out, and shows a placeholder while it is', () => {
    const { rerender } = render(<RecipeArticle recipe={recipe} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={[]} live={null} related={[]} />)
    expect(screen.queryByRole('heading', { name: 'What if you skip a step?' })).toBeNull()
    rerender(<RecipeArticle recipe={recipe} utility={id => metas.get(id)} guideHtml="" steps={[]} skip={null} live={null} related={[]} />)
    expect(screen.getByRole('heading', { name: 'What if you skip a step?' })).toBeTruthy()
    expect(screen.getByText('Working it out…')).toBeTruthy()
  })

  it('counts the numbered steps in the widget, in the singular for one', () => {
    const widget = (stepCount: number) => renderToStaticMarkup(
      <RecipeWidget samples={recipe.samples} sampleId="a" input="" output="" stepCount={stepCount} openHref="/#/p/x" />)
    expect(widget(1)).toContain('1 step, every one editable.')
    expect(widget(4)).toContain('4 steps, every one editable.')
  })
})
