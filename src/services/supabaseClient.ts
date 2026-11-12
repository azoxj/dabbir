import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { appConfig } from '@/config/env'
import { getRuntimeMode } from '@/config/mode'

let client: SupabaseClient | null = null

/** عميل Supabase بالمفتاح العام فقط. الحماية الفعلية للبيانات عبر RLS في قاعدة البيانات. */
export function getSupabase(): SupabaseClient {
  // الوضع التجريبي لا يُنشئ عميل Supabase أبدًا (فصل تام عن الحسابات الحقيقية).
  if (getRuntimeMode() !== 'supabase' || !appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
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
