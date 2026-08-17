import { describe, expect, it } from 'vitest'
import {
  getAuthErrorMessage,
  normalizeEmail,
  normalizeFullName,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
} from './authValidation'

describe('auth validation', () => {
  it('normalizes email and full name values', () => {
    expect(normalizeEmail('  DRIVER@Example.COM ')).toBe('driver@example.com')
    expect(normalizeFullName('  Vannet   Airtel  ')).toBe('Vannet Airtel')
  })

  it('validates full names and email addresses', () => {
    expect(validateFullName('')).toBe('Enter your full name.')
    expect(validateFullName('A')).toContain('at least 2')
    expect(validateFullName('A'.repeat(81))).toContain('80 characters')
    expect(validateFullName('Vannet Airtel')).toBeNull()
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.')
    expect(validateEmail('driver@example.com')).toBeNull()
  })

  it('requires a practical password and an exact confirmation', () => {
    expect(validatePassword('short1')).toContain('at least 8')
    expect(validatePassword('allletters')).toContain('letter and one number')
    expect(validatePassword('12345678')).toContain('letter and one number')
    expect(validatePassword('RoadPlan9')).toBeNull()
    expect(validatePasswordConfirmation('RoadPlan9', 'RoadPlan8')).toBe('Passwords do not match.')
    expect(validatePasswordConfirmation('RoadPlan9', 'RoadPlan9')).toBeNull()
  })

  it('maps backend failures to safe user-facing messages', () => {
    expect(getAuthErrorMessage({ code: 'invalid_credentials' })).toBe('The email or password is incorrect.')
    expect(getAuthErrorMessage({ code: 'email_not_confirmed' })).toBe('Verify your email before signing in.')
    expect(getAuthErrorMessage({ code: 'over_email_send_rate_limit', status: 429 })).toContain('Wait a few minutes')
    expect(getAuthErrorMessage(new Error('Failed to fetch'))).toContain('Check your connection')
    expect(getAuthErrorMessage(new Error('internal implementation detail'))).toBe('Something went wrong. Please try again.')
  })
})
