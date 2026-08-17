import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'
import { getAuthErrorMessage } from './authValidation'

function isRecoveryCallback() {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('auth') === 'recovery' || hash.get('type') === 'recovery'
}

function removeSensitiveAuthParams() {
  const url = new URL(window.location.href)
  const hadHash = Boolean(url.hash)
  const completedVerification = url.searchParams.get('auth') === 'verified'
  if (!hadHash && !completedVerification) return

  url.hash = ''
  if (completedVerification) url.searchParams.delete('auth')
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(isRecoveryCallback)
  const [initializationError, setInitializationError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setInitializationError(null)

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        removeSensitiveAuthParams()
      } else if (event === 'SIGNED_IN') {
        removeSensitiveAuthParams()
      } else if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false)
      }
    })

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        setSession(null)
        setInitializationError(getAuthErrorMessage(error, 'Your session could not be restored. Please sign in again.'))
      } else {
        setSession(data.session)
        if (data.session) removeSensitiveAuthParams()
      }
      setLoading(false)
    }

    void restoreSession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    passwordRecovery,
    initializationError,
    async signOut() {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      return error ? getAuthErrorMessage(error, 'Unable to sign out. Please try again.') : null
    },
    completePasswordRecovery() {
      setPasswordRecovery(false)
      const url = new URL(window.location.href)
      url.searchParams.delete('auth')
      url.hash = ''
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}`)
    },
  }), [initializationError, loading, passwordRecovery, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
