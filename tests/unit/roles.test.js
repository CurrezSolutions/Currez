import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('utils/roles.js', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('exposes the expected role constants and labels', async () => {
    const { ROLES, ROLE_LABELS, CREATABLE_STAFF_ROLES, CREATABLE_STAFF_ROLES_BY_HOSPITAL_ADMIN } = await import(
      '../../src/utils/roles.js'
    )
    expect(ROLES).toEqual({
      SUPERADMIN: 'SUPERADMIN',
      HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
      RECEPTIONIST: 'RECEPTIONIST',
      DOCTOR: 'DOCTOR',
    })
    expect(CREATABLE_STAFF_ROLES).toContain(ROLES.HOSPITAL_ADMIN)
    // A Hospital Admin may never create another Hospital Admin — that's
    // Super-Admin-only (see firestore.rules' /users create rule and
    // tests/rules/users-staff.test.js's escalation test).
    expect(CREATABLE_STAFF_ROLES_BY_HOSPITAL_ADMIN).not.toContain(ROLES.HOSPITAL_ADMIN)
    expect(ROLE_LABELS[ROLES.DOCTOR]).toBe('Doctor')
  })

  it('isSuperAdminEmail matches case-insensitively against VITE_SUPERADMIN_EMAILS', async () => {
    vi.stubEnv('VITE_SUPERADMIN_EMAILS', 'Super@Currez.in, other@currez.in')
    const { isSuperAdminEmail } = await import('../../src/utils/roles.js')
    expect(isSuperAdminEmail('super@currez.in')).toBe(true)
    expect(isSuperAdminEmail('SUPER@CURREZ.IN')).toBe(true)
    expect(isSuperAdminEmail('nope@currez.in')).toBe(false)
  })

  it('isSuperAdminEmail returns false for empty/missing input, even with a configured list', async () => {
    vi.stubEnv('VITE_SUPERADMIN_EMAILS', 'super@currez.in')
    const { isSuperAdminEmail } = await import('../../src/utils/roles.js')
    expect(isSuperAdminEmail('')).toBe(false)
    expect(isSuperAdminEmail(null)).toBe(false)
    expect(isSuperAdminEmail(undefined)).toBe(false)
  })
})
