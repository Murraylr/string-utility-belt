/** roadmap §13.3 — Magic auto-detect: "Decode all the way" on base64-of-JSON. */
import { test, expect } from '@playwright/test'
import { resultText, setInput } from './utils'

test.describe('magic', () => {
  test('paste base64-of-JSON, run Magic, "Decode all the way" produces the pretty JSON', async ({ page }) => {
    const payload = { hello: 'world', n: 42 }
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')

    await page.goto('/')
    await setInput(page, encoded)

    await page.getByRole('button', { name: 'Magic', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Magic decode' })
    await expect(dialog).toBeVisible()

    const decodeAll = dialog.getByRole('button', { name: /^Decode all the way$/ })
    await expect(decodeAll).toBeEnabled()
    await decodeAll.click()
    await expect(dialog).toBeHidden()

    await expect(page.locator('[data-step-id]')).toHaveCount(2) // base64 decode + JSON pretty-print
    // exact, and in either view: JSON is highlighted by a lazily-swapped-in CodeMirror (see resultText)
    const expected = JSON.stringify(payload, null, 2)
    await expect.poll(() => resultText(page)).toBe(expected)
  })
})
