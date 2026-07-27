import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

// Covers /users — roles, staff creation (StaffFormModal), and the
// privilege-escalation guards called out explicitly in the rules'
// comments (a Hospital Admin can't promote themselves/staff to another
// hospital or to HOSPITAL_ADMIN; a Doctor can't touch their own role).
describe('firestore.rules: users / staff & roles (module: Staff)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-users-staff')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  async function seedHospitalAdmin(uid = 'admin-1', hospitalId = 'apollo') {
    await seedDocs(testEnv, [[`users/${uid}`, userDoc({ role: 'HOSPITAL_ADMIN', hospitalId })]])
  }

  it('lets a superadmin create a staff account of any role', async () => {
    await seedDocs(testEnv, [['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })]])
    const db = dbAs(testEnv, 'super-1', {})
    await assertSucceeds(
      setDoc(doc(db, 'users/new-admin'), userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' }))
    )
  })

  it('lets a Hospital Admin create a Doctor/Receptionist for their own hospital', async () => {
    await seedHospitalAdmin()
    const db = dbAs(testEnv, 'admin-1', {})
    await assertSucceeds(
      setDoc(doc(db, 'users/new-doc'), userDoc({ role: 'DOCTOR', hospitalId: 'apollo', specialization: 'Cardiology' }))
    )
  })

  it('blocks a Hospital Admin from creating another Hospital Admin (privilege escalation)', async () => {
    await seedHospitalAdmin()
    const db = dbAs(testEnv, 'admin-1', {})
    await assertFails(
      setDoc(doc(db, 'users/new-admin'), userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' }))
    )
  })

  it("blocks a Hospital Admin from creating staff for a different hospital", async () => {
    await seedHospitalAdmin('admin-1', 'apollo')
    const db = dbAs(testEnv, 'admin-1', {})
    await assertFails(
      setDoc(doc(db, 'users/new-doc'), userDoc({ role: 'DOCTOR', hospitalId: 'other-hospital' }))
    )
  })

  it('blocks a Doctor (non-admin) from creating any staff account', async () => {
    await seedDocs(testEnv, [['users/doc-1', userDoc({ role: 'DOCTOR', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'doc-1', {})
    await assertFails(setDoc(doc(db, 'users/new-doc'), userDoc({ role: 'DOCTOR', hospitalId: 'apollo' })))
  })

  it('exposes an active Doctor doc publicly (patients pick a doctor with no login) but not a Receptionist', async () => {
    await seedDocs(testEnv, [
      ['users/doc-1', userDoc({ role: 'DOCTOR', hospitalId: 'apollo', status: 'active' })],
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo', status: 'active' })],
    ])
    const db = dbPublic(testEnv)
    await assertSucceeds(getDoc(doc(db, 'users/doc-1')))
    await assertFails(getDoc(doc(db, 'users/recep-1')))
  })

  it('lets staff read a colleague in the same hospital, but not a staff member of a different hospital', async () => {
    // Deliberately RECEPTIONIST, not DOCTOR — an active doctor doc is public
    // regardless of hospital (isActiveDoctorDoc), which would make this test
    // pass for the wrong reason.
    await seedDocs(testEnv, [
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
      ['users/recep-2', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
      ['users/recep-3', userDoc({ role: 'RECEPTIONIST', hospitalId: 'other-hospital' })],
    ])

    const sameHospitalDb = dbAs(testEnv, 'recep-1', {})
    await assertSucceeds(getDoc(doc(sameHospitalDb, 'users/recep-2')))

    const otherHospitalDb = dbAs(testEnv, 'recep-3', {})
    await assertFails(getDoc(doc(otherHospitalDb, 'users/recep-2')))
  })

  it("lets a Hospital Admin deactivate their own doctor, but not change that doctor's role or hospital", async () => {
    await seedHospitalAdmin()
    await seedDocs(testEnv, [['users/doc-1', userDoc({ role: 'DOCTOR', hospitalId: 'apollo', status: 'active' })]])
    const db = dbAs(testEnv, 'admin-1', {})

    await assertSucceeds(updateDoc(doc(db, 'users/doc-1'), { status: 'disabled' }))
    await assertFails(updateDoc(doc(db, 'users/doc-1'), { role: 'RECEPTIONIST' }))
    await assertFails(updateDoc(doc(db, 'users/doc-1'), { hospitalId: 'other-hospital' }))
  })

  it('lets a Doctor update their own schedule, but not their own role (self-escalation)', async () => {
    await seedDocs(testEnv, [
      ['users/doc-1', userDoc({ role: 'DOCTOR', hospitalId: 'apollo', status: 'active', email: 'doc@apollo.com' })],
    ])
    const db = dbAs(testEnv, 'doc-1', {})

    await assertSucceeds(updateDoc(doc(db, 'users/doc-1'), { schedule: { mon: '9-5' } }))
    await assertFails(updateDoc(doc(db, 'users/doc-1'), { role: 'HOSPITAL_ADMIN' }))
  })

  it('only lets a superadmin delete a user doc', async () => {
    await seedHospitalAdmin()
    await seedDocs(testEnv, [['users/doc-1', userDoc({ role: 'DOCTOR', hospitalId: 'apollo' })]])

    const adminDb = dbAs(testEnv, 'admin-1', {})
    await assertFails(deleteDoc(doc(adminDb, 'users/doc-1')))

    await seedDocs(testEnv, [['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })]])
    const superDb = dbAs(testEnv, 'super-1', {})
    await assertSucceeds(deleteDoc(doc(superDb, 'users/doc-1')))
  })
})
