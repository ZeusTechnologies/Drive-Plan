import { expect, type Page } from '@playwright/test'

export const AUTH_EMAIL = 'driver@example.com'
export const AUTH_PASSWORD = 'RoadPlan9'

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const ACCESS_TOKEN = `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({ aud: 'authenticated', exp: 4102444800, sub: '11111111-1111-4111-8111-111111111111', email: AUTH_EMAIL })}.test-signature`
const REFRESH_TOKEN = ['test', 'refresh', 'token'].join('-')

const mockUser = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: AUTH_EMAIL,
  email_confirmed_at: '2026-08-17T10:00:00.000Z',
  confirmed_at: '2026-08-17T10:00:00.000Z',
  last_sign_in_at: '2026-08-17T10:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Vannet Airtel', email_verified: true },
  identities: [{ identity_id: 'identity-1', id: 'identity-1', user_id: '11111111-1111-4111-8111-111111111111', identity_data: { email: AUTH_EMAIL }, provider: 'email', created_at: '2026-08-17T10:00:00.000Z', updated_at: '2026-08-17T10:00:00.000Z' }],
  created_at: '2026-08-17T10:00:00.000Z',
  updated_at: '2026-08-17T10:00:00.000Z',
  is_anonymous: false,
}

const mockSession = {
  access_token: ACCESS_TOKEN,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: REFRESH_TOKEN,
  user: mockUser,
}

export interface AuthMockState {
  signupEmail: string | null
  signupFullName: string | null
  signupRedirect: string | null
  recoveryEmail: string | null
  recoveryRedirect: string | null
  passwordUpdated: boolean
  transactions: Array<Record<string, unknown>>
}

export async function mockSupabaseAuth(page: Page, options: { allowServiceWorker?: boolean } = {}) {
  const state: AuthMockState = {
    signupEmail: null,
    signupFullName: null,
    signupRedirect: null,
    recoveryEmail: null,
    recoveryRedirect: null,
    passwordUpdated: false,
    transactions: [],
  }

  const now = '2026-08-17T10:00:00.000Z'
  let profile: Record<string, unknown> = { id: mockUser.id, full_name: 'Vannet Airtel', email: AUTH_EMAIL, avatar_path: null, currency: 'UGX', created_at: now, updated_at: now }
  let allocationRules: Record<string, unknown> = {
    id: '22222222-2222-4222-8222-222222222222', user_id: mockUser.id,
    fuel_percentage: 25, commission_percentage: 20, maintenance_percentage: 10, savings_percentage: 45,
    uber_commission_percentage: 26.53, bolt_commission_percentage: 16, safeboda_commission_percentage: 18,
    faras_commission_percentage: 10, private_commission_percentage: 0, lolo_commission_percentage: 7.41,
    littlecab_commission_percentage: 15, ridenow_commission_percentage: 15, union_commission_percentage: 15,
    other_commission_percentage: null, created_at: now, updated_at: now,
  }
  let userSettings: Record<string, unknown> = { user_id: mockUser.id, selected_platform: 'uber', created_at: now, updated_at: now }
  const context = page.context()

  if (!options.allowServiceWorker) {
    await context.addInitScript(() => {
      if (!('serviceWorker' in navigator)) return
      Object.defineProperty(navigator.serviceWorker, 'register', {
        configurable: true,
        value: () => Promise.reject(new Error('Service worker disabled for intercepted auth tests.')),
      })
    })
  }

  await context.route('**/auth/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
    }
    const respond = (body: unknown, status = 200, headers: Record<string, string> = {}) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { ...corsHeaders, ...headers },
      body: JSON.stringify(body),
    })

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' })
      return
    }

    if (url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password') {
      const body = request.postDataJSON() as { email?: string; password?: string }
      if (body.password === 'wrong-password') {
        await respond({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 400, { 'x-supabase-api-version': '2024-01-01' })
      } else {
        await respond(mockSession)
      }
      return
    }

    if (url.pathname.endsWith('/signup')) {
      const body = request.postDataJSON() as { email?: string; data?: { full_name?: string } }
      state.signupEmail = body.email ?? null
      state.signupFullName = body.data?.full_name ?? null
      state.signupRedirect = url.searchParams.get('redirect_to')
      await respond({ user: { ...mockUser, email_confirmed_at: null, confirmed_at: null }, session: null })
      return
    }

    if (url.pathname.endsWith('/recover')) {
      const body = request.postDataJSON() as { email?: string }
      state.recoveryEmail = body.email ?? null
      state.recoveryRedirect = url.searchParams.get('redirect_to')
      await respond({})
      return
    }

    if (url.pathname.endsWith('/user') && method === 'PUT') {
      const body = request.postDataJSON() as { password?: string }
      state.passwordUpdated = typeof body.password === 'string' && body.password.length > 0
      await respond({ user: mockUser })
      return
    }

    if (url.pathname.endsWith('/user') && method === 'GET') {
      await respond({ user: mockUser })
      return
    }

    if (url.pathname.endsWith('/logout')) {
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname.endsWith('/settings')) {
      await respond({ disable_signup: false, mailer_autoconfirm: false, external: { email: true } })
      return
    }

    await respond({ message: 'Unhandled mocked auth route' }, 404)
  })

  await context.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const table = url.pathname.split('/').pop()
    const method = request.method()
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, prefer, range, x-client-info',
      'access-control-expose-headers': 'content-range',
      'content-range': '0-0/*',
    }
    const wantsObject = request.headers()['accept']?.includes('application/vnd.pgrst.object+json') ?? false
    const respond = (rows: Array<Record<string, unknown>>, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(wantsObject ? rows[0] : rows),
    })
    const match = (row: Record<string, unknown>, key: string) => {
      const filter = url.searchParams.get(key)
      return !filter || row[key] === filter.replace(/^eq\./, '')
    }

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' })
      return
    }

    if (method === 'GET') {
      if (table === 'profiles') return respond([profile].filter((row) => match(row, 'id')))
      if (table === 'transactions') {
        let rows = state.transactions.filter((row) => match(row, 'user_id') && match(row, 'id'))
        const ids = url.searchParams.get('id')
        if (ids?.startsWith('in.(')) {
          const allowed = new Set(ids.slice(4, -1).split(','))
          rows = rows.filter((row) => allowed.has(String(row.id)))
        }
        return respond(rows.sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date))))
      }
      if (table === 'allocation_rules') return respond([allocationRules].filter((row) => match(row, 'user_id')))
      if (table === 'user_settings') return respond([userSettings].filter((row) => match(row, 'user_id')))
    }

    const body = request.postDataJSON() as Record<string, unknown> | Array<Record<string, unknown>>
    const inputRows = Array.isArray(body) ? body : [body]
    if (method === 'POST' && table === 'transactions') {
      for (const row of inputRows) {
        const index = state.transactions.findIndex((item) => item.id === row.id)
        if (index === -1) state.transactions.push(row)
      }
      return respond(inputRows, 201)
    }
    if (method === 'PATCH' && table === 'profiles') {
      profile = { ...profile, ...inputRows[0], updated_at: new Date().toISOString() }
      return respond([profile])
    }
    if (method === 'PATCH' && table === 'transactions') {
      const updated: Array<Record<string, unknown>> = []
      state.transactions = state.transactions.map((row) => {
        if (!match(row, 'id') || !match(row, 'user_id')) return row
        const next = { ...row, ...inputRows[0], updated_at: new Date().toISOString() }
        updated.push(next)
        return next
      })
      return respond(updated)
    }
    if (method === 'DELETE' && table === 'transactions') {
      state.transactions = state.transactions.filter((row) => !match(row, 'id') || !match(row, 'user_id'))
      return respond([])
    }
    if (method === 'POST' && table === 'allocation_rules') {
      allocationRules = { ...allocationRules, ...inputRows[0], updated_at: new Date().toISOString() }
      return respond([allocationRules], 201)
    }
    if (method === 'DELETE' && table === 'allocation_rules') {
      allocationRules = {}
      return respond([])
    }
    if (method === 'POST' && table === 'user_settings') {
      userSettings = { ...userSettings, ...inputRows[0], updated_at: new Date().toISOString() }
      return respond([userSettings], 201)
    }

    await route.fulfill({ status: 404, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({ message: 'Unhandled mocked database route' }) })
  })

  await context.route('**/storage/v1/**', async (route) => {
    const request = route.request()
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, cache-control, content-type, x-client-info, x-upsert',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders, body: '' })
    if (request.method() === 'POST' || request.method() === 'PUT') {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify({ Key: 'driveplan-avatars/11111111-1111-4111-8111-111111111111/avatar' }) })
    }
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'image/png', headers: corsHeaders, body: Buffer.from('mock-avatar') })
    }
    return route.fulfill({ status: 204, headers: corsHeaders, body: '' })
  })

  return state
}

export async function signIn(page: Page) {
  await page.getByLabel('Email address').fill(AUTH_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(AUTH_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)\./ })).toBeVisible()
}

export function recoveryCallbackUrl(baseURL = 'http://127.0.0.1:4173') {
  return `${baseURL}/?auth=recovery#access_token=${ACCESS_TOKEN}&expires_at=4102444800&expires_in=3600&refresh_token=${REFRESH_TOKEN}&token_type=bearer&type=recovery`
}

export function verificationCallbackUrl(baseURL = 'http://127.0.0.1:4173') {
  return `${baseURL}/?auth=verified#access_token=${ACCESS_TOKEN}&expires_at=4102444800&expires_in=3600&refresh_token=${REFRESH_TOKEN}&token_type=bearer&type=signup`
}
