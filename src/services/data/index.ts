import { getRuntimeMode } from '@/config/mode'
import { getSupabase } from '@/services/supabaseClient'
import type { AuthUser } from '@/services/auth/types'
import { DEMO_GUEST_EMAIL } from '@/services/auth/demoAuth'
import { DEFAULT_PREFERENCES } from '@/types/domain'
import { createDemoRepository, type DemoState } from './demoRepository'
import { buildDemoSeed } from './demoSeed'
import { createSupabaseRepository } from './supabaseRepository'
import type { DataRepository } from './types'

export function createRepository(user: AuthUser): DataRepository {
  // حماية إضافية: حساب حقيقي لا يمكن أن يُخدم من المستودع التجريبي والعكس.
  if (getRuntimeMode() === 'supabase') {
    if (user.provider === 'demo') throw new Error('demo user in real mode')
    return createSupabaseRepository(getSupabase(), user.id)
  }
  if (user.provider !== 'demo') throw new Error('real user in demo mode')
  const isGuest = user.email === DEMO_GUEST_EMAIL
  return createDemoRepository(user.id, {
    seed: isGuest ? buildDemoSeed : (id) => ({ ...buildEmpty(id), profile: { ...buildEmpty(id).profile, displayName: user.displayName } }),
    latencyMs: 120,
  })
}

function buildEmpty(userId: string): DemoState {
  return { profile: { id: userId, displayName: null, monthlyIncome: 0, savingsTarget: 0, payday: 27, ...DEFAULT_PREFERENCES }, expenses: [], limits: [], commitments: [], goals: [] }
}

export type { DataRepository } from './types'
