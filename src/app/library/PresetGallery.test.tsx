import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider, useTool } from '@/app/ToolContext'
import PresetGallery from './PresetGallery'
import { PRESETS } from './presets'

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  return (
    <ToolProvider initialSteps={[]} initialInput="">
      <StateProbe />
      <PresetGallery onClose={onClose} />
    </ToolProvider>
  )
}

function StateProbe() {
  const { state, input } = useTool()
  return (
    <div
      data-testid="probe"
      data-name={state.name ?? ''}
      data-steps={state.steps.length}
      data-input={String(input)}
      data-json={JSON.stringify(state.steps)}
    />
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('PresetGallery', () => {
  it('is a labelled dialog listing every shipped preset', () => {
    render(<Harness />)
    expect(screen.getByRole('dialog', { name: 'Preset gallery' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'presets' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(PRESETS.length)
    for (const preset of PRESETS) {
      expect(screen.getByRole('heading', { name: preset.name })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Try it: ${preset.name}` })).toBeInTheDocument()
    }
  })

  it('shows each preset\'s step count, nested steps included', () => {
    render(<Harness />)
    const card = screen.getByRole('heading', { name: 'Hash three ways' }).closest('[role="listitem"]') as HTMLElement
    expect(within(card).getByText('4 steps')).toBeInTheDocument()
  })

  it('"Try it" loads the preset\'s steps (with fresh ids) and sample input, then closes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Harness onClose={onClose} />)
    const preset = PRESETS.find(p => p.id === 'hash-three-ways')!
    await user.click(screen.getByRole('button', { name: `Try it: ${preset.name}` }))

    const probe = screen.getByTestId('probe')
    expect(probe).toHaveAttribute('data-name', preset.name)
    expect(probe).toHaveAttribute('data-input', preset.sampleInput)
    const loaded = JSON.parse(probe.getAttribute('data-json')!)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].type).toBe('branch')
    expect(loaded[0].branches.map((lane: any[]) => lane[0].utilityId)).toEqual(['md5', 'hash', 'hash'])
    expect(loaded[0].id).not.toBe(preset.steps[0].id)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
