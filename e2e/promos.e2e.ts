/**
 * At most one promo per page: a sponsor, or one of our own tools while the page is
 * unbooked (`promoPlan` leaves every extra slot of a sponsorable page empty, and gives an
 * index page one). Checked on desktop, where promos show; phones show none.
 */
import { expect, test } from '@playwright/test'

const PAGES = [
  '/', '/utilities/', '/util/jwt_decode/', '/util/sha3/', '/util/json_pretty/', '/recipes/',
  '/recipes/decode-kubernetes-secret/', '/blog/', '/blog/md5-insecure-but-useful/', '/docs/', '/about/',
  '/integrations/', '/changelog/',
]

test.use({ viewport: { width: 1366, height: 900 } })

test('every page shows at most one promo', async ({ page }) => {
  test.setTimeout(60_000)
  for (const path of PAGES) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const shown = await page.locator('[data-promo], [data-sponsorship]').evaluateAll(els =>
      els.filter(el => el.getClientRects().length > 0).map(el => el.getAttribute('data-promo') ?? el.getAttribute('data-sponsorship')))
    expect(shown.length, `${path}: ${shown.join(', ')}`).toBeLessThanOrEqual(1)
  }
})
