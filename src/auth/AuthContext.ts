import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  passwordRecovery: boolean
  initializationError: string | null
  signOut: () => Promise<string | null>
  completePasswordRecovery: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
