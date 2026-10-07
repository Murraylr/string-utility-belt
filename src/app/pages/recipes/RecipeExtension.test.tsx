import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toPipelineSteps } from '@/recipes/types'
import excelToSql from '@/recipes/excel-column-to-sql-in-clause/recipe'
import kubernetesSecret from '@/recipes/decode-kubernetes-secret/recipe'
import { CHROME_WEB_STORE_URL, INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import { readPref } from '@/app/prefs'
import { track, trackPipelineEvent } from '@/app/analytics/analytics'
import { __resetExtensionBridgeForTests } from '@/app/extension/bridge'
import { installFakeExtension, type FakeExtension } from '@/app/extension/fakeExtension'
import RecipeExtension from './RecipeExtension'

vi.mock('@/app/analytics/analytics', async importOriginal => {
  const mod = await importOriginal<typeof import('@/app/analytics/analytics')>()
  return { ...mod, track: vi.fn(), trackPipelineEvent: vi.fn() }
})

const STEPS = toPipelineSteps(excelToSql.steps)
const SAVE = { name: 'Save to extension' }
const GET = { name: /get the free extension/i }

function renderStrip(steps = STEPS, name = excelToSql.name) {
  return render(<RecipeExtension steps={steps} name={name} recipeId={excelToSql.slug} />)
}

/** A desktop Chromium browser, which can install from the Chrome Web Store. */
function desktopChromium() {
  Object.defineProperty(navigator, 'userAgentData', { value: { mobile: false }, configurable: true })
}

const settle = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  __resetExtensionBridgeForTests()
  vi.mocked(track).mockClear()
  vi.mocked(trackPipelineEvent).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (navigator as { userAgentData?: unknown }).userAgentData
  localStorage.clear()
})

describe('RecipeExtension without the extension', () => {
  it('offers the store listing in a desktop Chromium browser, with the pitch', () => {
    desktopChromium()
    renderStrip()
    expect(screen.getByText('Use this recipe on any web page')).toBeInTheDocument()
    const link = screen.getByRole('link', GET)
    expect(link).toHaveAttribute('href', CHROME_WEB_STORE_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(link).toHaveAccessibleName(/opens the Chrome Web Store in a new tab/)
    expect(screen.queryByRole('button', SAVE)).toBeNull()
  })

  it('reports the click, marks the integrations as seen and says how to finish', async () => {
    desktopChromium()
    renderStrip()
    const link = screen.getByRole('link', GET)
    link.addEventListener('click', e => e.preventDefault()) // jsdom cannot open a tab
    await userEvent.setup().click(link)

    expect(track).toHaveBeenCalledWith('integration_click', { integration: 'chrome', source: 'recipe', recipe_id: excelToSql.slug })
    expect(readPref(INTEGRATIONS_SEEN_PREF, false)).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('Installed it? Reload this page to save this recipe to it.')
  })

  it('shows nothing in a browser that cannot install it (Firefox, Safari, phones)', async () => {
    const { container } = renderStrip()
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing in a phone\'s Chromium', async () => {
    Object.defineProperty(navigator, 'userAgentData', { value: { mobile: true }, configurable: true })
    const { container } = renderStrip()
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the store listing once a ping goes unanswered (another extension owns chrome.runtime)', async () => {
    desktopChromium()
    installFakeExtension({ id: 'some-other-extension' })
    renderStrip()
    expect(screen.queryByRole('link', GET)).toBeNull() // still asking: no flash of the wrong action
    expect(await screen.findByRole('link', GET)).toBeInTheDocument()
  })
})

describe('RecipeExtension with the extension', () => {
  let fake: FakeExtension
  beforeEach(() => {
    desktopChromium()
    fake = installFakeExtension({ stepTypes: ['utility', 'branch', 'macro', 'each'] })
  })

  const lastRequest = () => fake.sent.filter(s => s.message.type === 'request').pop()?.message.request

  it('saves the recipe under its name in one click, and shows the extension\'s answer', async () => {
    fake.respond(() => ({ ok: true, message: `Saved "${excelToSql.name}" — it's on the right-click menu.` }))
    renderStrip()
    const save = await screen.findByRole('button', SAVE)
    expect(screen.queryByRole('link', GET)).toBeNull()

    await userEvent.setup().click(save)
    expect(await screen.findByText(`Saved "${excelToSql.name}" — it's on the right-click menu.`)).toBeInTheDocument()
    expect(lastRequest()).toEqual({ type: 'save-pipeline', name: excelToSql.name, steps: STEPS })
    expect(trackPipelineEvent).toHaveBeenCalledWith('extension_pipeline_save', STEPS, { source: 'recipe', recipe_id: excelToSql.slug })
  })

  it('shows a refusal as a warning and reports nothing', async () => {
    fake.respond(() => ({ ok: false, error: 'The extension holds up to 50 pipelines.' }))
    renderStrip()
    await userEvent.setup().click(await screen.findByRole('button', SAVE))
    expect(await screen.findByText('The extension holds up to 50 pipelines.')).toHaveClass('text-warn')
    expect(trackPipelineEvent).not.toHaveBeenCalled()
  })

  it('is offered even where the store is not (the extension is what counts)', async () => {
    delete (navigator as { userAgentData?: unknown }).userAgentData
    renderStrip()
    expect(await screen.findByRole('button', SAVE)).toBeEnabled()
  })

  it('asks for an update instead of saving a recipe whose step types an older extension would drop', async () => {
    vi.unstubAllGlobals()
    __resetExtensionBridgeForTests()
    fake = installFakeExtension() // predates "run on each"
    renderStrip(toPipelineSteps(kubernetesSecret.steps), kubernetesSecret.name)
    expect(await screen.findByRole('button', SAVE)).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('This recipe needs a newer version of the extension. Update it, then reload this page.')
    expect(lastRequest()).toBeUndefined()
  })
})
