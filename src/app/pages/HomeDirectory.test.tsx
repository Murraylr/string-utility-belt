import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { registry } from '@/app/registry'
import HomeDirectory from './HomeDirectory'
import { POPULAR_UTILITY_IDS } from './seo'

describe('HomeDirectory', () => {
  it('links every popular utility by its pre-rendered path, plus the full list', () => {
    render(<HomeDirectory />)
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    expect(hrefs).toEqual([...POPULAR_UTILITY_IDS.map(id => `/util/${id}/`), '/utilities/'])
    expect(screen.getByRole('link', { name: `Browse all ${registry.list().length} utilities` })).toBeTruthy()
  })

  it('only lists utilities that exist', () => {
    for (const id of POPULAR_UTILITY_IDS) expect(registry.get(id), id).toBeTruthy()
  })
})
