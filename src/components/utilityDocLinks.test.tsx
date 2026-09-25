import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import UtilityPicker from './UtilityPicker'
import { registry } from '@/app/registry'
import { getRoute } from '@/lib/router'

// Against the real registry: every utility must link to its own docs page.
describe('utility docs links', () => {
  afterEach(() => { cleanup(); location.hash = '' })

  it('the picker links every utility to its docs page', () => {
    const { container } = render(<UtilityPicker onPick={() => {}} />)
    const hrefs = new Set([...container.querySelectorAll('a[href^="#/util/"]')].map(a => a.getAttribute('href')))
    const missing = registry.list().filter(m => !hrefs.has(`#/util/${encodeURIComponent(m.id)}`)).map(m => m.id)
    expect(missing).toEqual([])
  })

  it('every docs link routes to that utility\'s docs page', () => {
    for (const m of registry.list()) {
      location.hash = `#/util/${encodeURIComponent(m.id)}`
      expect(getRoute()).toEqual({ name: 'utility', params: { id: m.id } })
    }
  })
})
