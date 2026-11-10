import { appConfig } from '@/config/env'
import { getSupabase } from '@/services/supabaseClient'
import type { AuthUser } from '@/services/auth/types'
import { DEMO_GUEST_EMAIL } from '@/services/auth/demoAuth'
import { createDemoRepository } from './demoRepository'
import { buildDemoSeed } from './demoSeed'
import { createSupabaseRepository } from './supabaseRepository'
import type { DataRepository } from './types'

export function createRepository(user: AuthUser): DataRepository {
  if (appConfig.mode === 'supabase') return createSupabaseRepository(getSupabase(), user.id)
  const isGuest = user.email === DEMO_GUEST_EMAIL
  return createDemoRepository(user.id, {
    seed: isGuest ? buildDemoSeed : (id) => ({ ...buildEmpty(id), profile: { ...buildEmpty(id).profile, displayName: user.displayName } }),
    latencyMs: 120,
  })
}

function buildEmpty(userId: string) {
  return { profile: { id: userId, displayName: null, monthlyIncome: 0, savingsTarget: 0, payday: 27 }, expenses: [], limits: [], commitments: [], goals: [] }
}

export type { DataRepository } from './types'
