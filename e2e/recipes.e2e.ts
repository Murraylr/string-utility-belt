/**
 * Recipe pages: the pre-rendered `/recipes/<slug>/` page (content and worked
 * example in the raw HTML, before any JavaScript), the live example once the app
 * mounts, and "Open in the editor" handing the steps and input to the tool in
 * place. Like the doc-page suite, the raw-HTML checks need `build:seo:fast` run
 * against the same outDir the preview serves.
 */
import { test, expect } from '@playwright/test'
import { isSameDocument, markDocument, result, stepCard } from './utils'

const SLUG = 'excel-column-to-sql-in-clause'
const EXAMPLE_OUTPUT = "IN ('dana.whitfield@northwind.com', 'marcus.oneil@contoso.com', 'Priya.Raman@fabrikam.io', 'sean.o''connor@adventure-works.com', 'leo.martins@contoso.com')"

test.describe('recipe pages', () => {
  test('are pre-rendered: heading, worked example and every step with its output are in the raw HTML', async ({ request }) => {
    const raw = await request.get(`/recipes/${SLUG}/`)
    expect(raw.ok()).toBeTruthy()
    const body = await raw.text()
    expect(body).toContain('Turn an Excel column into a SQL IN clause</h1>')
    expect(body).toContain('id="recipe-trace"')
    expect(body).toContain('Step by step')
    expect(body).toContain('What if you skip a step?')
    // the final output, HTML-escaped, in the static widget
    expect(body).toContain(EXAMPLE_OUTPUT.replace(/'/g, '&#x27;'))
  })

  test('the live example reacts to new input', async ({ page }) => {
    await page.goto(`/recipes/${SLUG}/`)
    const output = page.getByRole('status', { name: 'Output' })
    await expect(output).toHaveText(EXAMPLE_OUTPUT)
    await page.getByRole('textbox', { name: 'recipe input' }).fill("a@example.com\n a@example.com\nO'Neil@example.com")
    await expect(output).toHaveText("IN ('a@example.com', 'O''Neil@example.com')")
  })

  test('"Open in the editor" loads the steps and the input into the tool, in place', async ({ page }) => {
    await page.goto(`/recipes/${SLUG}/`)
    await page.getByRole('textbox', { name: 'recipe input' }).fill('x\ny')
    await markDocument(page)
    await page.getByRole('link', { name: 'Open in the editor' }).click()

    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/)
    await expect(page.locator('#pipeline-input')).toHaveValue('x\ny')
    await expect(stepCard(page, 4)).toBeVisible()
    await expect(result(page)).toContainText("IN ('x', 'y')")
    expect(await isSameDocument(page)).toBe(true)
  })

  test('the recipe index links each recipe, and the header links the index', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'main' }).getByRole('link', { name: 'Recipes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible()
    await page.getByRole('link', { name: /Turn an Excel column into a SQL IN clause/ }).click()
    await expect(page).toHaveURL(new RegExp(`/recipes/${SLUG}/$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Turn an Excel column into a SQL IN clause')
  })

  test('an unknown recipe is not found and kept out of search indexes', async ({ page }) => {
    await page.goto('/recipes/no-such-recipe/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Unknown recipe')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })
})
