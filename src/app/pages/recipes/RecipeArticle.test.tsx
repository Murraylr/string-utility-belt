import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MANIFEST } from '@/utilities/_generated/manifest'
import { step } from '@/recipes/define'
import type { Recipe } from '@/recipes/types'
import { RecipeArticle } from './RecipeArticle'

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
})
