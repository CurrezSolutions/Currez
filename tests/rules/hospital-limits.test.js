import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

// Covers /hospitalLimits and /hospitalDailyCounts (src/config/limitsRegistry.js,
// src/firebase/hospitalLimits.js, and the daily-patient-cap enforcement inside
// createAppointment in src/firebase/appointments.js).
//
// The first test below pins down a real production incident: createAppointment
// reads /hospitalLimits/{hospitalId} directly (to decide whether/how to enforce
// maxPatientsPerDay) as part of *every* booking, including an unauthenticated
// patient's own self-booking. When that collection's `get` rule was
// staff-only, this read was denied for the public flow, and Firestore fails
// the *entire* transaction on any single denied read inside it — so public
// booking broke outright with "Missing or insufficient permissions", even
// though nothing about the booking itself was invalid. Fixed by making `get`
// public (the doc holds only plan numbers, nothing sensitive) — if this test
// ever goes red again, that's this exact incident recurring.
describe('firestore.rules: hospitalLimits & hospitalDailyCounts (module: Super Admin plan limits)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-hospital-limits')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  describe('hospitalLimits', () => {
    it('REGRESSION: lets an unauthenticated visitor read a hospital\'s limits doc (required for public booking to work at all)', async () => {
      await seedDocs(testEnv, [
        ['hospitalLimits/apollo', { hospitalId: 'apollo', limits: { maxPatientsPerDay: 60 } }],
      ])
      const db = dbPublic(testEnv)
      await assertSucceeds(getDoc(doc(db, 'hospitalLimits/apollo')))
    })

    it('lets a hospital\'s own staff read its limits too', async () => {
      await seedDocs(testEnv, [
        ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
        ['hospitalLimits/apollo', { hospitalId: 'apollo', limits: { maxPatientsPerDay: 60 } }],
      ])
      const db = dbAs(testEnv, 'admin-1', {})
      await assertSucceeds(getDoc(doc(db, 'hospitalLimits/apollo')))
    })

    it('blocks anyone other than a superadmin from writing hospitalLimits', async () => {
      await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
      const adminDb = dbAs(testEnv, 'admin-1', {})
      await assertFails(setDoc(doc(adminDb, 'hospitalLimits/apollo'), { limits: { maxPatientsPerDay: 9999 } }))

      const publicDb = dbPublic(testEnv)
      await assertFails(setDoc(doc(publicDb, 'hospitalLimits/apollo'), { limits: { maxPatientsPerDay: 9999 } }))
    })

    it('lets a superadmin set and update hospitalLimits', async () => {
      await seedDocs(testEnv, [['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })]])
      const db = dbAs(testEnv, 'super-1', {})
      await assertSucceeds(
        setDoc(doc(db, 'hospitalLimits/apollo'), { hospitalId: 'apollo', limits: { maxPatientsPerDay: 60 } })
      )
      await assertSucceeds(updateDoc(doc(db, 'hospitalLimits/apollo'), { 'limits.maxPatientsPerDay': 100 }))
    })

    it('blocks non-superadmin from listing all hospitals\' limits', async () => {
      await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'admin-1', {})
      const { getDocs, collection } = await import('firebase/firestore')
      await assertFails(getDocs(collection(db, 'hospitalLimits')))
    })
  })

  describe('hospitalDailyCounts (server-side enforcement of maxPatientsPerDay)', () => {
    it('falls back to the registry default (60) when a hospital has no hospitalLimits doc yet', async () => {
      const db = dbPublic(testEnv)
      await assertSucceeds(
        setDoc(doc(db, 'hospitalDailyCounts/apollo::2026-08-01'), {
          hospitalId: 'apollo',
          date: '2026-08-01',
          count: 1,
        })
      )
    })

    it('rejects a create/update that would exceed the configured daily cap', async () => {
      await seedDocs(testEnv, [
        ['hospitalLimits/apollo', { hospitalId: 'apollo', limits: { maxPatientsPerDay: 2 } }],
        ['hospitalDailyCounts/apollo::2026-08-01', { hospitalId: 'apollo', date: '2026-08-01', count: 2 }],
      ])
      const db = dbPublic(testEnv)
      await assertFails(updateDoc(doc(db, 'hospitalDailyCounts/apollo::2026-08-01'), { count: 3 }))
    })

    it('allows increments right up to a configured cap', async () => {
      await seedDocs(testEnv, [
        ['hospitalLimits/apollo', { hospitalId: 'apollo', limits: { maxPatientsPerDay: 3 } }],
        ['hospitalDailyCounts/apollo::2026-08-01', { hospitalId: 'apollo', date: '2026-08-01', count: 2 }],
      ])
      const db = dbPublic(testEnv)
      await assertSucceeds(updateDoc(doc(db, 'hospitalDailyCounts/apollo::2026-08-01'), { count: 3 }))
    })

    it('treats a `null` maxPatientsPerDay (Unlimited) as no cap', async () => {
      await seedDocs(testEnv, [
        ['hospitalLimits/apollo', { hospitalId: 'apollo', limits: { maxPatientsPerDay: null } }],
        ['hospitalDailyCounts/apollo::2026-08-01', { hospitalId: 'apollo', date: '2026-08-01', count: 500 }],
      ])
      const db = dbPublic(testEnv)
      await assertSucceeds(updateDoc(doc(db, 'hospitalDailyCounts/apollo::2026-08-01'), { count: 501 }))
    })

    it('rejects a create that skips straight to count 2, and an update that jumps by more than 1', async () => {
      const db = dbPublic(testEnv)
      await assertFails(
        setDoc(doc(db, 'hospitalDailyCounts/apollo::2026-08-01'), {
          hospitalId: 'apollo',
          date: '2026-08-01',
          count: 2,
        })
      )

      await seedDocs(testEnv, [
        ['hospitalDailyCounts/apollo::2026-08-02', { hospitalId: 'apollo', date: '2026-08-02', count: 1 }],
      ])
      await assertFails(updateDoc(doc(db, 'hospitalDailyCounts/apollo::2026-08-02'), { count: 5 }))
    })

    it('only a superadmin may delete a hospitalDailyCounts doc', async () => {
      await seedDocs(testEnv, [
        ['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })],
        ['hospitalDailyCounts/apollo::2026-08-01', { hospitalId: 'apollo', date: '2026-08-01', count: 1 }],
      ])
      await assertFails(deleteDoc(doc(dbPublic(testEnv), 'hospitalDailyCounts/apollo::2026-08-01')))
      await assertSucceeds(deleteDoc(doc(dbAs(testEnv, 'super-1', {}), 'hospitalDailyCounts/apollo::2026-08-01')))
    })
  })
})
