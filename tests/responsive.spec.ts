import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('lays out without horizontal overflow and exposes the correct navigation', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Amount earned in Uganda shillings' })).toBeVisible()

  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1)
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport + 1)

  const mobile = /android|ios/.test(testInfo.project.name)
  if (mobile) {
    await expect(page.getByRole('navigation').last()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add earnings' }).last()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
  } else {
    await expect(page.getByRole('complementary').getByRole('button', { name: 'Overview' })).toBeVisible()
  }
})

test('completes the core earnings allocation flow', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Amount earned in Uganda shillings' }).fill('100000')
  await expect(page.getByText('UGX 30,000', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('UGX 20,000', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('UGX 10,000', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('UGX 40,000', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Allocate & save' }).click()
  await expect(page.getByRole('heading', { name: 'UGX 100,000' })).toBeVisible()
  await expect(page.getByText('1 trip logged today')).toBeVisible()
})

test('publishes a valid manifest and remains available offline', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chrome-windows', 'One production PWA verification is sufficient.')

  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBeTruthy()
  const data = await manifest.json()
  expect(data.name).toContain('DrivePlan')
  expect(data.display).toBe('standalone')
  expect(data.icons[0].sizes).toBe('1280x1280')

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
  })
  await page.reload()
  await context.route('**/*', (route) => route.abort('internetdisconnected'))
  await page.reload()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()
  await context.unroute('**/*')
})

test('synchronizes local-first data between open app windows', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chrome-windows', 'One storage synchronization verification is sufficient.')
  const secondPage = await context.newPage()
  await secondPage.goto('/')

  await page.getByRole('textbox', { name: 'Amount earned in Uganda shillings' }).fill('80000')
  await page.getByRole('button', { name: 'Allocate & save' }).click()

  await expect(secondPage.getByRole('heading', { name: 'UGX 80,000' })).toBeVisible()
  await expect(secondPage.getByText('1 trip logged today')).toBeVisible()
})
