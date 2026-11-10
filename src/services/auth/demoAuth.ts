/**
 * مصادقة تجريبية محلية — تعمل فقط عند عدم إعداد Supabase.
 * البيانات تُحفظ في localStorage لهذا المتصفح فقط وليست بديلًا آمنًا عن خادم مصادقة حقيقي.
 * كلمات المرور لا تُخزَّن كنص: PBKDF2-SHA256 مع salt عشوائي.
 */
import { AppError } from '@/services/errors'
import type { AuthEvent, AuthService, AuthUser } from './types'

const USERS_KEY = 'dabbir.demo.users'
const SESSION_KEY = 'dabbir.demo.session'
const RECOVERY_KEY = 'dabbir.demo.recovery'
export const DEMO_GUEST_EMAIL = 'demo@dabbir.local'
export const DEMO_GUEST_PASSWORD = 'demo12345'

interface StoredUser {
  id: string
  email: string
  displayName: string
  salt: string
  hash: string
}

const enc = new TextEncoder()
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256)
  return toHex(bits)
}

function readUsers(storage: Storage): Record<string, StoredUser> {
  try {
    return JSON.parse(storage.getItem(USERS_KEY) || '{}')
  } catch {
    return {}
  }
}

const toAuthUser = (u: StoredUser): AuthUser => ({ id: u.id, email: u.email, displayName: u.displayName, provider: 'demo' })

export function createDemoAuth(storage: Storage = window.localStorage, session: Storage = window.sessionStorage): AuthService & {
  signInAsGuest(): Promise<void>
} {
  const listeners = new Set<(u: AuthUser | null, e: AuthEvent) => void>()
  const emit = (u: AuthUser | null, e: AuthEvent) => listeners.forEach((l) => l(u, e))
  const writeUsers = (users: Record<string, StoredUser>) => storage.setItem(USERS_KEY, JSON.stringify(users))
  const current = (): StoredUser | null => {
    const id = storage.getItem(SESSION_KEY)
    return id ? Object.values(readUsers(storage)).find((u) => u.id === id) ?? null : null
  }

  async function createUser(email: string, password: string, displayName: string): Promise<StoredUser> {
    const users = readUsers(storage)
    const key = email.trim().toLowerCase()
    if (users[key]) throw new AppError('user_already_exists', 'هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.')
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
    const user: StoredUser = { id: crypto.randomUUID(), email: key, displayName: displayName.trim() || key.split('@')[0]!, salt, hash: await hashPassword(password, salt) }
    users[key] = user
    writeUsers(users)
    return user
  }

  async function signIn(email: string, password: string) {
    const user = readUsers(storage)[email.trim().toLowerCase()]
    // نفس الرسالة للبريد غير الموجود ولكلمة المرور الخاطئة.
    if (!user || (await hashPassword(password, user.salt)) !== user.hash) {
      throw new AppError('invalid_credentials', 'البريد أو كلمة المرور غير صحيحة.')
    }
    storage.setItem(SESSION_KEY, user.id)
    emit(toAuthUser(user), 'SIGNED_IN')
  }

  return {
    mode: 'demo',
    supportsGoogle: false,
    async getCurrentUser() {
      const u = current()
      return u ? toAuthUser(u) : null
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    signIn,
    async signUp(email, password, displayName) {
      const user = await createUser(email, password, displayName)
      storage.setItem(SESSION_KEY, user.id)
      emit(toAuthUser(user), 'SIGNED_IN')
      return { needsEmailConfirmation: false }
    },
    async signInWithGoogle() {
      throw new AppError('provider_disabled', 'الدخول عبر Google يحتاج ربط Supabase. غير متاح في الوضع التجريبي.')
    },
    async sendPasswordReset(email) {
      // لا يوجد بريد في الوضع التجريبي: نفتح جلسة استعادة محلية إذا كان الحساب موجودًا.
      const user = readUsers(storage)[email.trim().toLowerCase()]
      if (user) {
        session.setItem(RECOVERY_KEY, user.id)
        storage.setItem(SESSION_KEY, user.id)
        emit(toAuthUser(user), 'PASSWORD_RECOVERY')
      }
    },
    async updatePassword(newPassword) {
      const u = current()
      if (!u) throw new AppError('session_not_found', 'انتهت الجلسة. سجّل دخولك مرة ثانية.')
      const users = readUsers(storage)
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
      users[u.email] = { ...u, salt, hash: await hashPassword(newPassword, salt) }
      writeUsers(users)
      session.removeItem(RECOVERY_KEY)
      emit(toAuthUser(u), 'USER_UPDATED')
    },
    async signOut() {
      storage.removeItem(SESSION_KEY)
      session.removeItem(RECOVERY_KEY)
      emit(null, 'SIGNED_OUT')
    },
    async signInAsGuest() {
      if (!readUsers(storage)[DEMO_GUEST_EMAIL]) await createUser(DEMO_GUEST_EMAIL, DEMO_GUEST_PASSWORD, 'ضيف دبّر')
      await signIn(DEMO_GUEST_EMAIL, DEMO_GUEST_PASSWORD)
    },
  }
}
