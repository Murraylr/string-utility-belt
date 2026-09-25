import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { registry } from '@/app/registry'
import UtilitiesIndexPage from './UtilitiesIndexPage'
import { utilitiesTitle } from './seo'

describe('UtilitiesIndexPage', () => {
  it('sets the document title, and restores it on leaving', () => {
    document.title = 'String Utility Belt'
    const { unmount } = render(<UtilitiesIndexPage />)
    expect(document.title).toBe(utilitiesTitle(registry.list().length))
    unmount()
    // otherwise the tool page (and any doc page restoring "its" previous title) keeps it
    expect(document.title).toBe('String Utility Belt')
  })

  it('lists every utility grouped by category, each linking to its pre-rendered doc page', () => {
    const { container } = render(<UtilitiesIndexPage />)
    const link = container.querySelector('a[href="/util/trim/"]')
    expect(link).toBeTruthy()
    expect(link!.textContent).toContain('trim')
    expect(link!.textContent).toContain(registry.get('trim')!.description)
    expect(container.querySelectorAll('a[href^="/util/"]')).toHaveLength(registry.list().length)
  })

  it('shows each category with its count', () => {
    render(<UtilitiesIndexPage />)
    const n = registry.byCategory('String Ops').length
    expect(screen.getByRole('heading', { level: 2, name: `String Ops (${n})` })).toBeTruthy()
  })

  it('filters case-insensitively by name, updating the counts', () => {
    const { container } = render(<UtilitiesIndexPage />)
    fireEvent.change(screen.getByLabelText('Filter utilities'), { target: { value: 'BASE64' } })
    expect(container.querySelector('a[href="/util/base64_encode/"]')).toBeTruthy()
    expect(container.querySelector('a[href="/util/trim/"]')).toBeNull()
    const shown = container.querySelectorAll('a[href^="/util/"]').length
    expect(screen.getByRole('status').textContent).toBe(`${shown} of ${registry.list().length} utilities`)
  })

  it('filters by alias', () => {
    const { container } = render(<UtilitiesIndexPage />)
    // count's alias is "wc"
    fireEvent.change(screen.getByLabelText('Filter utilities'), { target: { value: 'wc' } })
    expect(container.querySelector('a[href="/util/count/"]')).toBeTruthy()
  })

  it('shows a message when nothing matches', () => {
    render(<UtilitiesIndexPage />)
    fireEvent.change(screen.getByLabelText('Filter utilities'), { target: { value: 'zzzznotarealutility' } })
    expect(screen.getByText(/no utilities match/i)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/^0 of /)
  })
})
