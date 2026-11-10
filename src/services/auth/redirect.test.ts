import { describe, expect, it } from 'vitest'
import { redirectUrl } from './supabaseAuth'

describe('auth redirect URLs respect the deploy base path', () => {
  it('GitHub Pages base /dabbir/: email confirmation, OAuth and password reset', () => {
    const o = window.location.origin
    expect(redirectUrl('/', '/dabbir/')).toBe(`${o}/dabbir/`)
    expect(redirectUrl('/reset-password', '/dabbir/')).toBe(`${o}/dabbir/reset-password`)
    expect(redirectUrl('reset-password', '/dabbir')).toBe(`${o}/dabbir/reset-password`)
  })
  it('root base (custom domain)', () => {
    expect(redirectUrl('/reset-password', '/')).toBe(`${window.location.origin}/reset-password`)
  })
  it('defaults to the build base URL', () => {
    expect(redirectUrl('/x')).toBe(`${window.location.origin}${import.meta.env.BASE_URL}x`)
  })
})
