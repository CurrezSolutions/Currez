import { describe, it, expect } from 'vitest'
import { generateToken } from '../../src/utils/appointmentToken.js'

describe('utils/appointmentToken.js', () => {
  it('generates a token in APT-XXXX-XXXX format using only visually unambiguous characters', () => {
    const token = generateToken()
    expect(token).toMatch(/^APT-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/)
  })

  it('never includes 0/O or 1/I, which patients could misread over the phone', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateToken()).not.toMatch(/[01OI]/)
    }
  })

  it('generates distinct tokens across many calls', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()))
    expect(tokens.size).toBe(200)
  })
})
