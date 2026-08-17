import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const missingVariables = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabasePublishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean)

if (missingVariables.length > 0) {
  const configurationTarget = import.meta.env.DEV
    ? 'Add them to .env.local and restart the Vite development server.'
    : 'Configure them in the deployment environment.'

  throw new Error(
    `[Supabase] Missing required environment variable(s): ${missingVariables.join(', ')}. ${configurationTarget}`,
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey)
