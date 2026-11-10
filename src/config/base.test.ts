import { describe, expect, it } from 'vitest'
import { detectBase } from './base'

describe('runtime base path', () => {
  it('old GitHub Pages address keeps /dabbir/', () => {
    for (const p of ['/dabbir', '/dabbir/', '/dabbir/budget', '/dabbir/reset-password']) expect(detectBase(p)).toBe('/dabbir/')
  })
  it('custom domain uses the root', () => {
    for (const p of ['/', '/budget', '/login', '/dabbirx', '/reports']) expect(detectBase(p)).toBe('/')
  })
})
