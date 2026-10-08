/** "Run on each" steps: a sub-pipeline run on every line or JSON value, built in the editor and opened from a link. */
import { test, expect } from '@playwright/test'
import LZString from 'lz-string'
import { quickAdd, result, resultText, setInput } from './utils'

test.describe('run on each', () => {
  test('decodes every line on its own, leaves empty lines alone and counts the line that failed', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Run on each', exact: true }).click()
    const each = page.locator('[data-step-id]').first()
    await expect(each.getByRole('combobox', { name: 'split the input into' })).toHaveValue('lines')
    await each.getByLabel('add a step to this run-on-each step').selectOption('base64_decode')

    await setInput(page, 'aGVsbG8=\nd29ybGQ=\n\nnot base64!')

    await expect(result(page)).toHaveText('hello\nworld\n\nnot base64!')
    await expect(each.getByTestId('each-stats')).toHaveText('4 lines · 1 failed')
    // the each step counts the failure; the nested step shows the item it failed on
    await expect(each.getByRole('alert').first()).toContainText('1 of 4 lines failed (line 4:')
    await expect(each.getByRole('group', { name: 'steps run on each line' }).getByRole('alert')).toContainText(/^line 4: /)
  })

  test('wraps a selected step so it runs per line, and unwraps it again', async ({ page }) => {
    await page.goto('/')
    await quickAdd(page, 'reverse')
    await setInput(page, 'ab\ncd')
    // on the whole input, reverse also swaps the lines
    await expect(result(page)).toHaveText('dc\nba')

    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByLabel('select step 1').click()
    await page.getByRole('button', { name: 'Run on each line' }).click()
    // per line, each line is reversed where it is
    await expect(result(page)).toHaveText('ba\ndc')

    await page.locator('[data-step-id^="each"]').getByRole('button', { name: 'unwrap' }).click()
    await expect(result(page)).toHaveText('dc\nba')
  })

  test('a shared link decodes every value of a Kubernetes Secret, keeping its keys', async ({ page }) => {
    // built by hand (not with the app's encodeShare) so a wire-format change fails here
    const payload = LZString.compressToEncodedURIComponent(JSON.stringify({
      v: 3,
      steps: [{
        id: 'e', type: 'each', split: { mode: 'json-values' }, skipEmpty: true,
        steps: [{ id: 'd', utilityId: 'base64_decode', params: {} }],
      }],
      input: '{"username":"YWRtaW4=","password":"czNjcjN0IQ=="}',
    }))
    await page.goto(`/#/p/${payload}`)
    await expect.poll(async () => {
      try { return JSON.parse(await resultText(page)) } catch { return null }
    }).toEqual({ username: 'admin', password: 's3cr3t!' })
  })
})
