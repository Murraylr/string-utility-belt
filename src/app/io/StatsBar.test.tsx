import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatsBar from './StatsBar'

/** Each figure is its own item; joined here so a test reads like the bar. */
const readout = () => Array.from(screen.getByTestId('stats-bar').children).map(c => c.textContent).join(' · ')

describe('StatsBar', () => {
  it('shows type/lines/words/chars/bytes for a string', () => {
    render(<StatsBar value="hello world" />)
    expect(readout()).toBe('text · 1 line · 2 words · 11 chars · 11 bytes')
  })

  it('counts code points and UTF-8 bytes, not UTF-16 units', () => {
    render(<StatsBar value="😀é" />)
    expect(readout()).toBe('text · 1 line · 1 word · 2 chars · 6 bytes')
  })

  it('labels a json value as json and measures its pretty-printed form', () => {
    render(<StatsBar value={{ a: 1 }} />)
    // '{\n  "a": 1\n}'
    expect(readout()).toBe('json · 3 lines · 4 words · 12 chars · 12 bytes')
  })

  it('shows only the type and byte length for bytes', () => {
    render(<StatsBar value={new Uint8Array([1, 2, 3])} />)
    expect(readout()).toBe('bytes · 3 bytes')
  })

  it('uses the singular for one byte', () => {
    render(<StatsBar value={new Uint8Array([1])} />)
    expect(readout()).toBe('bytes · 1 byte')
  })
})
