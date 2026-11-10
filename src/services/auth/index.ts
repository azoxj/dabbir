import { appConfig } from '@/config/env'
import { createDemoAuth } from './demoAuth'
import { createSupabaseAuth } from './supabaseAuth'
import type { AuthService } from './types'

export type DemoCapableAuth = AuthService & { signInAsGuest?: () => Promise<void> }

export function createAuthService(): DemoCapableAuth {
  return appConfig.mode === 'supabase' ? createSupabaseAuth() : createDemoAuth()
}

export * from './types'
