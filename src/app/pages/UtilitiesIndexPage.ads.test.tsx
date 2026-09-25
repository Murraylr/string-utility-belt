import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import UtilitiesIndexPage from './UtilitiesIndexPage'

// an ad unit id for this page only, as if configured in AdSense
vi.mock('@/app/ads/config', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/ads/config')>()),
  AD_SLOTS: { 'doc-page': undefined, 'blog-post': undefined, 'utilities-index': '999' },
}))

afterEach(() => { delete window.adsbygoogle })

describe('UtilitiesIndexPage ad unit', () => {
  it('sits after the first category and is not re-requested while the visitor filters', () => {
    const { container } = render(<UtilitiesIndexPage />)
    const ins = container.querySelector('ins.adsbygoogle')
    expect(ins?.closest('aside')?.previousElementSibling?.tagName).toBe('SECTION')
    expect(window.adsbygoogle).toHaveLength(1)

    // a new first category on every keystroke: the unit moves, it is not remounted —
    // a remount would be a new ad request without a new page view
    for (const value of ['b', 'ba', 'base', 'BASE64', 'json', '']) {
      fireEvent.change(screen.getByLabelText('Filter utilities'), { target: { value } })
      expect(container.querySelector('ins.adsbygoogle'), value).toBe(ins)
    }
    expect(window.adsbygoogle).toHaveLength(1)
  })
})
