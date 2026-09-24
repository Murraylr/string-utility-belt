import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HexView from './HexView'

/** Role queries compute accessibility info per element — far too slow over a 4096-row dump. */
const rows = () => Array.from(document.querySelectorAll('[role="row"]'))
const showMore = () => Array.from(document.querySelectorAll('button')).find(b => /show more/i.test(b.textContent ?? '')) ?? null

describe('HexView', () => {
  it('renders an offset/hex/ascii dump as table rows of cells', () => {
    render(<HexView bytes={new Uint8Array([0x41, 0x42, 0x43])} />)
    const [row] = rows()
    const cells = Array.from(row.querySelectorAll('[role="cell"]')).map(c => c.textContent!.trim())
    expect(cells).toEqual(['00000000', '41 42 43', 'ABC'])
  })

  it('caps the initial dump at 64 KB and reveals more on demand', () => {
    const bytes = new Uint8Array(64 * 1024 + 100).fill(0x41)
    render(<HexView bytes={bytes} />)
    expect(rows()).toHaveLength(4096)
    const button = showMore()!
    expect(button).toHaveTextContent(/show more \(100 bytes left\)/i)
    fireEvent.click(button)
    expect(rows()).toHaveLength(4096 + 7)
    expect(showMore()).toBeNull()
  })

  it('shows no "show more" button when everything already fits', () => {
    render(<HexView bytes={new Uint8Array([1, 2, 3])} />)
    expect(showMore()).toBeNull()
  })

  it('shows the whole of a new, larger value instead of the previous value\'s length', () => {
    const { rerender } = render(<HexView bytes={new Uint8Array([1, 2, 3])} />)
    rerender(<HexView bytes={new Uint8Array(100).fill(0x42)} />)
    expect(rows()).toHaveLength(7)
    expect(showMore()).toBeNull()
  })

  it('goes back to the 64 KB cap for a new value after "show more"', () => {
    const big = () => new Uint8Array(64 * 1024 + 100)
    const { rerender } = render(<HexView bytes={big()} />)
    fireEvent.click(showMore()!)
    expect(rows()).toHaveLength(4096 + 7)
    rerender(<HexView bytes={big()} />)
    expect(rows()).toHaveLength(4096)
  })
})
