/** roadmap §13.3 — the theme toggle (system → light → dark → system), persisted across reload. */
import { test, expect } from '@playwright/test'

test.describe('theme', () => {
  test('cycles system → light → dark, toggling the <html> "dark" class, and persists across reload', async ({ page }) => {
    // pin the OS scheme so "system" resolves deterministically to light
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const html = page.locator('html')
    const toggle = page.getByRole('button', { name: /^Theme:/ })

    await expect(html).not.toHaveClass(/dark/)

    await toggle.click() // system -> light
    await expect(html).not.toHaveClass(/dark/)
    await expect(toggle).toHaveAccessibleName(/^Theme: Light\./)

    await toggle.click() // light -> dark
    await expect(html).toHaveClass(/dark/)
    await expect(toggle).toHaveAccessibleName(/^Theme: Dark\./)

    await page.reload()
    await expect(html).toHaveClass(/dark/)
    await expect(page.getByRole('button', { name: /^Theme:/ })).toHaveAccessibleName(/^Theme: Dark\./)

    await page.getByRole('button', { name: /^Theme:/ }).click() // dark -> system
    await expect(html).not.toHaveClass(/dark/)
  })
})
