/**
 * Shared helpers for the *.e2e.ts suites (roadmap §13.3). Not itself a test file
 * (playwright.config.ts's testMatch is `**\/*.e2e.ts`), just selectors and small
 * flows several suites need. Every selector here goes by role/label/text or a
 * stable `data-*`/id hook documented in CLAUDE.md — never a CSS class or DOM
 * position, since layout/markup are being adjusted concurrently by other agents.
 */
import { type Page } from '@playwright/test'

/** The pipeline's result region — every page that runs a pipeline names it "result". */
export const result = (page: Page) => page.getByRole('region', { name: 'result' })

/**
 * The result's exact text (newlines, indentation) in either view. Highlighted kinds (JSON, XML,
 * YAML…) show a `<pre>`, then swap to lazily-loaded CodeMirror, whose textContent adds the
 * line-number gutter and drops line breaks — `toHaveText` on `result()` passes only if it polls
 * before the swap. Poll this instead: `expect.poll(() => resultText(page)).toBe(…)`. Reads the
 * rendered lines via CodeMirror's documented `cm-content`/`cm-line` classes (library API, not app
 * markup); CodeMirror virtualizes long documents, so keep highlighted outputs short.
 */
export function resultText(page: Page): Promise<string> {
  return result(page).evaluate(region => {
    const lines = region.querySelectorAll('.cm-content > .cm-line')
    return lines.length ? Array.from(lines, line => line.textContent ?? '').join('\n') : region.textContent ?? ''
  })
}

/** The output panel's char/word/byte readout (the input panel has one too; this is the last on the page). */
export const outputStats = (page: Page) => page.locator('[data-testid="stats-bar"]').last()

/** A step (or branch) card by its position in the top-level pipeline. */
export const stepCard = (page: Page, index: number) => page.locator('[data-step-id]').nth(index)

/** The add row's "quick add" select, under the step list. */
export const quickAddSelect = (page: Page) => page.getByRole('combobox', { name: 'quick add a utility' })

/** Adds a step by utility id via the toolbar's quick-add dropdown. */
export async function quickAdd(page: Page, utilityId: string) {
  const select = quickAddSelect(page).filter({ has: page.locator(`option[value="${utilityId}"]`) })
  await select.selectOption(utilityId)
}

/** Fills the main pipeline input textarea. */
export async function setInput(page: Page, text: string) {
  await page.locator('#pipeline-input').fill(text)
}

type Marked = { __e2eSameDocument?: true }

/** Marks the loaded document, so `isSameDocument` can tell an in-app navigation from a page load. */
export async function markDocument(page: Page) {
  await page.evaluate(() => { (window as Marked).__e2eSameDocument = true })
}

/** True while the document `markDocument` marked is still the one showing (no page load since). */
export const isSameDocument = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as Marked).__e2eSameDocument === true)
