import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { appConfig } from '@/config/env'

let client: SupabaseClient | null = null

/** عميل Supabase بالمفتاح العام فقط. الحماية الفعلية للبيانات عبر RLS في قاعدة البيانات. */
export function getSupabase(): SupabaseClient {
  if (appConfig.mode !== 'supabase' || !appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    throw new Error('Supabase is not configured')
  }
  client ??= createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // implicit: روابط البريد (التأكيد/الاستعادة) تعمل حتى لو فُتحت في متصفح آخر غير الذي طلبها.
      flowType: 'implicit',
    },
  })
  return client
}
