import { describe, it, expect } from 'vitest'
import { LIMITS_REGISTRY, getLimitDefinition, formatLimitValue } from '../../src/config/limitsRegistry.js'

describe('config/limitsRegistry.js', () => {
  it('has a unique key and a positive integer default with presets for every registered limit', () => {
    const keys = LIMITS_REGISTRY.map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const limit of LIMITS_REGISTRY) {
      expect(Number.isInteger(limit.default)).toBe(true)
      expect(limit.default).toBeGreaterThan(0)
      expect(Array.isArray(limit.presets)).toBe(true)
      expect(limit.presets.length).toBeGreaterThan(0)
    }
  })

  it('includes the Super Admin-set staff/patient/email limit keys the app relies on', () => {
    const keys = LIMITS_REGISTRY.map((l) => l.key)
    expect(keys).toEqual(
      expect.arrayContaining(['maxDoctors', 'maxReceptionists', 'maxHospitalAdmins', 'maxPatientsPerDay', 'maxEmailsPerMonth'])
    )
  })

  it('getLimitDefinition finds a registered key and returns null for an unknown one', () => {
    expect(getLimitDefinition('maxDoctors')?.label).toBe('Doctors')
    expect(getLimitDefinition('doesNotExist')).toBeNull()
  })

  it('formatLimitValue renders "Unlimited" for null/undefined and a unit-suffixed number otherwise', () => {
    expect(formatLimitValue(null, 'patients/day')).toBe('Unlimited')
    expect(formatLimitValue(undefined, 'patients/day')).toBe('Unlimited')
    expect(formatLimitValue(60, 'patients/day')).toBe('60 patients/day')
    expect(formatLimitValue(2500)).toBe('2,500')
  })
})
