import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { RECIPE_CATEGORIES } from '@/recipes/types'
import { RECIPES_TITLE, recipesDescription } from '../seo'
import { promoPlan } from '@/app/sponsors/promos'
import RecipesIndexPage from './RecipesIndexPage'

describe('RecipesIndexPage', () => {
  it('lists every recipe by category, in category order, linking its pre-rendered page', () => {
    render(<RecipesIndexPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Recipes' })).toBeTruthy()
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(headings).toEqual(RECIPE_CATEGORIES.filter(c => RECIPE_INDEX.some(r => r.category === c)))
    for (const r of RECIPE_INDEX) {
      const section = screen.getByRole('heading', { level: 2, name: r.category }).closest('section')!
      expect(within(section).getByRole('link', { name: new RegExp(r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).getAttribute('href'))
        .toBe(`/recipes/${r.slug}/`)
    }
  })

  it('shows the inline house promo after the first category, as the pre-render does', () => {
    const { container } = render(<RecipesIndexPage />)
    const promo = container.querySelector('aside[data-promo-slot="inline"]')!
    expect(promo.getAttribute('data-promo')).toBe(promoPlan({ kind: 'index' }).inline)
    expect(promo.previousElementSibling).toBe(container.querySelector('section'))
  })

  it('sets the title and description the pre-render writes', () => {
    render(<RecipesIndexPage />)
    expect(document.title).toBe(RECIPES_TITLE)
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(recipesDescription(RECIPE_INDEX.length))
  })

  it('keeps its search title and description within what a result shows', () => {
    expect(RECIPES_TITLE.length).toBeLessThanOrEqual(60)
    const description = recipesDescription(RECIPE_INDEX.length)
    expect(description.length).toBeGreaterThanOrEqual(80)
    expect(description.length).toBeLessThanOrEqual(160)
  })
})
