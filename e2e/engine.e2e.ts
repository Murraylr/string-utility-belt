/**
 * roadmap §13.3 — the run engine: the large-input guard/banner, and the custom
 * JavaScript sandbox (a real value back, and no network access).
 */
import { test, expect } from '@playwright/test'
import { outputStats, quickAdd, result, setInput, stepCard } from './utils'

test.describe('engine', () => {
  test('a 1.2 MB input shows the large-input banner, and "Run" produces output', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/')
    await quickAdd(page, 'case') // default mode: upper — makes the output visibly different from the input

    const big = 'a'.repeat(1_200_000)
    await setInput(page, big)

    const banner = page.getByRole('status').filter({ hasText: 'Large input' })
    await expect(banner).toContainText('1.1 MB')
    await expect(banner).toContainText('live preview paused')

    await page.getByRole('button', { name: 'Run', exact: true }).click()

    await expect(outputStats(page)).toContainText('1,200,000 chars', { timeout: 30_000 })
    await expect(result(page)).toContainText('AAAA')
  })

  test('a custom JS step runs in the sandbox and returns a value; fetch from inside it fails', async ({ page }) => {
    test.setTimeout(30_000)
    await page.goto('/')
    await quickAdd(page, 'custom_js')
    const step = stepCard(page, 0)

    // wait for the real CodeMirror editor to take over from the plain-textarea fallback
    // (its hint paragraph only exists once the chunk has mounted) before typing, so a
    // keystroke never lands mid-swap between the two.
    await step.locator('p', { hasText: 'Tab indents' }).waitFor()
    const codeBox = step.getByRole('textbox', { name: 'code' })
    await codeBox.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.keyboard.type(
      "try { await fetch('https://example.com'); } catch (e) { return 'BLOCKED:' + String(input).toUpperCase(); } "
      + "return 'OK:' + String(input).toUpperCase();"
    )

    await setInput(page, 'hi')
    await expect(step.locator('[role="alert"]')).toHaveCount(0)
    await expect(result(page)).toHaveText('BLOCKED:HI', { timeout: 10_000 })
  })
})
