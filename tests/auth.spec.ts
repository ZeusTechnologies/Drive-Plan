import { expect, test } from '@playwright/test'
import { AUTH_EMAIL, mockSupabaseAuth, recoveryCallbackUrl, signIn, verificationCallbackUrl } from './auth-helpers'

test('protects the dashboard until a Supabase session exists', async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in to DrivePlan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toHaveCount(0)
})

test('creates an unverified account with normalized profile metadata', async ({ page }) => {
  const state = await mockSupabaseAuth(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Full name').fill('  Vannet   Airtel  ')
  await page.getByLabel('Email address').fill('  DRIVER@Example.COM ')
  await page.getByLabel('Password', { exact: true }).fill('RoadPlan9')
  await page.getByLabel('Confirm password', { exact: true }).fill('RoadPlan9')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('Account created. Check your email to verify your account before signing in.')).toBeVisible()
  expect(state.signupEmail).toBe(AUTH_EMAIL)
  expect(state.signupFullName).toBe('Vannet Airtel')
  expect(state.signupRedirect).toBe('http://127.0.0.1:4173/?auth=verified')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toHaveCount(0)
})

test('validates signup fields before contacting Supabase', async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Full name').fill('Vannet Airtel')
  await page.getByLabel('Email address').fill('invalid')
  await page.getByLabel('Password', { exact: true }).fill('RoadPlan9')
  await page.getByLabel('Confirm password', { exact: true }).fill('RoadPlan8')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.')

  await page.getByLabel('Email address').fill(AUTH_EMAIL)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
})

test('shows a safe error for incorrect credentials', async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.goto('/')
  await page.getByLabel('Email address').fill(AUTH_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('The email or password is incorrect.')
})

test('restores a session on refresh and logout protects the dashboard without deleting DrivePlan data', async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('driveplan.last-platform', JSON.stringify('bolt')))
  await signIn(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()

  const settingsButtons = page.getByRole('button', { name: 'Settings' })
  await (page.viewportSize()!.width <= 840 ? settingsButtons.last() : settingsButtons.first()).click()
  await expect(page.getByText(AUTH_EMAIL)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to DrivePlan' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('driveplan.last-platform'))).toBe('"bolt"')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in to DrivePlan' })).toBeVisible()
})

test('sends a password recovery request to the current-origin callback', async ({ page }) => {
  const state = await mockSupabaseAuth(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await page.getByLabel('Email address').fill(' DRIVER@Example.COM ')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText('If an account exists for this email, a secure password reset link is on its way.')).toBeVisible()
  expect(state.recoveryEmail).toBe(AUTH_EMAIL)
  expect(state.recoveryRedirect).toBe('http://127.0.0.1:4173/?auth=recovery')
})

test('recognizes a recovery callback and updates the password', async ({ page }) => {
  const state = await mockSupabaseAuth(page)
  await page.goto(recoveryCallbackUrl())
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await page.getByLabel('New password', { exact: true }).fill('NewRoadPlan9')
  await page.getByLabel('Confirm new password', { exact: true }).fill('NewRoadPlan9')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Your password has been updated securely.')).toBeVisible()
  expect(state.passwordUpdated).toBe(true)
  await page.getByRole('button', { name: 'Continue to DrivePlan' }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()
})

test('accepts a Supabase email-verification callback as a signed-in session', async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.goto(verificationCallbackUrl())
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
  expect(new URL(page.url()).searchParams.get('auth')).toBeNull()
})
