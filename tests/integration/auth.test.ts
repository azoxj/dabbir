/** المصادقة على Supabase حقيقي محلي: التسجيل، تأكيد البريد، الدخول، الاستعادة، الجلسات، الخروج. */
import { describe, expect, it } from 'vitest'
import { device, followVerifyLink, PASSWORD, uniqueEmail, waitForMailLink } from './helpers'

describe('sign up + email confirmation', () => {
  it('no session before confirmation; login refused with email_not_confirmed; works after the email link', async () => {
    const email = uniqueEmail('signup')
    const sb = device()
    const { data, error } = await sb.auth.signUp({ email, password: PASSWORD, options: { emailRedirectTo: 'http://localhost:4180/dabbir/' } })
    expect(error).toBeNull()
    expect(data.session).toBeNull()

    const before = await sb.auth.signInWithPassword({ email, password: PASSWORD })
    expect(before.error?.code).toBe('email_not_confirmed')

    const link = await waitForMailLink(email)
    const { location, params } = await followVerifyLink(link)
    expect(location.startsWith('http://localhost:4180/dabbir/')).toBe(true)
    expect(params.get('access_token')).toBeTruthy()
    expect(params.get('type')).toBe('signup')

    const after = await sb.auth.signInWithPassword({ email, password: PASSWORD })
    expect(after.error).toBeNull()
    const { data: profile } = await sb.from('profiles').select('id, show_hijri, alert_days').single()
    expect(profile).toMatchObject({ id: after.data.user!.id, show_hijri: true, alert_days: 3 })
  })

  it('resend confirmation: throttled immediately (429), then sends a new working link', async () => {
    const email = uniqueEmail('resend')
    const sb = device()
    await sb.auth.signUp({ email, password: PASSWORD })
    const tooSoon = await sb.auth.resend({ type: 'signup', email })
    expect(tooSoon.error?.code).toBe('over_email_send_rate_limit')
    const t = Date.now()
    await new Promise((r) => setTimeout(r, 6000))
    const { error } = await sb.auth.resend({ type: 'signup', email })
    expect(error).toBeNull()
    const link = await waitForMailLink(email, { after: t })
    expect((await followVerifyLink(link)).params.get('access_token')).toBeTruthy()
  })

  it('a used/invalid confirmation link redirects back with an error code', async () => {
    const email = uniqueEmail('reuse')
    const sb = device()
    await sb.auth.signUp({ email, password: PASSWORD })
    const link = await waitForMailLink(email)
    await followVerifyLink(link)
    const again = await followVerifyLink(link)
    expect(again.params.get('error_code') ?? new URL(again.location).searchParams.get('error_code')).toBeTruthy()
  })

  it('wrong password and unknown email give the same error', async () => {
    const sb = device()
    const a = await sb.auth.signInWithPassword({ email: uniqueEmail('nobody'), password: PASSWORD })
    expect(a.error?.code).toBe('invalid_credentials')
  })

  it('rejects passwords shorter than 8 characters', async () => {
    const { error } = await device().auth.signUp({ email: uniqueEmail('weak'), password: 'a1' })
    expect(error?.code).toBe('weak_password')
  })
})

describe('password recovery', () => {
  it('reset email → recovery session → new password works, old one does not', async () => {
    const email = uniqueEmail('reset')
    const sb = device()
    await sb.auth.signUp({ email, password: PASSWORD })
    await followVerifyLink(await waitForMailLink(email))

    const t = Date.now()
    await new Promise((r) => setTimeout(r, 1100))
    const { error } = await device().auth.resetPasswordForEmail(email, { redirectTo: 'http://localhost:4180/dabbir/reset-password' })
    expect(error).toBeNull()
    const { location, params } = await followVerifyLink(await waitForMailLink(email, { after: t }))
    expect(location.startsWith('http://localhost:4180/dabbir/reset-password')).toBe(true)
    expect(params.get('type')).toBe('recovery')

    const recovering = device()
    await recovering.auth.setSession({ access_token: params.get('access_token')!, refresh_token: params.get('refresh_token')! })
    const upd = await recovering.auth.updateUser({ password: 'NewPass5678' })
    expect(upd.error).toBeNull()

    expect((await device().auth.signInWithPassword({ email, password: PASSWORD })).error?.code).toBe('invalid_credentials')
    expect((await device().auth.signInWithPassword({ email, password: 'NewPass5678' })).error).toBeNull()
  })

  it('does not reveal whether an email is registered', async () => {
    const { error } = await device().auth.resetPasswordForEmail(uniqueEmail('ghost'))
    expect(error).toBeNull()
  })
})

describe('sessions', () => {
  async function loggedIn() {
    const email = uniqueEmail('sess')
    const a = device()
    await a.auth.signUp({ email, password: PASSWORD })
    await followVerifyLink(await waitForMailLink(email))
    await a.auth.signInWithPassword({ email, password: PASSWORD })
    return { email, a }
  }

  it('refreshes the session (new access token) and keeps working', async () => {
    const { a } = await loggedIn()
    const s1 = (await a.auth.getSession()).data.session!
    await new Promise((r) => setTimeout(r, 1100))
    const { data, error } = await a.auth.refreshSession()
    expect(error).toBeNull()
    expect(data.session!.access_token).not.toBe(s1.access_token)
    expect((await a.from('profiles').select('id').single()).error).toBeNull()
  })

  it('sign out (this device) revokes its refresh token', async () => {
    const { a } = await loggedIn()
    const refresh = (await a.auth.getSession()).data.session!.refresh_token
    await a.auth.signOut({ scope: 'local' })
    const reuse = await device().auth.refreshSession({ refresh_token: refresh })
    expect(reuse.error).not.toBeNull()
  })

  it('sign out everywhere ends sessions on other devices too', async () => {
    const { email, a } = await loggedIn()
    const b = device()
    await b.auth.signInWithPassword({ email, password: PASSWORD })
    const bRefresh = (await b.auth.getSession()).data.session!.refresh_token
    await a.auth.signOut({ scope: 'global' })
    const res = await device().auth.refreshSession({ refresh_token: bRefresh })
    expect(res.error).not.toBeNull()
  })
})
