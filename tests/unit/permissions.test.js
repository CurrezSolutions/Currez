import { describe, it, expect } from 'vitest'
import { getModulePermission, canViewModule, canEditModule, PERMISSION_LEVELS } from '../../src/utils/permissions.js'
import { ROLES } from '../../src/utils/roles.js'

describe('utils/permissions.js', () => {
  it('grants full access when there is no user doc at all', () => {
    expect(getModulePermission(null, 'patients')).toBe(PERMISSION_LEVELS.EDIT)
  })

  it('always grants Hospital Admin and Super Admin full access, ignoring any permissions map', () => {
    expect(
      getModulePermission({ role: ROLES.HOSPITAL_ADMIN, permissions: { patients: 'none' } }, 'patients')
    ).toBe(PERMISSION_LEVELS.EDIT)
    expect(
      getModulePermission({ role: ROLES.SUPERADMIN, permissions: { patients: 'none' } }, 'patients')
    ).toBe(PERMISSION_LEVELS.EDIT)
  })

  it('honors an explicit per-module permission for a Doctor/Receptionist', () => {
    const doc = { role: ROLES.RECEPTIONIST, permissions: { patients: 'view' } }
    expect(getModulePermission(doc, 'patients')).toBe(PERMISSION_LEVELS.VIEW)
  })

  it('defaults to full access when a module has no explicit permission set', () => {
    expect(getModulePermission({ role: ROLES.DOCTOR }, 'appointments')).toBe(PERMISSION_LEVELS.EDIT)
  })

  it('falls back to the legacy billingAccess flag only for the billing module', () => {
    const doc = { role: ROLES.RECEPTIONIST, billingAccess: false }
    expect(getModulePermission(doc, 'billing')).toBe(PERMISSION_LEVELS.NONE)
    expect(getModulePermission(doc, 'patients')).toBe(PERMISSION_LEVELS.EDIT)
  })

  it('lets an explicit permissions.billing entry override the legacy billingAccess flag', () => {
    const doc = { role: ROLES.RECEPTIONIST, billingAccess: false, permissions: { billing: 'edit' } }
    expect(getModulePermission(doc, 'billing')).toBe(PERMISSION_LEVELS.EDIT)
  })

  it('canViewModule/canEditModule derive correctly from the resolved permission level', () => {
    const blocked = { role: ROLES.RECEPTIONIST, permissions: { patients: 'none' } }
    const viewOnly = { role: ROLES.RECEPTIONIST, permissions: { patients: 'view' } }
    expect(canViewModule(blocked, 'patients')).toBe(false)
    expect(canViewModule(viewOnly, 'patients')).toBe(true)
    expect(canEditModule(viewOnly, 'patients')).toBe(false)
    expect(canEditModule({ role: ROLES.HOSPITAL_ADMIN }, 'patients')).toBe(true)
  })
})
