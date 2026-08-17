const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HAS_LETTER = /[A-Za-z]/
const HAS_NUMBER = /\d/

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export const normalizeFullName = (fullName: string) => fullName.trim().replace(/\s+/g, ' ')

export function validateEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(normalizedEmail)) return 'Enter a valid email address.'
  return null
}

export function validateFullName(fullName: string) {
  const normalizedFullName = normalizeFullName(fullName)
  if (!normalizedFullName) return 'Enter your full name.'
  if (normalizedFullName.length < 2) return 'Full name must be at least 2 characters.'
  if (normalizedFullName.length > 80) return 'Full name must be 80 characters or fewer.'
  return null
}

export function validatePassword(password: string) {
  if (!password) return 'Enter a password.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!HAS_LETTER.test(password) || !HAS_NUMBER.test(password)) {
    return 'Password must include at least one letter and one number.'
  }
  return null
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  if (!confirmation) return 'Confirm your password.'
  if (password !== confirmation) return 'Passwords do not match.'
  return null
}

export function getAuthErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const candidate = error as { code?: string; message?: string; status?: number } | null
  const code = candidate?.code?.toLowerCase() ?? ''
  const message = candidate?.message?.toLowerCase() ?? ''

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'The email or password is incorrect.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Verify your email before signing in.'
  }
  if (code === 'user_already_exists' || message.includes('already registered')) {
    return 'An account already exists for this email. Try signing in instead.'
  }
  if (code === 'weak_password' || message.includes('password should be') || message.includes('weak password')) {
    return 'Choose a stronger password with at least 8 characters, including a letter and a number.'
  }
  if (code === 'over_email_send_rate_limit' || candidate?.status === 429) {
    return 'Too many email requests were sent. Wait a few minutes and try again.'
  }
  if (code === 'same_password' || message.includes('same password')) {
    return 'Choose a password you have not used for this account.'
  }
  if (code.includes('session') || message.includes('session') || message.includes('expired')) {
    return 'This secure link has expired or is invalid. Request a new password reset email.'
  }
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to connect')) {
    return 'Unable to reach DrivePlan right now. Check your connection and try again.'
  }

  return fallback
}
