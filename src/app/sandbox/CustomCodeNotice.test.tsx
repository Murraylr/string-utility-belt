import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CustomCodeNotice from './CustomCodeNotice'

describe('CustomCodeNotice', () => {
  it('warns on custom code steps', () => {
    render(<CustomCodeNotice utilityId="custom_js" enabled={true} />)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('This step runs custom code — review it before enabling.')
    expect(note).toHaveTextContent(/no network access/)
    expect(note).not.toHaveTextContent(/stays off/)
  })

  it('says the step stays off while disabled', () => {
    render(<CustomCodeNotice utilityId="custom_js" enabled={false} />)
    expect(screen.getByRole('note')).toHaveTextContent('It stays off until you switch it on.')
  })

  it('renders nothing for other utilities', () => {
    const { container } = render(<CustomCodeNotice utilityId="base64_encode" enabled={true} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps its icon out of the accessibility tree', () => {
    const { container } = render(<CustomCodeNotice utilityId="custom_js" enabled={true} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
