import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, userDoc } from './helpers.js'

// Covers /activityLog (module: Activity Log, src/firebase/activityLog.js) —
// an append-only audit trail. Any active staff member may write an entry
// (recording their own action) regardless of the module toggle below; a
// Doctor/Receptionist can never read the log itself either way. Reading it
// back is where the toggle matters: a hospital's own Hospital Admin may only
// read it once Super Admin has turned the 'activityLog' module on for that
// hospital (src/config/featureRegistry.js, off by default) — but Super Admin
// can always read any hospital's log, regardless of that toggle (it's their
// own oversight/support tool, see HospitalActivityLogPanel). Nothing may
// ever update or delete an entry once written, not even Super Admin.
describe('firestore.rules: activityLog (module: Activity Log)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-activity-log')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('lets any active staff member log an entry for their own hospital', async () => {
    await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'recep-1', {})
    await assertSucceeds(
      setDoc(doc(db, 'activityLog/entry-1'), {
        hospitalId: 'apollo',
        action: 'staff.created',
        actorUid: 'recep-1',
      })
    )
  })

  it('blocks logging an entry for a different hospital', async () => {
    await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'recep-1', {})
    await assertFails(
      setDoc(doc(db, 'activityLog/entry-1'), { hospitalId: 'other-hospital', action: 'staff.created' })
    )
  })

  it("blocks the hospital's own admin from reading the log until Super Admin turns the module on, but never blocks Super Admin", async () => {
    await seedDocs(testEnv, [
      ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
      ['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })],
      ['activityLog/entry-1', { hospitalId: 'apollo', action: 'staff.created' }],
    ])
    // No hospitalFeatures doc yet == activityLog off (default false) for apollo.
    await assertFails(getDoc(doc(dbAs(testEnv, 'admin-1', {}), 'activityLog/entry-1')))
    await assertSucceeds(getDoc(doc(dbAs(testEnv, 'super-1', {}), 'activityLog/entry-1')))
  })

  it("lets the hospital's own admin read the log once Super Admin turns the module on, but never a doctor/receptionist", async () => {
    await seedDocs(testEnv, [
      ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
      ['hospitalFeatures/apollo', { hospitalId: 'apollo', features: { activityLog: true } }],
      ['activityLog/entry-1', { hospitalId: 'apollo', action: 'staff.created' }],
    ])
    await assertSucceeds(getDoc(doc(dbAs(testEnv, 'admin-1', {}), 'activityLog/entry-1')))
    await assertFails(getDoc(doc(dbAs(testEnv, 'recep-1', {}), 'activityLog/entry-1')))
  })

  it('never allows editing or deleting a log entry, not even for a superadmin', async () => {
    await seedDocs(testEnv, [
      ['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })],
      ['activityLog/entry-1', { hospitalId: 'apollo', action: 'staff.created' }],
    ])
    const db = dbAs(testEnv, 'super-1', {})
    await assertFails(updateDoc(doc(db, 'activityLog/entry-1'), { action: 'tampered' }))
    await assertFails(deleteDoc(doc(db, 'activityLog/entry-1')))
  })
})
