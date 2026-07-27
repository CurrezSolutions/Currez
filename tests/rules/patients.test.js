import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, addDoc, collection, updateDoc, deleteDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

// Covers /patients — the public self-service booking form's own patient
// record creation, plus the per-staff-member module permission levels
// (none/view/edit) from Staff Permissions (src/utils/permissions.js).
describe('firestore.rules: patients (module: Patients)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-patients')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('lets an unauthenticated visitor create their own patient record with a valid shape', async () => {
    const db = dbPublic(testEnv)
    await assertSucceeds(
      addDoc(collection(db, 'patients'), { hospitalId: 'apollo', name: 'Asha Rao', phone: '9990001111' })
    )
  })

  it("rejects an unauthenticated visitor's patient record missing a required field", async () => {
    const db = dbPublic(testEnv)
    await assertFails(addDoc(collection(db, 'patients'), { hospitalId: 'apollo', name: 'Asha Rao' }))
  })

  it('lets a receptionist with default (unset) permissions create and read a patient', async () => {
    await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'recep-1', {})
    const ref = await assertSucceeds(
      addDoc(collection(db, 'patients'), { hospitalId: 'apollo', name: 'Asha Rao', phone: '9990001111' })
    )
    await assertSucceeds(getDoc(doc(db, 'patients', ref.id)))
  })

  it("blocks reading and writing patients once a staff member's Patients permission is set to 'none'", async () => {
    await seedDocs(testEnv, [
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo', permissions: { patients: 'none' } })],
      ['patients/p1', { hospitalId: 'apollo', name: 'Asha Rao', phone: '9990001111' }],
    ])
    const db = dbAs(testEnv, 'recep-1', {})
    await assertFails(getDoc(doc(db, 'patients/p1')))
    await assertFails(updateDoc(doc(db, 'patients/p1'), { name: 'Asha R.' }))
  })

  it("lets a 'view'-only staff member read but not edit a patient", async () => {
    await seedDocs(testEnv, [
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo', permissions: { patients: 'view' } })],
      ['patients/p1', { hospitalId: 'apollo', name: 'Asha Rao', phone: '9990001111' }],
    ])
    const db = dbAs(testEnv, 'recep-1', {})
    await assertSucceeds(getDoc(doc(db, 'patients/p1')))
    await assertFails(updateDoc(doc(db, 'patients/p1'), { name: 'Asha R.' }))
  })

  it('blocks staff of a different hospital from reading a patient record', async () => {
    await seedDocs(testEnv, [
      ['users/recep-2', userDoc({ role: 'RECEPTIONIST', hospitalId: 'other-hospital' })],
      ['patients/p1', { hospitalId: 'apollo', name: 'Asha Rao', phone: '9990001111' }],
    ])
    const db = dbAs(testEnv, 'recep-2', {})
    await assertFails(getDoc(doc(db, 'patients/p1')))
  })

  it('only lets a superadmin delete a patient record', async () => {
    await seedDocs(testEnv, [
      ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
      ['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })],
      ['patients/p1', { hospitalId: 'apollo', name: 'Asha Rao', phone: '9990001111' }],
    ])
    await assertFails(deleteDoc(doc(dbAs(testEnv, 'admin-1', {}), 'patients/p1')))
    await assertSucceeds(deleteDoc(doc(dbAs(testEnv, 'super-1', {}), 'patients/p1')))
  })
})
