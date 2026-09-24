import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SuggestionList from './SuggestionList'
import type { Suggestion } from '@/core/detect'

const SUGGESTION: Suggestion = {
  step: { utilityId: 'base64_decode' },
  label: 'base64 decode',
  confidence: 0.82,
  preview: 'Hello, World!',
}

describe('SuggestionList', () => {
  it('shows an empty-input message when there is nothing to analyse', () => {
    render(
      <SuggestionList value="" loading={false} error={null} suggestions={[]} onPick={() => {}} onDecodeAll={() => {}} />
    )
    expect(screen.getByText(/nothing to analyse yet/i)).toBeTruthy()
  })

  it('shows an undetectable message for non-empty input with no matches', () => {
    render(
      <SuggestionList value="plain text" loading={false} error={null} suggestions={[]} onPick={() => {}} onDecodeAll={() => {}} />
    )
    expect(screen.getByText(/nothing obvious to decode/i)).toBeTruthy()
  })

  it('announces analysing via aria-live while loading', () => {
    render(
      <SuggestionList value="x" loading={true} error={null} suggestions={[]} onPick={() => {}} onDecodeAll={() => {}} />
    )
    expect(screen.getByText('analysing…')).toBeTruthy()
  })

  it('shows an error', () => {
    render(
      <SuggestionList value="x" loading={false} error="boom" suggestions={[]} onPick={() => {}} onDecodeAll={() => {}} />
    )
    expect(screen.getByRole('alert').textContent).toBe('boom')
  })

  it('renders a suggestion with its confidence and preview, and picks it on click', () => {
    const onPick = vi.fn()
    render(
      <SuggestionList value="x" loading={false} error={null} suggestions={[SUGGESTION]} onPick={onPick} onDecodeAll={() => {}} />
    )
    expect(screen.getByText('base64 decode')).toBeTruthy()
    expect(screen.getByText('82%')).toBeTruthy()
    expect(screen.getByText('Hello, World!')).toBeTruthy()
    fireEvent.click(screen.getByText('base64 decode'))
    expect(onPick).toHaveBeenCalledWith(SUGGESTION)
  })

  it('names each suggestion by its label and confidence, with the preview as its description', () => {
    render(
      <SuggestionList value="x" loading={false} error={null} suggestions={[SUGGESTION]} onPick={() => {}} onDecodeAll={() => {}} />
    )
    // the preview (up to 200 chars of decoded output) would otherwise be read out as the button's name
    const button = screen.getByRole('button', { name: 'base64 decode, 82% confidence' })
    expect(button).toHaveAccessibleDescription('Hello, World!')
  })

  it('disables "Decode all the way" with no suggestions, enables it with some', () => {
    const { rerender } = render(
      <SuggestionList value="x" loading={false} error={null} suggestions={[]} onPick={() => {}} onDecodeAll={() => {}} />
    )
    expect(screen.getByText('Decode all the way')).toBeDisabled()
    rerender(
      <SuggestionList value="x" loading={false} error={null} suggestions={[SUGGESTION]} onPick={() => {}} onDecodeAll={() => {}} />
    )
    expect(screen.getByText('Decode all the way')).not.toBeDisabled()
  })

  it('calls onDecodeAll when clicked', () => {
    const onDecodeAll = vi.fn()
    render(
      <SuggestionList value="x" loading={false} error={null} suggestions={[SUGGESTION]} onPick={() => {}} onDecodeAll={onDecodeAll} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Decode all the way' }))
    expect(onDecodeAll).toHaveBeenCalledTimes(1)
  })

  it('shows a busy, disabled button while decoding', () => {
    render(
      <SuggestionList
        value="x" loading={false} error={null} suggestions={[SUGGESTION]}
        onPick={() => {}} onDecodeAll={() => {}} decodingAll
      />
    )
    const button = screen.getByRole('button', { name: 'decoding…' })
    expect(button).toBeDisabled()
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('announces every async outcome through one polite status region', () => {
    const props = { value: 'x', error: null, onPick: () => {}, onDecodeAll: () => {} }
    const { rerender } = render(<SuggestionList {...props} loading suggestions={[]} />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('analysing…')

    rerender(<SuggestionList {...props} loading={false} suggestions={[SUGGESTION]} />)
    expect(screen.getByRole('status').textContent).toBe('1 decoding suggestion')

    rerender(<SuggestionList {...props} loading={false} suggestions={[]} />)
    expect(screen.getByRole('status').textContent).toMatch(/nothing obvious to decode/i)
  })
})
