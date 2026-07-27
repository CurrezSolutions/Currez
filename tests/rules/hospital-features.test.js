import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

// Covers /hospitalFeatures — the per-hospital module toggles a Super Admin
// sets from FeatureManagementPanel (src/config/featureRegistry.js,
// src/firebase/hospitalFeatures.js). Unlike hospitalLimits, this one is
// deliberately staff-only (not public) — the public booking flow never
// needs to know which optional modules are on.
describe('firestore.rules: hospitalFeatures (module: Modules)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-hospital-features')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it("lets a hospital's own staff read its feature flags", async () => {
    await seedDocs(testEnv, [
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
      ['hospitalFeatures/apollo', { hospitalId: 'apollo', features: { billing: true } }],
    ])
    const db = dbAs(testEnv, 'recep-1', {})
    await assertSucceeds(getDoc(doc(db, 'hospitalFeatures/apollo')))
  })

  it('blocks an unauthenticated visitor and staff of a different hospital from reading feature flags', async () => {
    await seedDocs(testEnv, [
      ['users/recep-2', userDoc({ role: 'RECEPTIONIST', hospitalId: 'other-hospital' })],
      ['hospitalFeatures/apollo', { hospitalId: 'apollo', features: { billing: true } }],
    ])
    await assertFails(getDoc(doc(dbPublic(testEnv), 'hospitalFeatures/apollo')))
    await assertFails(getDoc(doc(dbAs(testEnv, 'recep-2', {}), 'hospitalFeatures/apollo')))
  })

  it('blocks a Hospital Admin from turning on their own modules (Super Admin-only)', async () => {
    await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'admin-1', {})
    await assertFails(setDoc(doc(db, 'hospitalFeatures/apollo'), { features: { billing: true } }))
  })

  it('lets a superadmin create and update feature flags', async () => {
    await seedDocs(testEnv, [['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })]])
    const db = dbAs(testEnv, 'super-1', {})
    await assertSucceeds(setDoc(doc(db, 'hospitalFeatures/apollo'), { hospitalId: 'apollo', features: { billing: true } }))
    await assertSucceeds(updateDoc(doc(db, 'hospitalFeatures/apollo'), { 'features.analytics': true }))
  })
})
