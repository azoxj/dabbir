import { appConfig } from '@/config/env'
import { getRuntimeMode } from '@/config/mode'
import { getSupabase } from '@/services/supabaseClient'

export type PushSetupResult = 'subscribed' | 'unsubscribed'
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window
}
function vapidBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '='))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
function endpoint() {
  if (!appConfig.supabaseUrl) throw new Error('Supabase غير مهيأ')
  return appConfig.supabaseUrl + '/functions/v1/dabbir-push'
}
export async function subscribeToReminders(): Promise<PushSetupResult> {
  if (getRuntimeMode() !== 'supabase') throw new Error('الإشعارات تتطلب حسابًا حقيقيًا')
  if (!pushSupported()) throw new Error('الإشعارات غير مدعومة. على الآيفون ثبّت دبّر على الشاشة الرئيسية.')
  const sb = getSupabase()
  const { data: auth, error: authError } = await sb.auth.getUser()
  if (authError || !auth.user) throw new Error('سجّل الدخول لتفعيل الإشعارات')
  const response = await fetch(endpoint(), { method: 'GET' })
  if (!response.ok) throw new Error('خدمة الإشعارات غير مهيأة بعد')
  const { publicKey } = await response.json() as { publicKey?: string }
  if (!publicKey) throw new Error('مفتاح الإشعارات غير مهيأ بعد')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('لم يتم السماح بالإشعارات')
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (subscription && subscription.options.applicationServerKey) {
    const activeKey = new Uint8Array(subscription.options.applicationServerKey)
    const configured = vapidBytes(publicKey)
    if (activeKey.length !== configured.length || activeKey.some((b, i) => b !== configured[i])) {
      await subscription.unsubscribe()
      subscription = null
    }
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(publicKey) })
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('اشتراك الجهاز غير صالح')
  const { error } = await sb.from('push_subscriptions').upsert({
    user_id: auth.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' })
  if (error) throw new Error('تعذّر حفظ اشتراك الجهاز: ' + error.message)
  return 'subscribed'
}
export async function unsubscribeFromReminders(): Promise<PushSetupResult> {
  if (!pushSupported() || getRuntimeMode() !== 'supabase') throw new Error('الإشعارات غير متاحة')
  const sb = getSupabase()
  const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
  if (subscription) {
    const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    if (error) throw new Error('تعذّر إيقاف الاشتراك: ' + error.message)
    await subscription.unsubscribe()
  }
  return 'unsubscribed'
}
