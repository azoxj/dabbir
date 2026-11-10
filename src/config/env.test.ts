import { describe, expect, it, vi } from 'vitest'
import { isSecretKey, resolveConfig } from './env'

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.sig`

describe('resolveConfig', () => {
  it('falls back to demo when not configured', () => {
    expect(resolveConfig({}).mode).toBe('demo')
    expect(resolveConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' }).mode).toBe('demo')
  })
  it('accepts a public anon / publishable key', () => {
    expect(resolveConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) }))
      .toMatchObject({ mode: 'supabase', supabaseUrl: 'https://x.supabase.co' })
    expect(resolveConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc' }).mode).toBe('supabase')
  })
  it('REFUSES service_role and secret keys in the browser', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const svc = jwt({ role: 'service_role' })
    const r1 = resolveConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: svc })
    expect(r1.mode).toBe('demo')
    expect(r1.supabaseAnonKey).toBeNull()
    expect(resolveConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_secret_123' }).mode).toBe('demo')
    // لا يُطبع المفتاح نفسه في السجل
    expect(spy.mock.calls.flat().join(' ')).not.toContain(svc)
    spy.mockRestore()
  })
  it('rejects non-https URLs except localhost', () => {
    expect(resolveConfig({ VITE_SUPABASE_URL: 'http://evil.example', VITE_SUPABASE_ANON_KEY: 'sb_publishable_a' }).mode).toBe('demo')
    expect(resolveConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'sb_publishable_a' }).mode).toBe('supabase')
  })
  it('isSecretKey', () => {
    expect(isSecretKey(jwt({ role: 'anon' }))).toBe(false)
    expect(isSecretKey(jwt({ role: 'service_role' }))).toBe(true)
    expect(isSecretKey('sb_publishable_x')).toBe(false)
  })
})
