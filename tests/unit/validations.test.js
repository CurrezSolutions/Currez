import { describe, it, expect } from 'vitest'
import { validators } from '../../src/utils/validations.js'

describe('utils/validations.js', () => {
  it('required flags empty/whitespace-only/missing values', () => {
    const rule = validators.required('required')
    expect(rule('')).toBe('required')
    expect(rule('   ')).toBe('required')
    expect(rule(undefined)).toBe('required')
    expect(rule(null)).toBe('required')
    expect(rule('x')).toBeUndefined()
  })

  it('email validates basic shape, only when a value is present', () => {
    const rule = validators.email('bad email')
    expect(rule('')).toBeUndefined()
    expect(rule('not-an-email')).toBe('bad email')
    expect(rule('a@b.com')).toBeUndefined()
  })

  it('minLength/maxLength bound length, only when a value is present', () => {
    expect(validators.minLength(5, 'short')('ab')).toBe('short')
    expect(validators.minLength(5, 'short')('abcde')).toBeUndefined()
    expect(validators.minLength(5, 'short')('')).toBeUndefined()
    expect(validators.maxLength(3, 'long')('abcd')).toBe('long')
    expect(validators.maxLength(3, 'long')('abc')).toBeUndefined()
  })

  it('slug only accepts lowercase-hyphenated tokens', () => {
    const rule = validators.slug('bad slug')
    expect(rule('apollo-hospital')).toBeUndefined()
    expect(rule('Apollo Hospital')).toBe('bad slug')
    expect(rule('apollo--hospital')).toBe('bad slug')
  })

  it('url only accepts http/https, rejecting javascript: and other schemes', () => {
    const rule = validators.url('bad url')
    expect(rule('')).toBeUndefined()
    expect(rule('https://example.com')).toBeUndefined()
    expect(rule('http://example.com')).toBeUndefined()
    expect(rule('javascript:alert(1)')).toBe('bad url')
    expect(rule('not a url')).toBe('bad url')
  })

  it('number rejects negative/non-numeric values but allows an empty value', () => {
    const rule = validators.number('bad number')
    expect(rule('')).toBeUndefined()
    expect(rule('-1')).toBe('bad number')
    expect(rule('abc')).toBe('bad number')
    expect(rule('5')).toBeUndefined()
  })
})
