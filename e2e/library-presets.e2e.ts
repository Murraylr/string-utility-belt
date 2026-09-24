/** roadmap §13.3 — the library (save/clear/load) and the preset gallery. */
import { test, expect } from '@playwright/test'
import { quickAdd, result, setInput } from './utils'

test.describe('library', () => {
  test('save the pipeline under a name, clear it, and load it back', async ({ page }) => {
    await page.goto('/')
    await quickAdd(page, 'reverse')
    await setInput(page, 'hello')
    await expect(result(page)).toHaveText('olleh')

    const name = 'e2e library test pipeline'

    // Save under a name, with the input, via the library dialog.
    await page.getByRole('button', { name: 'library', exact: true }).click()
    const libraryDialog = page.getByRole('dialog', { name: 'Library' })
    await expect(libraryDialog).toBeVisible()
    await libraryDialog.getByLabel('pipeline name to save').fill(name)
    await libraryDialog.getByLabel('save input with pipeline').check()
    await libraryDialog.getByRole('button', { name: 'Save as new' }).click()
    await expect(libraryDialog.getByRole('status')).toContainText(`Saved`)
    await expect(libraryDialog.getByRole('status')).toContainText(name)
    await libraryDialog.getByRole('button', { name: 'close dialog' }).click()
    await expect(libraryDialog).toBeHidden()

    // Clear the working pipeline via the command palette's "Clear pipeline" command.
    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    await page.keyboard.type('Clear pipeline')
    // #cmdk-c-clear: the palette's stable per-command id (`cmdk-c-<command id>`),
    // independent of how the option's visible text/chip concatenate into an a11y name.
    await palette.locator('#cmdk-c-clear').click()
    await expect(palette).toBeHidden()
    await expect(page.getByRole('button', { name: 'Add a utility' })).toBeVisible()
    await expect(page.locator('[data-step-id]')).toHaveCount(0)

    // Load it back from the library.
    await page.getByRole('button', { name: 'library', exact: true }).click()
    const reopened = page.getByRole('dialog', { name: 'Library' })
    const entry = reopened.locator('ul[aria-label="pipeline list"] li', { hasText: name })
    await expect(entry).toBeVisible()
    await entry.getByRole('button', { name: `Load ${name}` }).click()
    await expect(reopened).toBeHidden()

    await expect(page.locator('[data-step-id]')).toHaveCount(1)
    await expect(page.locator('#pipeline-input')).toHaveValue('hello')
    await expect(result(page)).toHaveText('olleh')
  })
})

test.describe('presets', () => {
  test('"Try it" loads a preset\'s steps and sample input, and produces the expected output', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'presets', exact: true }).click()
    const gallery = page.getByRole('dialog', { name: 'Preset gallery' })
    await expect(gallery).toBeVisible()

    await gallery.getByRole('button', { name: 'Try it: Double URL-decode' }).click()
    await expect(gallery).toBeHidden()

    await expect(page.locator('#pipeline-input')).toHaveValue('hello%2520world%2521')
    await expect(page.locator('[data-step-id]')).toHaveCount(2)
    await expect(result(page)).toHaveText('hello world!')
  })
})
