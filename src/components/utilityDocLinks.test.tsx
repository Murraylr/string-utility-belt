import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import UtilityPicker from './UtilityPicker'
import { registry } from '@/app/registry'
import { utilityPath } from '@/app/pages/related'
import { getRoute, isInAppPath } from '@/lib/router'

// Against the real registry: every utility must link to its own docs page.
describe('utility docs links', () => {
  afterEach(() => { cleanup(); history.replaceState(null, '', '/') })

  it('the picker links every utility to its docs page', () => {
    const { container } = render(<UtilityPicker onPick={() => {}} />)
    const hrefs = new Set([...container.querySelectorAll('a[href^="/util/"]')].map(a => a.getAttribute('href')))
    const missing = registry.list().filter(m => !hrefs.has(utilityPath(m.id))).map(m => m.id)
    expect(missing).toEqual([])
  })

  it('every docs link is followed in-app to that utility\'s docs page', () => {
    for (const m of registry.list()) {
      const href = utilityPath(m.id)
      expect(isInAppPath(href), href).toBe(true)
      history.replaceState(null, '', href)
      expect(getRoute()).toEqual({ name: 'utility', params: { id: m.id } })
    }
  })
})
