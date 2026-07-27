import { describe, it, expect } from 'vitest'
import { limitKeyForRole, countActiveStaffByRole, isAtStaffCap } from '../../src/utils/staffLimits.js'
import { ROLES } from '../../src/utils/roles.js'

describe('utils/staffLimits.js', () => {
  const staff = [
    { role: ROLES.DOCTOR, status: 'active' },
    { role: ROLES.DOCTOR, status: 'active' },
    { role: ROLES.DOCTOR, status: 'disabled' },
    { role: ROLES.RECEPTIONIST, status: 'active' },
  ]

  it('maps each creatable staff role to its plan-limit key', () => {
    expect(limitKeyForRole(ROLES.DOCTOR)).toBe('maxDoctors')
    expect(limitKeyForRole(ROLES.RECEPTIONIST)).toBe('maxReceptionists')
    expect(limitKeyForRole(ROLES.HOSPITAL_ADMIN)).toBe('maxHospitalAdmins')
    expect(limitKeyForRole(ROLES.SUPERADMIN)).toBeNull()
  })

  it('counts only active staff of a given role, ignoring deactivated ones', () => {
    expect(countActiveStaffByRole(staff, ROLES.DOCTOR)).toBe(2)
    expect(countActiveStaffByRole(staff, ROLES.RECEPTIONIST)).toBe(1)
  })

  it('is never at cap when the limit is null (Unlimited) or the limits doc is missing entirely', () => {
    expect(isAtStaffCap(staff, { maxDoctors: null }, ROLES.DOCTOR)).toBe(false)
    expect(isAtStaffCap(staff, null, ROLES.DOCTOR)).toBe(false)
    expect(isAtStaffCap(staff, undefined, ROLES.DOCTOR)).toBe(false)
  })

  it('is at cap once active headcount reaches the configured limit, not before', () => {
    expect(isAtStaffCap(staff, { maxDoctors: 2 }, ROLES.DOCTOR)).toBe(true)
    expect(isAtStaffCap(staff, { maxDoctors: 3 }, ROLES.DOCTOR)).toBe(false)
  })
})
