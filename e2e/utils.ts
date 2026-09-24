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

/** The output panel's char/word/byte readout (the input panel has one too; this is the last on the page). */
export const outputStats = (page: Page) => page.locator('[data-testid="stats-bar"]').last()

/** A step (or branch) card by its position in the top-level pipeline. */
export const stepCard = (page: Page, index: number) => page.locator('[data-step-id]').nth(index)

/** The toolbar's "quick add" select — the only bare `<select>` directly inside it. */
export const quickAddSelect = (page: Page) => page.locator('section[aria-label="pipeline toolbar"] > select')

/** Adds a step by utility id via the toolbar's quick-add dropdown. */
export async function quickAdd(page: Page, utilityId: string) {
  const select = quickAddSelect(page).filter({ has: page.locator(`option[value="${utilityId}"]`) })
  await select.selectOption(utilityId)
}

/** Fills the main pipeline input textarea. */
export async function setInput(page: Page, text: string) {
  await page.locator('#pipeline-input').fill(text)
}
