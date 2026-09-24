import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { UTILITIES, docsHref } from '@/utilities'
import { getRoute } from '@/lib/router'
import UtilityDoc, { DocsIndex } from './UtilityDoc'
import UtilityPicker from './UtilityPicker'
import StepCard from './StepCard'

const noop = () => {}

describe('utility docs', () => {
  afterEach(() => { cleanup(); location.hash = '' })

  it.each(UTILITIES.map(u => [u.id, u]))('%s has a docs page', (_id, u) => {
    render(<UtilityDoc id={u.id} />)
    expect(screen.getByRole('heading', { level: 1, name: u.name })).toBeInTheDocument()
  })

  it.each(UTILITIES.map(u => [u.id, u]))('%s step card links to its docs', (_id, u) => {
    render(<StepCard index={0} step={{ id: 's', enabled: true, utilityId: u.id, params: {} }} total={1}
      onMoveUp={noop} onMoveDown={noop} onDelete={noop} onToggle={noop} onChangeParams={noop} onChangeUtil={noop} />)
    expect(screen.getByRole('link', { name: `${u.name} docs` })).toHaveAttribute('href', docsHref(u.id))
  })

  it('picker links every utility to its docs', () => {
    render(<UtilityPicker onPick={noop} />)
    for (const u of UTILITIES) {
      expect(screen.getByRole('link', { name: `${u.name} docs` })).toHaveAttribute('href', docsHref(u.id))
    }
  })

  it('docs index links every utility', () => {
    render(<DocsIndex />)
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    for (const u of UTILITIES) expect(hrefs).toContain(docsHref(u.id))
  })

  it('docs hrefs route back to the utility id', () => {
    for (const u of UTILITIES) {
      location.hash = docsHref(u.id)
      expect(getRoute()).toEqual({ name: 'docs', params: { id: u.id } })
    }
  })

  it('shows not found for unknown ids', () => {
    render(<UtilityDoc id="nope" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
