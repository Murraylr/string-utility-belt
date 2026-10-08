/** roadmap §13.3 — forking the pipeline into a branch with two lanes, and its merged output. */
import { test, expect } from '@playwright/test'
import { setInput } from './utils'

test.describe('branches', () => {
  test('a branch with two lanes shows the merged output', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Branch', exact: true }).click()
    const branch = page.locator('[data-step-id]').first()
    await expect(branch).toBeVisible()

    await branch.getByRole('group', { name: 'lane 1' }).getByLabel('add a step to lane 1').selectOption('case')
    await branch.getByRole('group', { name: 'lane 2' }).getByLabel('add a step to lane 2').selectOption('reverse')

    await setInput(page, 'ab')

    const merged = branch.locator('[data-preview="merged"] pre')
    await expect(merged).toHaveText('AB\nba')
  })
})
