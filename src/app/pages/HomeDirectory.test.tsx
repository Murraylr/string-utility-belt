import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { registry } from '@/app/registry'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import HomeDirectory from './HomeDirectory'
import { featuredRecipes } from './recipes/recipeHelpers'
import { FEATURED_RECIPE_SLUGS, POPULAR_UTILITY_IDS } from './seo'

describe('HomeDirectory', () => {
  it('links the featured recipes and every popular utility by their pre-rendered paths, plus both full lists', () => {
    render(<HomeDirectory />)
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    const featured = featuredRecipes(RECIPE_INDEX).map(r => `/recipes/${r.slug}/`)
    expect(featured.length).toBeGreaterThan(0)
    expect(hrefs).toEqual([...featured, '/recipes/', ...POPULAR_UTILITY_IDS.map(id => `/util/${id}/`), '/utilities/'])
    expect(screen.getByRole('link', { name: `Browse all ${registry.list().length} utilities` })).toBeTruthy()
    expect(screen.getByRole('link', { name: `Browse all ${RECIPE_INDEX.length} recipes` })).toBeTruthy()
  })

  it('only lists utilities and recipes that exist', () => {
    for (const id of POPULAR_UTILITY_IDS) expect(registry.get(id), id).toBeTruthy()
    for (const slug of FEATURED_RECIPE_SLUGS) expect(RECIPE_INDEX.some(r => r.slug === slug), slug).toBe(true)
  })
})
