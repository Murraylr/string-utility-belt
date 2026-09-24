import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DiffView from './DiffView'

// No mock: proves the lazy import and diff's async callback mode work with the real package.
describe('DiffView with the real diff package', () => {
  it('renders a line diff', async () => {
    render(<DiffView before={'keep\nold\n'} after={'keep\nnew\n'} />)
    const region = await screen.findByRole('region', { name: 'input to output diff' }, { timeout: 5000 })
    await waitFor(() => expect(region.textContent).toBe('  keep- old+ new'))
  })
})
