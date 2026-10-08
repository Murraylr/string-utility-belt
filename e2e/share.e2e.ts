/** roadmap §13.3 — the share dialog's link/embed, and the chrome-less embed route. */
import { test, expect } from '@playwright/test'
import { quickAdd, result, setInput } from './utils'

test.describe('share', () => {
  test('copy link opens the same pipeline+result elsewhere; the embed route is chrome-less', async ({ page, context }) => {
    await page.goto('/')
    // grantPermissions needs a concrete origin to attach clipboard access to
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin })
    // the Clipboard API throws NotAllowedError on an unfocused document, which a
    // background tab in a parallel run otherwise is
    await page.bringToFront()
    await quickAdd(page, 'reverse')
    await setInput(page, 'hello')
    await expect(result(page)).toHaveText('olleh')

    await page.getByRole('button', { name: 'Share', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Share pipeline' })
    await expect(dialog).toBeVisible()
    // include the input, so the copied link reproduces the exact same result elsewhere
    await dialog.getByLabel('Include my input').check()

    const shareUrl = await dialog.locator('#share-url').inputValue()
    expect(shareUrl).toContain('#/p/')

    const copyBtn = dialog.getByRole('button', { name: /^Copy link$/ })
    await copyBtn.click()
    // the button's "copied" label is only shown for ~1.5s before reverting (see
    // ShareDialog.tsx's `announce`); poll the clipboard itself instead of that label,
    // since it is the durable, meaningful proof the copy actually happened.
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(shareUrl)

    // the embed snippet shares the same payload; pull its src out rather than re-deriving it
    await dialog.getByRole('tab', { name: 'Embed' }).click()
    const snippet = await dialog.locator('#embed-snippet').inputValue()
    const embedUrl = /src="([^"]+)"/.exec(snippet)?.[1]
    expect(embedUrl).toBeTruthy()

    await dialog.getByRole('button', { name: 'close dialog' }).click()

    // Open the copied link in a fresh page: same steps, same input, same result.
    const opened = await context.newPage()
    await opened.goto(shareUrl!)
    await expect(opened.locator('#pipeline-input')).toHaveValue('hello')
    await expect(result(opened)).toHaveText('olleh')
    await opened.close()

    // The embed route renders without the app's header/nav chrome.
    const embed = await context.newPage()
    await embed.goto(embedUrl!)
    await expect(embed.getByRole('banner')).toHaveCount(0)
    await expect(embed.getByRole('navigation', { name: 'main' })).toHaveCount(0)
    await expect(embed.getByLabel('input')).toHaveValue('hello')
    await expect(result(embed)).toHaveText('olleh')
    await embed.close()
  })
})
