import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider, useTool } from '@/app/ToolContext'
import { track } from '@/app/analytics/analytics'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { RECIPE_CATEGORIES, recipePath, toPipelineSteps } from '@/recipes/types'
import { walkSteps } from '@/core/steps'
import type { PipelineStep } from '@/types/utility'
import excelToSql from '@/recipes/excel-column-to-sql-in-clause/recipe'
import RecipeGallery from './RecipeGallery'

/** Per-test control over the recipe chunks: hold a load open, or make it fail. */
const loads = vi.hoisted(() => ({ fail: new Set<string>(), hold: new Map<string, Promise<void>>() }))

vi.mock('@/recipes/_generated/loaders', async importOriginal => {
  const { RECIPE_LOADERS } = await importOriginal<typeof import('@/recipes/_generated/loaders')>()
  return {
    RECIPE_LOADERS: Object.fromEntries(Object.entries(RECIPE_LOADERS).map(([slug, load]) => [slug, async () => {
      await loads.hold.get(slug)
      if (loads.fail.has(slug)) throw new Error('chunk failed to load')
      return load()
    }])),
  }
})

vi.mock('@/app/analytics/analytics', async importOriginal => ({
  ...await importOriginal<typeof import('@/app/analytics/analytics')>(),
  track: vi.fn(),
}))

function Harness({ onClose = () => {}, show = true }: { onClose?: () => void; show?: boolean }) {
  return (
    <ToolProvider initialSteps={[]} initialInput="">
      <StateProbe />
      {show && <RecipeGallery onClose={onClose} />}
    </ToolProvider>
  )
}

function StateProbe() {
  const { state, input } = useTool()
  return (
    <div
      data-testid="probe"
      data-name={state.name ?? ''}
      data-input={String(input)}
      data-json={JSON.stringify(state.steps)}
    />
  )
}

const probe = () => screen.getByTestId('probe')
const loadedSteps = (): PipelineStep[] => JSON.parse(probe().getAttribute('data-json')!)

/** Every step's utility (or step type), depth-first: the pipeline's shape without its ids. */
function shape(steps: PipelineStep[]): string[] {
  const out: string[] = []
  walkSteps(steps, s => { out.push('utilityId' in s ? s.utilityId : String(s.type)) })
  return out
}

function ids(steps: PipelineStep[]): string[] {
  const out: string[] = []
  walkSteps(steps, s => { out.push(s.id) })
  return out
}

beforeEach(() => {
  localStorage.clear()
  loads.fail.clear()
  loads.hold.clear()
  vi.mocked(track).mockClear()
})

describe('RecipeGallery', () => {
  it('is a labelled dialog listing every recipe under its category, with a link to its page', () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog', { name: 'Recipes' })
    for (const recipe of RECIPE_INDEX) {
      const section = within(dialog).getByRole('region', { name: recipe.category })
      const card = within(section).getByRole('heading', { name: recipe.name }).closest('li') as HTMLElement
      expect(within(card).getByRole('button', { name: `Try it: ${recipe.name}` })).toBeEnabled()
      expect(within(card).getByRole('link', { name: `How it works: ${recipe.name}` })).toHaveAttribute('href', recipePath(recipe.slug))
    }
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(RECIPE_INDEX.length)
  })

  it('orders the categories as the recipes page does, leaving out empty ones', () => {
    render(<Harness />)
    const shown = screen.getAllByRole('region').map(r => within(r).getByRole('heading', { level: 3 }).textContent)
    const expected = RECIPE_CATEGORIES.filter(c => RECIPE_INDEX.some(r => r.category === c))
    expect(shown).toEqual(expected)
  })

  it('shows each recipe\'s numbered (top-level) step count', () => {
    render(<Harness />)
    const card = screen.getByRole('heading', { name: excelToSql.name }).closest('li') as HTMLElement
    expect(within(card).getByText(`${excelToSql.steps.length} steps`)).toBeInTheDocument()
  })

  it('"Try it" loads the recipe\'s steps with fresh ids and its first sample, names the pipeline, reports it and closes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: `Try it: ${excelToSql.name}` }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))

    const expected = toPipelineSteps(excelToSql.steps)
    const loaded = loadedSteps()
    expect(probe()).toHaveAttribute('data-name', excelToSql.name)
    expect(probe()).toHaveAttribute('data-input', excelToSql.samples[0].input)
    expect(shape(loaded)).toEqual(shape(expected))
    expect(ids(loaded).filter(id => ids(expected).includes(id))).toEqual([])
    expect(JSON.stringify(loaded)).not.toContain('"why"')
    expect(track).toHaveBeenCalledWith('pipeline_load', {
      method: 'recipe_gallery', recipe_id: excelToSql.slug, step_count: shape(expected).length,
    })
  })

  it('while a recipe loads, its button stays focused and busy and every other "Try it" is disabled', async () => {
    let release!: () => void
    loads.hold.set(excelToSql.slug, new Promise(resolve => { release = resolve }))
    const user = userEvent.setup()
    render(<Harness />)
    const button = screen.getByRole('button', { name: `Try it: ${excelToSql.name}` })
    await user.click(button)
    expect(button).toHaveTextContent('Loading…')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeEnabled()
    expect(button).toHaveFocus()
    for (const other of screen.getAllByRole('button', { name: /^Try it: / })) {
      if (other !== button) expect(other).toBeDisabled()
    }
    await user.click(button)
    release()
    await waitFor(() => expect(loadedSteps()).not.toEqual([]))
    // the second click, made while loading, did not start a second load
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('says so on the card when the recipe cannot be loaded, keeps the pipeline, and can try again', async () => {
    loads.fail.add(excelToSql.slug)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Harness onClose={onClose} />)
    const card = screen.getByRole('heading', { name: excelToSql.name }).closest('li') as HTMLElement
    const button = within(card).getByRole('button', { name: `Try it: ${excelToSql.name}` })
    await user.click(button)

    expect(await within(card).findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(loadedSteps()).toEqual([])
    expect(onClose).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()

    loads.fail.clear()
    await user.click(button)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(within(card).queryByRole('alert')).toBeNull()
  })

  it('a load that finishes after the dialog closed leaves the pipeline alone', async () => {
    let release!: () => void
    loads.hold.set(excelToSql.slug, new Promise(resolve => { release = resolve }))
    const user = userEvent.setup()
    const { rerender } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: `Try it: ${excelToSql.name}` }))
    rerender(<Harness show={false} />)
    release()
    // let the held load and everything chained on it settle
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(loadedSteps()).toEqual([])
    expect(probe()).toHaveAttribute('data-input', '')
    expect(track).not.toHaveBeenCalled()
  })
})
