import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, addDoc, collection, query, setDoc, updateDoc, deleteDoc, where } from 'firebase/firestore'
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

// Covers /patientsByPhone — the phone -> [{id, name}] index that lets the
// unauthenticated public booking form (and the doctor's "Find Patient" page)
// see who's already registered under a phone number without ever getting
// query access to /patients itself. See getPatientsByPhone/createPatient in
// src/firebase/patients.js and MAX_PATIENTS_PER_PHONE (5).
describe('firestore.rules: patientsByPhone (max patients per phone number)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-patients-by-phone')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('lets anyone, including an unauthenticated visitor, get a lookup doc by its id', async () => {
    await seedDocs(testEnv, [
      ['patientsByPhone/apollo::9990001111', { hospitalId: 'apollo', phone: '9990001111', patients: [{ id: 'p1', name: 'Asha Rao' }] }],
    ])
    const snap = await assertSucceeds(getDoc(doc(dbPublic(testEnv), 'patientsByPhone/apollo::9990001111')))
    expect(snap.data().patients).toHaveLength(1)
  })

  it('lets an unauthenticated visitor create a lookup doc with 1-5 patients', async () => {
    const db = dbPublic(testEnv)
    await assertSucceeds(
      setDoc(doc(db, 'patientsByPhone/apollo::9990001111'), {
        hospitalId: 'apollo',
        phone: '9990001111',
        patients: [{ id: 'p1', name: 'Asha Rao' }],
      })
    )
  })

  it('rejects creating a lookup doc that already starts above the 5-patient cap', async () => {
    const db = dbPublic(testEnv)
    const patients = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Patient ${i}` }))
    await assertFails(
      setDoc(doc(db, 'patientsByPhone/apollo::9990001111'), { hospitalId: 'apollo', phone: '9990001111', patients })
    )
  })

  it('rejects growing a lookup doc past the 5-patient cap', async () => {
    await seedDocs(testEnv, [
      [
        'patientsByPhone/apollo::9990001111',
        {
          hospitalId: 'apollo',
          phone: '9990001111',
          patients: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `Patient ${i}` })),
        },
      ],
    ])
    const db = dbPublic(testEnv)
    await assertFails(
      setDoc(doc(db, 'patientsByPhone/apollo::9990001111'), {
        hospitalId: 'apollo',
        phone: '9990001111',
        patients: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Patient ${i}` })),
      })
    )
  })

  it('rejects a lookup doc update that removes an existing entry (shrinks the array)', async () => {
    await seedDocs(testEnv, [
      [
        'patientsByPhone/apollo::9990001111',
        { hospitalId: 'apollo', phone: '9990001111', patients: [{ id: 'p1', name: 'Asha Rao' }, { id: 'p2', name: 'Ravi Rao' }] },
      ],
    ])
    const db = dbPublic(testEnv)
    await assertFails(
      setDoc(doc(db, 'patientsByPhone/apollo::9990001111'), {
        hospitalId: 'apollo',
        phone: '9990001111',
        patients: [{ id: 'p1', name: 'Asha Rao' }],
      })
    )
  })

  it("lets a hospital's own staff list its lookup docs, but not another hospital's staff or the public", async () => {
    await seedDocs(testEnv, [
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
      ['users/recep-2', userDoc({ role: 'RECEPTIONIST', hospitalId: 'other-hospital' })],
      ['patientsByPhone/apollo::9990001111', { hospitalId: 'apollo', phone: '9990001111', patients: [{ id: 'p1', name: 'Asha Rao' }] }],
    ])
    await assertSucceeds(
      getDocs(query(collection(dbAs(testEnv, 'recep-1', {}), 'patientsByPhone'), where('hospitalId', '==', 'apollo')))
    )
    await assertFails(getDocs(query(collection(dbPublic(testEnv), 'patientsByPhone'), where('hospitalId', '==', 'apollo'))))
    await assertFails(
      getDocs(query(collection(dbAs(testEnv, 'recep-2', {}), 'patientsByPhone'), where('hospitalId', '==', 'apollo')))
    )
  })
})
