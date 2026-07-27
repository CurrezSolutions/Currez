import { describe, it, expect } from 'vitest'
import { generatePassword } from '../../src/utils/generatePassword.js'

describe('utils/generatePassword.js', () => {
  it('defaults to a 12-character password drawn from the expected character set', () => {
    const pw = generatePassword()
    expect(pw).toHaveLength(12)
    expect(pw).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%]+$/)
  })

  it('honors a custom length', () => {
    expect(generatePassword(20)).toHaveLength(20)
    expect(generatePassword(6)).toHaveLength(6)
  })

  it('generates distinct passwords across calls', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generatePassword()))
    expect(passwords.size).toBe(50)
  })
})
