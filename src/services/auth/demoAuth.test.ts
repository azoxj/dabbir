import { describe, expect, it, vi } from 'vitest'
import { createDemoAuth } from './demoAuth'
import { validateEmail, validatePassword } from './types'

describe('demoAuth', () => {
  it('signs up, signs out, signs in; never stores plaintext passwords', async () => {
    const auth = createDemoAuth()
    const events: string[] = []
    auth.onAuthChange((_u, e) => events.push(e))
    await auth.signUp('Sara@Example.com', 'pass1234', 'سارة')
    expect((await auth.getCurrentUser())?.email).toBe('sara@example.com')
    expect(localStorage.getItem('dabbir.demo.users')).not.toContain('pass1234')
    await auth.signOut()
    expect(await auth.getCurrentUser()).toBeNull()
    await auth.signIn('sara@example.com', 'pass1234')
    expect((await auth.getCurrentUser())?.displayName).toBe('سارة')
    expect(events).toEqual(['SIGNED_IN', 'SIGNED_OUT', 'SIGNED_IN'])
  })

  it('same error for unknown email and wrong password', async () => {
    const auth = createDemoAuth()
    await auth.signUp('a@b.co', 'pass1234', '')
    await expect(auth.signIn('a@b.co', 'wrong999')).rejects.toMatchObject({ code: 'invalid_credentials' })
    await expect(auth.signIn('x@b.co', 'pass1234')).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('rejects duplicate accounts', async () => {
    const auth = createDemoAuth()
    await auth.signUp('a@b.co', 'pass1234', '')
    await expect(auth.signUp('A@B.co', 'pass1234', '')).rejects.toMatchObject({ code: 'user_already_exists' })
  })

  it('password recovery flow emits PASSWORD_RECOVERY then updates the password', async () => {
    const auth = createDemoAuth()
    await auth.signUp('a@b.co', 'pass1234', '')
    await auth.signOut()
    const cb = vi.fn()
    auth.onAuthChange(cb)
    await auth.sendPasswordReset('nobody@b.co') // لا يكشف عدم الوجود
    expect(cb).not.toHaveBeenCalled()
    await auth.sendPasswordReset('a@b.co')
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'a@b.co' }), 'PASSWORD_RECOVERY')
    await auth.updatePassword('newpass99')
    await auth.signOut()
    await expect(auth.signIn('a@b.co', 'pass1234')).rejects.toBeTruthy()
    await auth.signIn('a@b.co', 'newpass99')
  })

  it('google is unavailable in demo mode', async () => {
    await expect(createDemoAuth().signInWithGoogle()).rejects.toMatchObject({ code: 'provider_disabled' })
  })
})

describe('validators', () => {
  it('password policy', () => {
    expect(validatePassword('short1')).toBeTruthy()
    expect(validatePassword('abcdefgh')).toBeTruthy()
    expect(validatePassword('12345678')).toBeTruthy()
    expect(validatePassword('abcd1234')).toBeNull()
    expect(validatePassword('كلمةسر1234')).toBeNull()
  })
  it('email', () => {
    expect(validateEmail('')).toBeTruthy()
    expect(validateEmail('a@b')).toBeTruthy()
    expect(validateEmail(' a@b.co ')).toBeNull()
  })
})
