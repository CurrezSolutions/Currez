import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  query,
  collection,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './config'
import { generateToken } from '../utils/appointmentToken'
import { HOSPITAL_LIMITS_COLLECTION, normalizeLimits } from './hospitalLimits'

const APPOINTMENTS_COLLECTION = 'appointments'
const PHONE_LOOKUP_COLLECTION = 'phoneLookup'
const DOCTOR_SLOTS_COLLECTION = 'doctorSlots'
const PHONE_DAILY_COUNTS_COLLECTION = 'phoneDailyCounts'
const HOSPITAL_DAILY_COUNTS_COLLECTION = 'hospitalDailyCounts'

// A phone number may only self-book this many appointments for the same
// calendar date via the public booking form. Staff booking on a patient's
// behalf (createdBy !== 'public') isn't subject to this — they're a
// trusted, authenticated actor who may have a legitimate reason (e.g. two
// department visits the same day).
const MAX_PUBLIC_BOOKINGS_PER_PHONE_PER_DAY = 2

const SLOT_TAKEN_MESSAGE = 'That time was just taken by another booking — please pick a different slot.'

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '')
}

function phoneLookupId(hospitalId, phone) {
  return `${hospitalId}::${normalizePhone(phone)}`
}

function doctorSlotId(hospitalId, doctorId, date) {
  return `${hospitalId}::${doctorId}::${date}`
}

function phoneDailyCountId(hospitalId, phone, date) {
  return `${hospitalId}::${normalizePhone(phone)}::${date}`
}

function hospitalDailyCountId(hospitalId, date) {
  return `${hospitalId}::${date}`
}

// Checks the hospital's configured daily patient cap (see
// src/config/limitsRegistry.js's maxPatientsPerDay and
// src/firebase/hospitalLimits.js) and returns the write needed to record one
// more confirmed patient against it for `date` — or `null` if the hospital
// has no cap configured (Unlimited), in which case there's nothing to read
// or write. Must be called before any writes on the given transaction (it
// does its own reads). Throws if claiming one more slot would exceed the cap.
//
// Deliberately counts *confirmed* patients, not raw bookings: a patient
// self-booking always starts `pending` and is never counted here (see
// createAppointment below) — only once front-desk actually confirms it (see
// confirmAppointment) does it consume a slot. A pending request that's later
// rejected, ignored, or never shows up never permanently eats the day's cap.
// A staff booking made directly against a chosen doctor (already `scheduled`
// from creation) is a commitment from the start, so it's counted immediately.
async function checkAndClaimDailyPatientSlot(transaction, hospitalId, date) {
  const limitsSnap = await transaction.get(doc(db, HOSPITAL_LIMITS_COLLECTION, hospitalId))
  const maxPerDay = normalizeLimits(limitsSnap.exists() ? limitsSnap.data().limits : undefined).maxPatientsPerDay
  if (maxPerDay === null || maxPerDay === undefined) return null

  const countRef = doc(db, HOSPITAL_DAILY_COUNTS_COLLECTION, hospitalDailyCountId(hospitalId, date))
  const countSnap = await transaction.get(countRef)
  const count = (countSnap.exists() ? countSnap.data().count || 0 : 0) + 1
  if (count > maxPerDay) {
    throw new Error(
      `This hospital has reached its plan limit of ${maxPerDay} confirmed patients for ${date}. Contact your plan administrator to increase this limit.`
    )
  }
  return { ref: countRef, data: { hospitalId, date, count, updatedAt: serverTimestamp() } }
}

export function subscribeAppointments(hospitalId, callback, startDate, endDate) {
  const constraints = [where('hospitalId', '==', hospitalId)]
  if (startDate) constraints.push(where('date', '>=', startDate))
  if (endDate) constraints.push(where('date', '<=', endDate))
  const q = query(collection(db, APPOINTMENTS_COLLECTION), ...constraints)
  return onSnapshot(q, (snapshot) => {
    const appointments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    appointments.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
    callback(appointments)
  })
}

// One-off (non-realtime) read of which times are already claimed for a
// doctor on a date — this is what lets the public booking form (which has
// no query access to the appointments collection) grey out taken slots
// without exposing any patient data. See prepareSlotMove below for how a
// slot is actually claimed/released.
export async function getDoctorBookedTimes(hospitalId, doctorId, date) {
  if (!hospitalId || !doctorId || !date) return []
  const snap = await getDoc(doc(db, DOCTOR_SLOTS_COLLECTION, doctorSlotId(hospitalId, doctorId, date)))
  return snap.exists() ? snap.data().times || [] : []
}

async function readSlotTimes(transaction, hospitalId, doctorId, date) {
  if (!doctorId || !date) return []
  const snap = await transaction.get(doc(db, DOCTOR_SLOTS_COLLECTION, doctorSlotId(hospitalId, doctorId, date)))
  return snap.exists() ? snap.data().times || [] : []
}

// Validates and prepares the doctor-slot-claim writes needed to move an
// appointment from `prior` {doctorId, date, time} to `next` {doctorId,
// date, time} — either side may be blank ({} / undefined fields) meaning
// "held nothing" or "claiming nothing" (e.g. a patient who left time open,
// or a doctor not yet assigned). Must be called before any writes are
// issued on the transaction (it does its own reads). Throws SLOT_TAKEN_MESSAGE
// if `next` names a time someone else already holds. Returns a list of
// { ref, data } for the caller to actually write.
async function prepareSlotMove(transaction, hospitalId, prior, next) {
  const releasing = Boolean(prior?.doctorId && prior?.time)
  const claiming = Boolean(next?.doctorId && next?.time)
  if (!releasing && !claiming) return []

  const sameDoc = releasing && claiming && prior.doctorId === next.doctorId && prior.date === next.date
  const priorTimes = releasing ? await readSlotTimes(transaction, hospitalId, prior.doctorId, prior.date) : []
  const nextTimes = claiming ? (sameDoc ? priorTimes : await readSlotTimes(transaction, hospitalId, next.doctorId, next.date)) : []

  const keepingSameTime = sameDoc && prior.time === next.time
  if (claiming && !keepingSameTime && nextTimes.includes(next.time)) {
    throw new Error(SLOT_TAKEN_MESSAGE)
  }

  if (sameDoc) {
    const times = priorTimes.filter((t) => t !== prior.time)
    if (claiming) times.push(next.time)
    return [
      {
        ref: doc(db, DOCTOR_SLOTS_COLLECTION, doctorSlotId(hospitalId, next.doctorId, next.date)),
        data: { hospitalId, doctorId: next.doctorId, date: next.date, times, updatedAt: serverTimestamp() },
      },
    ]
  }

  const writes = []
  if (releasing) {
    writes.push({
      ref: doc(db, DOCTOR_SLOTS_COLLECTION, doctorSlotId(hospitalId, prior.doctorId, prior.date)),
      data: {
        hospitalId,
        doctorId: prior.doctorId,
        date: prior.date,
        times: priorTimes.filter((t) => t !== prior.time),
        updatedAt: serverTimestamp(),
      },
    })
  }
  if (claiming) {
    writes.push({
      ref: doc(db, DOCTOR_SLOTS_COLLECTION, doctorSlotId(hospitalId, next.doctorId, next.date)),
      data: {
        hospitalId,
        doctorId: next.doctorId,
        date: next.date,
        times: [...nextTimes, next.time],
        updatedAt: serverTimestamp(),
      },
    })
  }
  return writes
}

// The appointment's doc ID doubles as its public lookup token (see
// getAppointmentByToken) — short, unguessable, and readable off a screen.
// Collisions are practically impossible at this scale but we check anyway,
// the same way hospital slugs are checked before creation.
//
// Creation is transactional: a slot is only actually claimed if this
// appointment is created already `scheduled` (a staff booking with a
// doctor picked directly, which skips front-desk confirmation) — a patient
// self-booking always starts `pending`, so requesting a time doesn't lock
// it out for anyone else; the slot is only claimed once reception confirms
// (see confirmAppointment). Either way, a public/patient self-booking is
// also checked against MAX_PUBLIC_BOOKINGS_PER_PHONE_PER_DAY for that phone
// + date.
export async function createAppointment(data, createdBy) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateToken()
    const ref = doc(db, APPOINTMENTS_COLLECTION, token)
    const existing = await getDoc(ref)
    if (existing.exists()) continue

    await runTransaction(db, async (transaction) => {
      // --- reads (all of them, before any writes) ---
      const effectiveStatus = data.status || 'scheduled'
      const slotWrites = effectiveStatus === 'scheduled'
        ? await prepareSlotMove(transaction, data.hospitalId, {}, {
            doctorId: data.doctorId,
            date: data.date,
            time: data.time,
          })
        : []

      let phoneCountWrite = null
      if (createdBy === 'public' && data.patientPhone) {
        const countRef = doc(db, PHONE_DAILY_COUNTS_COLLECTION, phoneDailyCountId(data.hospitalId, data.patientPhone, data.date))
        const countSnap = await transaction.get(countRef)
        const count = (countSnap.exists() ? countSnap.data().count || 0 : 0) + 1
        if (count > MAX_PUBLIC_BOOKINGS_PER_PHONE_PER_DAY) {
          throw new Error(
            `This phone number already has ${MAX_PUBLIC_BOOKINGS_PER_PHONE_PER_DAY} appointments booked for ${data.date}. Please choose a different date, or contact the hospital directly.`
          )
        }
        phoneCountWrite = {
          ref: countRef,
          data: { hospitalId: data.hospitalId, phone: normalizePhone(data.patientPhone), date: data.date, count, updatedAt: serverTimestamp() },
        }
      }

      // Only a booking that's already confirmed at creation time (a staff
      // booking made directly against a chosen doctor) counts against the
      // daily cap here — a patient's own `pending` self-booking is counted
      // later, when front-desk actually confirms it (see confirmAppointment
      // and checkAndClaimDailyPatientSlot's comment above for why).
      const hospitalCountWrite = effectiveStatus === 'scheduled'
        ? await checkAndClaimDailyPatientSlot(transaction, data.hospitalId, data.date)
        : null

      // --- writes ---
      for (const w of slotWrites) transaction.set(w.ref, w.data, { merge: true })
      if (phoneCountWrite) transaction.set(phoneCountWrite.ref, phoneCountWrite.data, { merge: true })
      if (hospitalCountWrite) transaction.set(hospitalCountWrite.ref, hospitalCountWrite.data, { merge: true })

      transaction.set(ref, {
        ...data,
        token,
        status: data.status || 'scheduled',
        paymentMethod: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy,
      })

      // Lets the public status page look someone up by phone alone (see
      // getAppointmentsByPhone) without ever allowing an open query across
      // all appointments — the phone number is the doc ID here too, so a
      // lookup only ever returns that one patient's own token list.
      if (data.patientPhone) {
        transaction.set(
          doc(db, PHONE_LOOKUP_COLLECTION, phoneLookupId(data.hospitalId, data.patientPhone)),
          { hospitalId: data.hospitalId, tokens: arrayUnion(token), updatedAt: serverTimestamp() },
          { merge: true }
        )
      }
    })

    return token
  }
  throw new Error('Could not generate a unique appointment token, please try again.')
}

export function updateAppointmentStatus(appointmentId, status) {
  const apptRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId)

  // Cancelling frees up whatever slot this appointment held, so someone
  // else can book it — every other status transition is a simple field
  // update with no slot implications.
  if (status !== 'cancelled') {
    return updateDoc(apptRef, { status, updatedAt: serverTimestamp() })
  }

  return runTransaction(db, async (transaction) => {
    const apptSnap = await transaction.get(apptRef)
    if (!apptSnap.exists()) throw new Error('Appointment not found.')
    const prior = apptSnap.data()

    const slotWrites = await prepareSlotMove(
      transaction,
      prior.hospitalId,
      { doctorId: prior.doctorId, date: prior.date, time: prior.time },
      {}
    )

    for (const w of slotWrites) transaction.set(w.ref, w.data, { merge: true })
    transaction.update(apptRef, { status: 'cancelled', updatedAt: serverTimestamp() })
  })
}

// A doctor completes a visit by recording what it was for — reception/admin
// can still force-complete via updateAppointmentStatus above with no notes,
// but this is the path the doctor's own "Mark completed" goes through.
export function completeAppointmentWithNotes(appointmentId, { concerns, prescription, tests, completedBy }) {
  return updateDoc(doc(db, APPOINTMENTS_COLLECTION, appointmentId), {
    status: 'completed',
    concerns: concerns || '',
    prescription: prescription || [],
    tests: tests || [],
    consultedAt: serverTimestamp(),
    consultedBy: completedBy,
    updatedAt: serverTimestamp(),
  })
}

// Front-desk confirms a patient-booked (pending) appointment on arrival —
// this is what makes it visible to the doctor, and records how the visit
// fee was collected (cash in hand, or online via the hospital's own QR —
// neither is processed by this app, it's a record-keeping field only).
// If the appointment was booked without a doctor preference, confirming it
// is also the point where reception assigns one — pass doctorId/doctorName
// only when actually assigning (leave unset if it already has one). date/time
// are always written here too: the patient's original request may have been
// left blank, or no longer fit the assigned doctor's schedule, so
// confirmation is where a definite slot is locked in — atomically: whatever
// slot this appointment previously held (if any) is released and the new
// one claimed, rejecting if someone else already holds it. This is also the
// point where a `pending` appointment first counts against the hospital's
// daily patient cap (see checkAndClaimDailyPatientSlot above) — guarded by
// `prior.status !== 'scheduled'` so re-confirming an already-scheduled
// appointment (e.g. just changing the payment method) never double-counts it.
export function confirmAppointment(appointmentId, { paymentMethod, confirmedBy, date, time, doctorId, doctorName }) {
  const apptRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId)

  return runTransaction(db, async (transaction) => {
    const apptSnap = await transaction.get(apptRef)
    if (!apptSnap.exists()) throw new Error('Appointment not found.')
    const prior = apptSnap.data()
    const finalDoctorId = doctorId || prior.doctorId

    const slotWrites = await prepareSlotMove(
      transaction,
      prior.hospitalId,
      { doctorId: prior.doctorId, date: prior.date, time: prior.time },
      { doctorId: finalDoctorId, date, time }
    )

    const hospitalCountWrite = prior.status !== 'scheduled'
      ? await checkAndClaimDailyPatientSlot(transaction, prior.hospitalId, date)
      : null

    for (const w of slotWrites) transaction.set(w.ref, w.data, { merge: true })
    if (hospitalCountWrite) transaction.set(hospitalCountWrite.ref, hospitalCountWrite.data, { merge: true })

    transaction.update(apptRef, {
      status: 'scheduled',
      paymentMethod,
      date,
      time,
      paymentConfirmedAt: serverTimestamp(),
      paymentConfirmedBy: confirmedBy,
      updatedAt: serverTimestamp(),
      ...(doctorId ? { doctorId, doctorName } : {}),
    })
  })
}

// Lets reception move an already-scheduled appointment to a new date/time
// (and optionally a new doctor) — used when a doctor's schedule changes
// after confirmation and the original slot no longer works. Same atomic
// release-old/claim-new handling as confirmAppointment above.
export function rescheduleAppointment(appointmentId, { date, time, doctorId, doctorName, rescheduledBy }) {
  const apptRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId)

  return runTransaction(db, async (transaction) => {
    const apptSnap = await transaction.get(apptRef)
    if (!apptSnap.exists()) throw new Error('Appointment not found.')
    const prior = apptSnap.data()
    const finalDoctorId = doctorId || prior.doctorId

    const slotWrites = await prepareSlotMove(
      transaction,
      prior.hospitalId,
      { doctorId: prior.doctorId, date: prior.date, time: prior.time },
      { doctorId: finalDoctorId, date, time }
    )

    for (const w of slotWrites) transaction.set(w.ref, w.data, { merge: true })

    transaction.update(apptRef, {
      date,
      time,
      ...(doctorId ? { doctorId, doctorName } : {}),
      rescheduledAt: serverTimestamp(),
      rescheduledBy,
      updatedAt: serverTimestamp(),
    })
  })
}

// Public status-check lookup by token (the doc ID). If a phone is also
// supplied it's cross-checked, but the token alone is already the real
// access-control boundary (see the collection's Firestore rule).
export async function getAppointmentByToken(token, phone) {
  const snapshot = await getDoc(doc(db, APPOINTMENTS_COLLECTION, token.trim().toUpperCase()))
  if (!snapshot.exists()) return null
  const appointment = { id: snapshot.id, ...snapshot.data() }
  if (phone && normalizePhone(appointment.patientPhone) !== normalizePhone(phone)) return null
  return appointment
}

// Public status-check lookup by phone alone (no token) — resolves every
// token booked under that phone number at this hospital, then fetches
// each appointment. Returns [] if nothing matches.
// Deliberately N individual getDoc() calls, not a documentId()-'in' query —
// firestore.rules only grants public (unauthenticated) access to
// appointments via `get`, never `list` ("never enumerate the collection"),
// specifically so a phone number can only ever resolve the exact tokens
// already recorded against it in phoneLookup, not browse the collection.
// A batched query here would need `list` to be public too, which would
// undermine that boundary — so this stays as-is.
export async function getAppointmentsByPhone(hospitalId, phone) {
  const lookupSnap = await getDoc(doc(db, PHONE_LOOKUP_COLLECTION, phoneLookupId(hospitalId, phone)))
  if (!lookupSnap.exists()) return []

  const tokens = lookupSnap.data().tokens || []
  const appointments = await Promise.all(
    tokens.map(async (token) => {
      const snap = await getDoc(doc(db, APPOINTMENTS_COLLECTION, token))
      return snap.exists() ? { id: snap.id, ...snap.data() } : null
    })
  )

  return appointments
    .filter((a) => a && a.hospitalId === hospitalId)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
}
