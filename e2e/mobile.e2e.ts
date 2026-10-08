/**
 * Phone widths: no page may scroll sideways, on any route, in either theme — including
 * with the tool's widest pieces open (the add-step picker, a dialog) and a pipeline that
 * nests a branch and a run-on-each step. A wide element in a grid or flex track is the
 * usual cause (a missing `min-w-0`), and it only shows on a narrow screen.
 */
import { test, expect, type Page } from '@playwright/test'

const ROUTES = [
  '/utilities/', '/util/base64_encode/', '/util/aes_decrypt/', '/recipes/', '/recipes/excel-column-to-sql-in-clause/',
  '/docs/', '/blog/', '/blog/base64-encode-decode-online/', '/changelog/', '/about/', '/privacy/', '/integrations/',
  '/advertise/', '/',
]

const PIPELINE = {
  v: 3, showPreviews: true,
  steps: [
    { id: 'a', utilityId: 'trim', enabled: true, params: {} },
    { id: 'b', type: 'each', split: { mode: 'lines' }, enabled: true, steps: [{ id: 'b1', utilityId: 'slugify', enabled: true, params: {} }] },
    { id: 'c', type: 'branch', merge: { mode: 'concat', separator: '\n' }, enabled: true, branches: [
      [{ id: 'c1', utilityId: 'base64_encode', enabled: true, params: {} }],
      [{ id: 'c2', utilityId: 'hash', enabled: true, params: {} }],
    ] },
  ],
}

/** How far the page scrolls sideways, and the outermost elements that stick out. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    // inside a container that scrolls sideways on purpose (the header nav, code blocks, tables) is fine
    const scrolls = (el: Element) => ['auto', 'scroll', 'hidden'].includes(getComputedStyle(el).overflowX)
    const culprits = [...document.querySelectorAll('body *')]
      .filter(el => el.getBoundingClientRect().right > vw + 1 && (el.parentElement?.getBoundingClientRect().right ?? 0) <= vw + 1
        && !(el.parentElement && scrolls(el.parentElement)))
      .map(el => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)}`)
    return { by: document.documentElement.scrollWidth - vw, culprits }
  })
}

for (const width of [320, 375]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 760 }, colorScheme: theme, isMobile: true, hasTouch: true })

      for (const path of ROUTES) {
        test(`${path} does not scroll sideways`, async ({ page }) => {
          await page.goto(path)
          await page.waitForLoadState('networkidle')
          expect(await overflow(page)).toEqual({ by: 0, culprits: [] })
        })
      }

      test('the tool, with nested steps, the picker and a dialog open, does not scroll sideways', async ({ page }) => {
        await page.addInitScript(p => localStorage.setItem('string-utility-belt', JSON.stringify(p)), PIPELINE)
        await page.goto('/')
        await page.locator('#pipeline-input').fill('  Hello World\nSecond line  ')
        await expect(page.locator('[data-step-id]').first()).toBeVisible()
        expect(await overflow(page)).toEqual({ by: 0, culprits: [] })

        await page.getByRole('button', { name: /^add step$/i }).first().click()
        await expect(page.getByRole('combobox', { name: 'Search utilities' })).toBeVisible()
        expect(await overflow(page)).toEqual({ by: 0, culprits: [] })
        await page.keyboard.press('Escape')

        await page.getByRole('button', { name: /^library$/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        expect(await overflow(page)).toEqual({ by: 0, culprits: [] })
      })
    })
  }
}
