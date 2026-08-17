import { expect, test } from '@playwright/test'
import { mockSupabaseAuth, signIn } from './auth-helpers'

test.beforeEach(async ({ page }, testInfo) => {
  const verifiesPwa = testInfo.project.name === 'chrome-windows' && testInfo.title.includes('manifest')
  await mockSupabaseAuth(page, { allowServiceWorker: verifiesPwa })
  await page.goto('/')
  await signIn(page)
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
  await expect(page.getByText('UGX 25,000', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('UGX 26,530', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('UGX 10,000', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('UGX 38,470', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Allocate & save' }).click()
  await expect(page.getByRole('heading', { name: 'UGX 100,000' })).toBeVisible()
  await expect(page.getByText('1 trip logged today')).toBeVisible()
})

test('shows the profile avatar control and VIP preview without editable allocation settings', async ({ page }) => {
  const settingsButtons = page.getByRole('button', { name: 'Settings' })
  await (page.viewportSize()!.width <= 840 ? settingsButtons.last() : settingsButtons.first()).click()

  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'More control for every kilometre.' })).toBeVisible()
  await expect(page.getByText('VIP coming soon')).toBeVisible()
  await expect(page.getByText('Global allocation')).toHaveCount(0)
  await expect(page.getByText('Platform commission')).toHaveCount(0)

  await page.getByLabel('Change profile picture').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('mock-avatar'),
  })
  await expect(page.getByText('Profile picture updated.')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Vannet Airtel profile' })).toBeVisible()
})

test('publishes a valid manifest and fails safely when account data is offline', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chrome-windows', 'One production PWA verification is sufficient.')

  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBeTruthy()
  const data = await manifest.json()
  expect(data.name).toContain('DrivePlan')
  expect(data.display).toBe('standalone')
  expect(data.icons[0].sizes).toBe('192x192')

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
  })
  await page.reload()
  await context.route('**/*', (route) => route.abort('internetdisconnected'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Account data unavailable' })).toBeVisible()
  await context.unroute('**/*')
})

test('retrieves persisted account data in a second app window', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chrome-windows', 'One cross-window persistence verification is sufficient.')
  const secondPage = await context.newPage()

  await page.getByRole('textbox', { name: 'Amount earned in Uganda shillings' }).fill('80000')
  await page.getByRole('button', { name: 'Allocate & save' }).click()
  await expect(page.getByRole('heading', { name: 'UGX 80,000' })).toBeVisible()

  await secondPage.goto('/')
  await expect(secondPage.getByRole('heading', { name: 'UGX 80,000' })).toBeVisible()
  await expect(secondPage.getByText('1 trip logged today')).toBeVisible()
})
