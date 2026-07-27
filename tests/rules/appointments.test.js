import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

// Covers /appointments, /doctorSlots and /phoneLookup — the public booking
// flow (src/components/hospital/BookAppointmentForm.jsx +
// src/firebase/appointments.js's createAppointment) and the staff-side
// booking/confirm flow. This is the module that broke in production when
// the Limits feature added an unguarded read (see hospital-limits.test.js
// for that specific regression) — these tests pin down the booking flow
// itself so the next change to this file can't silently break it again.
describe('firestore.rules: appointments & booking support (module: Appointments)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-appointments')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  describe('appointments', () => {
    it('lets an unauthenticated patient create a pending self-booked appointment', async () => {
      const db = dbPublic(testEnv)
      await assertSucceeds(
        setDoc(doc(db, 'appointments/APT-TEST-0001'), {
          hospitalId: 'apollo',
          patientName: 'Asha Rao',
          status: 'pending',
          bookedBy: 'patient',
        })
      )
    })

    it('blocks an unauthenticated visitor from self-booking directly into "scheduled"', async () => {
      const db = dbPublic(testEnv)
      await assertFails(
        setDoc(doc(db, 'appointments/APT-TEST-0002'), {
          hospitalId: 'apollo',
          patientName: 'Asha Rao',
          status: 'scheduled',
          bookedBy: 'patient',
        })
      )
    })

    it('blocks an unauthenticated create that claims bookedBy != "patient" (spoofing a staff booking)', async () => {
      const db = dbPublic(testEnv)
      await assertFails(
        setDoc(doc(db, 'appointments/APT-TEST-0003'), {
          hospitalId: 'apollo',
          patientName: 'Asha Rao',
          status: 'pending',
          bookedBy: 'staff',
        })
      )
    })

    it('lets hospital staff with appointments access book an already-scheduled appointment', async () => {
      await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'recep-1', {})
      await assertSucceeds(
        setDoc(doc(db, 'appointments/APT-TEST-0004'), {
          hospitalId: 'apollo',
          patientName: 'Asha Rao',
          status: 'scheduled',
          bookedBy: 'staff',
        })
      )
    })

    it('lets anyone get a single appointment by its token, but never list the collection unauthenticated', async () => {
      await seedDocs(testEnv, [
        ['appointments/APT-TEST-0005', { hospitalId: 'apollo', patientName: 'Asha Rao', status: 'pending' }],
      ])
      const db = dbPublic(testEnv)
      await assertSucceeds(getDoc(doc(db, 'appointments/APT-TEST-0005')))
      await assertFails(getDocs(query(collection(db, 'appointments'), where('hospitalId', '==', 'apollo'))))
    })

    it("lets a hospital's own staff list its appointments, but not another hospital's staff", async () => {
      await seedDocs(testEnv, [
        ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
        ['users/recep-2', userDoc({ role: 'RECEPTIONIST', hospitalId: 'other-hospital' })],
        ['appointments/APT-TEST-0006', { hospitalId: 'apollo', patientName: 'Asha Rao', status: 'pending' }],
      ])
      const ownDb = dbAs(testEnv, 'recep-1', {})
      await assertSucceeds(getDocs(query(collection(ownDb, 'appointments'), where('hospitalId', '==', 'apollo'))))

      const otherDb = dbAs(testEnv, 'recep-2', {})
      await assertFails(getDocs(query(collection(otherDb, 'appointments'), where('hospitalId', '==', 'apollo'))))
    })

    it('lets staff confirm/update an appointment, and only a superadmin delete one', async () => {
      await seedDocs(testEnv, [
        ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
        ['appointments/APT-TEST-0007', { hospitalId: 'apollo', patientName: 'Asha Rao', status: 'pending' }],
      ])
      const staffDb = dbAs(testEnv, 'recep-1', {})
      await assertSucceeds(updateDoc(doc(staffDb, 'appointments/APT-TEST-0007'), { status: 'scheduled' }))
    })
  })

  describe('doctorSlots', () => {
    it('lets the public flow claim exactly one time slot, but not create with more than one', async () => {
      const db = dbPublic(testEnv)
      await assertSucceeds(
        setDoc(doc(db, 'doctorSlots/apollo::doc-1::2026-08-01'), {
          hospitalId: 'apollo',
          doctorId: 'doc-1',
          date: '2026-08-01',
          times: ['10:00'],
        })
      )
      await assertFails(
        setDoc(doc(db, 'doctorSlots/apollo::doc-1::2026-08-02'), {
          hospitalId: 'apollo',
          doctorId: 'doc-1',
          date: '2026-08-02',
          times: ['10:00', '10:30'],
        })
      )
    })

    it('lets the public flow add one more time to an existing slot doc, never remove one', async () => {
      await seedDocs(testEnv, [
        [
          'doctorSlots/apollo::doc-1::2026-08-01',
          { hospitalId: 'apollo', doctorId: 'doc-1', date: '2026-08-01', times: ['10:00'] },
        ],
      ])
      const db = dbPublic(testEnv)
      await assertSucceeds(
        updateDoc(doc(db, 'doctorSlots/apollo::doc-1::2026-08-01'), { times: ['10:00', '10:30'] })
      )
      await assertFails(updateDoc(doc(db, 'doctorSlots/apollo::doc-1::2026-08-01'), { times: ['10:30'] }))
    })

    it('lets staff with appointments access fully replace (e.g. shrink) a slot doc directly', async () => {
      await seedDocs(testEnv, [
        ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
        [
          'doctorSlots/apollo::doc-1::2026-08-01',
          { hospitalId: 'apollo', doctorId: 'doc-1', date: '2026-08-01', times: ['10:00', '10:30'] },
        ],
      ])
      const db = dbAs(testEnv, 'recep-1', {})
      await assertSucceeds(updateDoc(doc(db, 'doctorSlots/apollo::doc-1::2026-08-01'), { times: ['10:00'] }))
    })
  })

  describe('phoneLookup', () => {
    it('lets the public flow create/update its own phone lookup doc and read it back', async () => {
      const db = dbPublic(testEnv)
      await assertSucceeds(
        setDoc(doc(db, 'phoneLookup/apollo::9990001111'), { hospitalId: 'apollo', tokens: ['APT-TEST-0001'] })
      )
      await assertSucceeds(getDoc(doc(db, 'phoneLookup/apollo::9990001111')))
    })
  })

  describe('phoneDailyCounts (per-phone public booking cap)', () => {
    it('lets a first public booking start the counter at 1, never straight at 2', async () => {
      const db = dbPublic(testEnv)
      await assertSucceeds(
        setDoc(doc(db, 'phoneDailyCounts/apollo::9990001111::2026-08-01'), {
          hospitalId: 'apollo',
          phone: '9990001111',
          date: '2026-08-01',
          count: 1,
        })
      )
      await assertFails(
        setDoc(doc(db, 'phoneDailyCounts/apollo::9990002222::2026-08-01'), {
          hospitalId: 'apollo',
          phone: '9990002222',
          date: '2026-08-01',
          count: 2,
        })
      )
    })

    it('allows incrementing to 2 but never past the 2-per-day public cap', async () => {
      await seedDocs(testEnv, [
        [
          'phoneDailyCounts/apollo::9990001111::2026-08-01',
          { hospitalId: 'apollo', phone: '9990001111', date: '2026-08-01', count: 1 },
        ],
      ])
      const db = dbPublic(testEnv)
      await assertSucceeds(updateDoc(doc(db, 'phoneDailyCounts/apollo::9990001111::2026-08-01'), { count: 2 }))
      await assertFails(updateDoc(doc(db, 'phoneDailyCounts/apollo::9990001111::2026-08-01'), { count: 3 }))
    })
  })
})
