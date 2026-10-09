import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { registry } from '@/app/registry'
import { PRESET_INDEX } from '@/presets/_generated/index'
import HomeDirectory from './HomeDirectory'
import { featuredPresets } from './presets/presetHelpers'
import { FEATURED_PRESET_SLUGS, POPULAR_UTILITY_IDS } from './seo'

describe('HomeDirectory', () => {
  it('links the featured presets and every popular utility by their pre-rendered paths, plus both full lists', () => {
    render(<HomeDirectory />)
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    const featured = featuredPresets(PRESET_INDEX).map(r => `/presets/${r.slug}/`)
    expect(featured.length).toBeGreaterThan(0)
    expect(hrefs).toEqual(['/presets/', ...featured, '/utilities/', ...POPULAR_UTILITY_IDS.map(id => `/util/${id}/`)])
    expect(screen.getByRole('link', { name: `Browse all ${registry.list().length} utilities` })).toBeTruthy()
    expect(screen.getByRole('link', { name: `Browse all ${PRESET_INDEX.length} presets` })).toBeTruthy()
  })

  it('only lists utilities and presets that exist', () => {
    for (const id of POPULAR_UTILITY_IDS) expect(registry.get(id), id).toBeTruthy()
    for (const slug of FEATURED_PRESET_SLUGS) expect(PRESET_INDEX.some(r => r.slug === slug), slug).toBe(true)
  })
})
