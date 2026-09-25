import React, { StrictMode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import AdSlot from './AdSlot'
import { ADSENSE_CLIENT } from './config'

afterEach(() => { delete window.adsbygoogle })

describe('AdSlot', () => {
  it('renders nothing, and requests nothing, for a placement without an ad unit id', () => {
    const { container } = render(<AdSlot placement="doc-page" slots={{}} />)
    expect(container.innerHTML).toBe('')
    expect(window.adsbygoogle).toBeUndefined()
  })

  it('renders a responsive unit for the publisher and requests it exactly once, even under StrictMode', () => {
    const { container } = render(
      <StrictMode><AdSlot placement="blog-post" className="w-full" slots={{ 'blog-post': '1234567890' }} /></StrictMode>,
    )
    const ins = container.querySelector('aside.ad-slot.w-full > ins.adsbygoogle')!
    expect(ins.getAttribute('data-ad-client')).toBe(ADSENSE_CLIENT)
    expect(ins.getAttribute('data-ad-slot')).toBe('1234567890')
    expect(ins.getAttribute('data-ad-format')).toBe('auto')
    expect(window.adsbygoogle).toEqual([{}])
  })

  it('requests a fresh ad for each mount, as a page navigation would', () => {
    const slots = { 'doc-page': '42' }
    const { rerender } = render(<AdSlot key="a" placement="doc-page" slots={slots} />)
    rerender(<AdSlot key="b" placement="doc-page" slots={slots} />)
    expect(window.adsbygoogle).toHaveLength(2)
  })

  it('survives adsbygoogle.js rejecting a push (e.g. an ad blocker stub)', () => {
    window.adsbygoogle = { push: () => { throw new Error('blocked') } } as unknown as unknown[]
    expect(() => render(<AdSlot placement="doc-page" slots={{ 'doc-page': '42' }} />)).not.toThrow()
  })
})
