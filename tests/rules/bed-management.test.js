import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

// Covers /bedConfig, /admissions and /bedLocks (module: Beds & Wards,
// src/config/featureRegistry.js key 'bedManagement'). Notable quirks in this
// module, called out in firestore.rules' own comments: bedConfig writes are
// Hospital-Admin-only (not any staff with module access, unlike admissions),
// and admission records can never be deleted by anyone, superadmin included.
describe('firestore.rules: bed management (module: Beds & Wards)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-bed-management')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  async function seedBedManagementEnabledHospital() {
    await seedDocs(testEnv, [
      ['hospitalFeatures/apollo', { hospitalId: 'apollo', features: { bedManagement: true } }],
    ])
  }

  describe('bedConfig', () => {
    it('blocks reading bed config if the bedManagement feature is not enabled, even for the hospital\'s own admin', async () => {
      await seedDocs(testEnv, [
        ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
        ['bedConfig/apollo', { floors: [] }],
      ])
      const db = dbAs(testEnv, 'admin-1', {})
      await assertFails(getDoc(doc(db, 'bedConfig/apollo')))
    })

    it("lets the hospital's own staff read bed config once the feature is enabled", async () => {
      await seedBedManagementEnabledHospital()
      await seedDocs(testEnv, [
        ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
        ['bedConfig/apollo', { floors: [] }],
      ])
      const db = dbAs(testEnv, 'recep-1', {})
      await assertSucceeds(getDoc(doc(db, 'bedConfig/apollo')))
    })

    it('blocks a Doctor/Receptionist from writing bed config — Hospital Admin only', async () => {
      await seedBedManagementEnabledHospital()
      await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'recep-1', {})
      await assertFails(setDoc(doc(db, 'bedConfig/apollo'), { floors: [] }))
    })

    it('lets the Hospital Admin write bed config once the feature is enabled', async () => {
      await seedBedManagementEnabledHospital()
      await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'admin-1', {})
      await assertSucceeds(setDoc(doc(db, 'bedConfig/apollo'), { floors: [] }))
    })

    it('never allows deleting bedConfig, not even for a superadmin', async () => {
      await seedDocs(testEnv, [
        ['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })],
        ['bedConfig/apollo', { floors: [] }],
      ])
      const db = dbAs(testEnv, 'super-1', {})
      await assertFails(deleteDoc(doc(db, 'bedConfig/apollo')))
    })
  })

  describe('admissions', () => {
    it('lets any staff with module access create/read an admission once the feature is enabled', async () => {
      await seedBedManagementEnabledHospital()
      await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'recep-1', {})
      await assertSucceeds(
        setDoc(doc(db, 'admissions/adm-1'), { hospitalId: 'apollo', patientName: 'Asha Rao', bedKey: 'apollo::f1::w1::r1::b1' })
      )
      await assertSucceeds(getDoc(doc(db, 'admissions/adm-1')))
    })

    it('never allows deleting an admission record, not even for a superadmin', async () => {
      await seedDocs(testEnv, [
        ['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })],
        ['admissions/adm-1', { hospitalId: 'apollo', patientName: 'Asha Rao' }],
      ])
      const db = dbAs(testEnv, 'super-1', {})
      await assertFails(deleteDoc(doc(db, 'admissions/adm-1')))
    })
  })

  describe('bedLocks', () => {
    it('lets anyone get a bed lock doc, even one that does not exist yet (needed to atomically claim a free bed)', async () => {
      const db = dbPublic(testEnv)
      const snap = await assertSucceeds(getDoc(doc(db, 'bedLocks/apollo::f1::w1::r1::b1')))
      expect(snap.exists()).toBe(false)
    })

    it('lets staff with bedManagement access claim a bed lock', async () => {
      await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'recep-1', {})
      await assertSucceeds(setDoc(doc(db, 'bedLocks/apollo::f1::w1::r1::b1'), { hospitalId: 'apollo', admissionId: 'adm-1' }))
    })
  })
})
