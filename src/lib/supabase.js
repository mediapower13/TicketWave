import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      fetch: async (url, options = {}) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout
        try {
          const response = await fetch(url, { ...options, signal: controller.signal })
          return response
        } catch (err) {
          if (err.name === 'AbortError') {
            throw new Error('Request timed out. Please check your internet connection and try again.')
          }
          if (!navigator.onLine) {
            throw new Error('No internet connection. Please check your network and try again.')
          }
          throw new Error('Network error: Unable to reach the server. Please try again.')
        } finally {
          clearTimeout(timeout)
        }
      },
    },
  }
)

// Wake up the Supabase project on app load (free tier may be sleeping)
export const wakeUpSupabase = async () => {
  try {
    await supabase.from('profiles').select('id').limit(1)
  } catch {
    // Silently fail — just warming up
  }
}
