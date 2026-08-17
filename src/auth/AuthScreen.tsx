import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import {
  getAuthErrorMessage,
  normalizeEmail,
  normalizeFullName,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
} from './authValidation'

type AuthMode = 'login' | 'signup' | 'forgot'

function AuthLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="auth-shell">
    <section className="auth-brand-panel">
      <div className="brand auth-brand"><img src="/dp-logo.png" alt="" /><span>DrivePlan</span></div>
      <div className="auth-brand-copy">
        <span className="eyebrow">Built for the road</span>
        <h1>Every trip.<br />Every shilling.<br /><em>One clear plan.</em></h1>
        <p>Your earnings remain on this device while your account keeps DrivePlan private.</p>
      </div>
      <div className="auth-security-note"><ShieldCheck size={18} /><span><strong>Secure account access</strong>Powered by Supabase Authentication</span></div>
    </section>
    <main className="auth-main">
      <section className="auth-form-panel" aria-labelledby="auth-title">
        <div className="eyebrow">{eyebrow}</div>
        <h2 id="auth-title">{title}</h2>
        <p className="auth-description">{description}</p>
        {children}
      </section>
    </main>
  </div>
}

function PasswordField({ id, label, value, onChange, autoComplete, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: 'current-password' | 'new-password'; disabled: boolean }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="auth-input-wrap">
      <LockKeyhole size={17} aria-hidden="true" />
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} disabled={disabled} required />
      <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} disabled={disabled}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </div>
  </div>
}

function EmailField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="auth-field" htmlFor="auth-email">
    <span>Email address</span>
    <div className="auth-input-wrap"><Mail size={17} aria-hidden="true" /><input id="auth-email" type="email" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="email" inputMode="email" disabled={disabled} required /></div>
  </label>
}

function AuthFeedback({ error, success }: { error: string; success?: string }) {
  if (error) return <p className="auth-feedback error" role="alert">{error}</p>
  if (success) return <p className="auth-feedback success" role="status"><CheckCircle2 size={17} />{success}</p>
  return null
}

function LoginForm({ onModeChange, initialError }: { onModeChange: (mode: AuthMode) => void; initialError: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError ?? '')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const emailError = validateEmail(email)
    if (emailError) return setError(emailError)
    if (!password) return setError('Enter your password.')

    setBusy(true)
    setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password })
    if (authError || !data.session) {
      setError(getAuthErrorMessage(authError, 'Unable to sign in. Please try again.'))
      setBusy(false)
    }
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    <EmailField value={email} onChange={setEmail} disabled={busy} />
    <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" disabled={busy} />
    <div className="auth-form-links"><button type="button" className="text-action" onClick={() => onModeChange('forgot')} disabled={busy}>Forgot password?</button></div>
    <AuthFeedback error={error} />
    <button className="primary-action auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={18} /></>}</button>
    <p className="auth-switch">Don’t have an account? <button type="button" onClick={() => onModeChange('signup')} disabled={busy}>Sign up</button></p>
  </form>
}

function SignUpForm({ onModeChange }: { onModeChange: (mode: AuthMode) => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const validationError = validateFullName(fullName) || validateEmail(email) || validatePassword(password) || validatePasswordConfirmation(password, confirmation)
    if (validationError) return setError(validationError)

    setBusy(true)
    setError('')
    setSuccess('')
    const { data, error: authError } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { full_name: normalizeFullName(fullName) },
        emailRedirectTo: `${window.location.origin}/?auth=verified`,
      },
    })

    if (authError) {
      setError(getAuthErrorMessage(authError, 'Unable to create your account. Please try again.'))
    } else if (!data.session) {
      const existingIdentity = data.user?.identities?.length === 0
      setSuccess(existingIdentity
        ? 'If an account can be created for this email, a verification message will arrive shortly. You can also try signing in.'
        : 'Account created. Check your email to verify your account before signing in.')
      setPassword('')
      setConfirmation('')
    }
    setBusy(false)
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    <label className="auth-field" htmlFor="full-name"><span>Full name</span><div className="auth-input-wrap"><input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" disabled={busy} required /></div></label>
    <EmailField value={email} onChange={setEmail} disabled={busy} />
    <PasswordField id="signup-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" disabled={busy} />
    <PasswordField id="confirm-password" label="Confirm password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" disabled={busy} />
    <p className="password-guidance">Use at least 8 characters with a letter and a number.</p>
    <AuthFeedback error={error} success={success} />
    <button className="primary-action auth-submit" type="submit" disabled={busy || Boolean(success)}>{busy ? 'Creating account…' : <>Create account <ArrowRight size={18} /></>}</button>
    <p className="auth-switch">Already have an account? <button type="button" onClick={() => onModeChange('login')} disabled={busy}>Sign in</button></p>
  </form>
}

function ForgotPasswordForm({ onModeChange }: { onModeChange: (mode: AuthMode) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const emailError = validateEmail(email)
    if (emailError) return setError(emailError)

    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${window.location.origin}/?auth=recovery`,
    })
    if (authError) setError(getAuthErrorMessage(authError, 'Unable to send the reset email. Please try again.'))
    else setSuccess('If an account exists for this email, a secure password reset link is on its way.')
    setBusy(false)
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    <EmailField value={email} onChange={setEmail} disabled={busy} />
    <AuthFeedback error={error} success={success} />
    <button className="primary-action auth-submit" type="submit" disabled={busy || Boolean(success)}>{busy ? 'Sending reset link…' : <>Send reset link <ArrowRight size={18} /></>}</button>
    <button type="button" className="auth-back" onClick={() => onModeChange('login')} disabled={busy}><ArrowLeft size={16} />Back to sign in</button>
  </form>
}

function ResetPasswordForm() {
  const { session, completePasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const validationError = validatePassword(password) || validatePasswordConfirmation(password, confirmation)
    if (validationError) return setError(validationError)
    if (!session) return setError('This secure link has expired or is invalid. Request a new password reset email.')

    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) setError(getAuthErrorMessage(authError, 'Unable to update your password. Request a new reset link and try again.'))
    else {
      setPassword('')
      setConfirmation('')
      setSuccess('Your password has been updated securely.')
    }
    setBusy(false)
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    {!session && <AuthFeedback error="This secure link has expired or is invalid. Request a new password reset email." />}
    {session && <>
      <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" disabled={busy || Boolean(success)} />
      <PasswordField id="confirm-new-password" label="Confirm new password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" disabled={busy || Boolean(success)} />
      <p className="password-guidance">Use at least 8 characters with a letter and a number.</p>
      <AuthFeedback error={error} success={success} />
      {!success && <button className="primary-action auth-submit" type="submit" disabled={busy}>{busy ? 'Updating password…' : <>Update password <ArrowRight size={18} /></>}</button>}
    </>}
    <button type="button" className={success ? 'primary-action auth-submit' : 'auth-back'} onClick={completePasswordRecovery}>{success ? <>Continue to DrivePlan <ArrowRight size={18} /></> : <><ArrowLeft size={16} />Back to sign in</>}</button>
  </form>
}

export function AuthScreen({ initializationError }: { initializationError: string | null }) {
  const { passwordRecovery } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const callbackFailed = new URLSearchParams(window.location.search).get('auth') === 'verified'
  const loginError = initializationError ?? (callbackFailed ? 'The verification link could not establish a session. It may have expired; try signing in or create a new account.' : null)

  if (passwordRecovery) return <AuthLayout eyebrow="Account recovery" title="Choose a new password" description="Set a fresh password to secure your DrivePlan account."><ResetPasswordForm /></AuthLayout>
  if (mode === 'signup') return <AuthLayout eyebrow="Create your account" title="Start with DrivePlan" description="Create one secure account for your driving plan."><SignUpForm onModeChange={setMode} /></AuthLayout>
  if (mode === 'forgot') return <AuthLayout eyebrow="Password recovery" title="Reset your password" description="We’ll email you a secure link to choose a new password."><ForgotPasswordForm onModeChange={setMode} /></AuthLayout>
  return <AuthLayout eyebrow="Welcome back" title="Sign in to DrivePlan" description="Use your verified email and password to continue."><LoginForm onModeChange={setMode} initialError={loginError} /></AuthLayout>
}

export function AuthLoading() {
  return <div className="auth-loading" role="status" aria-live="polite"><div className="brand auth-brand"><img src="/dp-logo.png" alt="" /><span>DrivePlan</span></div><div className="auth-spinner" /><p>Securing your session…</p></div>
}
