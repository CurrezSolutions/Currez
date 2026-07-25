import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './config'

const BED_CONFIG_COLLECTION = 'bedConfig'
const ADMISSIONS_COLLECTION = 'admissions'
const BED_LOCKS_COLLECTION = 'bedLocks'

// `::`-joined, matching every other composite-id collection in this app
// (doctorSlots, phoneLookup, ...) — deliberately not the `/`-joined
// bedKey() format from src/utils/bedManagement.js, since `/` isn't valid
// inside a single Firestore document id (it's the path separator).
function bedLockId(hospitalId, floorId, wardId, roomId, bedId) {
  return `${hospitalId}::${floorId}::${wardId || '_'}::${roomId || '_'}::${bedId}`
}

// ─── Bed Config ──────────────────────────────────────────────────────────────

export function subscribeBedConfig(hospitalId, callback) {
  return onSnapshot(doc(db, BED_CONFIG_COLLECTION, hospitalId), (snap) => {
    callback(snap.exists() ? { hospitalId: snap.id, ...snap.data() } : null)
  })
}

export async function getBedConfig(hospitalId) {
  const snap = await getDoc(doc(db, BED_CONFIG_COLLECTION, hospitalId))
  return snap.exists() ? { hospitalId: snap.id, ...snap.data() } : null
}

export function updateBedConfig(hospitalId, config, updatedBy) {
  return updateDoc(doc(db, BED_CONFIG_COLLECTION, hospitalId), {
    ...config,
    updatedAt: serverTimestamp(),
    updatedBy,
  })
}

export async function createBedConfig(hospitalId, config, createdBy) {
  return setDoc(doc(db, BED_CONFIG_COLLECTION, hospitalId), {
    ...config,
    hospitalId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  })
}

// ─── Admissions ──────────────────────────────────────────────────────────────

export function subscribeActiveAdmissions(hospitalId, callback) {
  const q = query(
    collection(db, ADMISSIONS_COLLECTION),
    where('hospitalId', '==', hospitalId),
    where('status', '==', 'active')
  )
  return onSnapshot(q, (snap) => {
    const admissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    admissions.sort((a, b) => (b.admittedAt?.toMillis?.() ?? 0) - (a.admittedAt?.toMillis?.() ?? 0))
    callback(admissions)
  })
}

// Every admission regardless of status — powers the discharge/admission
// history view (past, already-discharged stays), which previously had
// nowhere in the UI to look them up even though this function already
// existed for exactly that purpose.
export function subscribeAllAdmissions(hospitalId, callback) {
  const q = query(
    collection(db, ADMISSIONS_COLLECTION),
    where('hospitalId', '==', hospitalId)
  )
  return onSnapshot(q, (snap) => {
    const admissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    admissions.sort((a, b) => (b.admittedAt?.toMillis?.() ?? 0) - (a.admittedAt?.toMillis?.() ?? 0))
    callback(admissions)
  })
}

// Admits a patient to a bed, claiming it atomically via a bedLocks doc keyed
// on the bed's full floor/ward/room/bed position — the same claim-inside-a-
// transaction pattern src/firebase/appointments.js already uses for
// doctorSlots, now applied here too. The previous version checked for a
// conflicting active admission with a plain query, then wrote separately —
// two receptionists admitting to the same bed within that race window could
// both have succeeded. See UAT_SECURITY_REPORT.md §4.
export async function admitPatient(
  {
    hospitalId,
    patientId,
    patientName,
    patientPhone,
    floorId,
    floorName,
    wardId,
    wardName,
    roomId,
    roomName,
    bedId,
    bedType,
    dailyRate,
    attendingDoctor,
    attendingDoctorId,
    diagnosis,
    notes,
    linkedAppointmentId,
  },
  admittedBy
) {
  if (!hospitalId || !bedId) {
    throw new Error('Hospital ID and Bed ID are required.')
  }
  if (!patientId && !patientName) {
    throw new Error('A patient is required for admission.')
  }
  if (!diagnosis?.trim()) {
    throw new Error('Diagnosis is required.')
  }

  const lockRef = doc(db, BED_LOCKS_COLLECTION, bedLockId(hospitalId, floorId, wardId, roomId, bedId))
  const admissionRef = doc(collection(db, ADMISSIONS_COLLECTION))

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef)
    if (lockSnap.exists() && lockSnap.data().activeAdmissionId) {
      throw new Error('This bed is already occupied.')
    }

    transaction.set(lockRef, { hospitalId, activeAdmissionId: admissionRef.id, updatedAt: serverTimestamp() })
    transaction.set(admissionRef, {
      hospitalId,
      patientId: patientId || null,
      patientName: (patientName || '').trim(),
      patientPhone: (patientPhone || '').trim(),
      floorId,
      floorName,
      wardId,
      wardName,
      roomId,
      roomName,
      bedId,
      bedType,
      dailyRate: Number(dailyRate) || 0,
      status: 'active',
      admittedAt: serverTimestamp(),
      dischargedAt: null,
      dischargedBy: null,
      dischargeSummary: '',
      admittedBy,
      attendingDoctor: attendingDoctor || '',
      attendingDoctorId: attendingDoctorId || null,
      diagnosis: diagnosis.trim(),
      notes: (notes || '').trim(),
      totalDays: 0,
      totalCharges: 0,
      linkedAppointmentId: linkedAppointmentId || null,
      linkedInvoiceId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  return admissionRef.id
}

// Moves an active admission to a different bed WITHOUT discharging it — same
// admission doc, same admittedAt, same eventual invoice (see the comment
// this function already had for why that matters). Now claims the
// destination bedLock and releases the source one inside the same
// transaction as the admission update, instead of a separate query-then-
// write conflict check.
export async function transferAdmission(admission, destination, transferredBy) {
  const { id: admissionId, hospitalId } = admission || {}
  if (!admissionId || !destination?.bedId) {
    throw new Error('Admission and destination bed are required.')
  }

  const oldLockRef = doc(db, BED_LOCKS_COLLECTION, bedLockId(hospitalId, admission.floorId, admission.wardId, admission.roomId, admission.bedId))
  const newLockRef = doc(db, BED_LOCKS_COLLECTION, bedLockId(hospitalId, destination.floorId, destination.wardId, destination.roomId, destination.bedId))
  const admissionRef = doc(db, ADMISSIONS_COLLECTION, admissionId)
  const sameBed = oldLockRef.path === newLockRef.path

  await runTransaction(db, async (transaction) => {
    // All reads before any writes.
    const newLockSnap = sameBed ? null : await transaction.get(newLockRef)
    if (newLockSnap?.exists() && newLockSnap.data().activeAdmissionId) {
      throw new Error('The destination bed is already occupied.')
    }

    if (!sameBed) {
      transaction.set(oldLockRef, { hospitalId, activeAdmissionId: null, updatedAt: serverTimestamp() })
      transaction.set(newLockRef, { hospitalId, activeAdmissionId: admissionId, updatedAt: serverTimestamp() })
    }

    transaction.update(admissionRef, {
      floorId: destination.floorId,
      floorName: destination.floorName,
      wardId: destination.wardId || null,
      wardName: destination.wardName || null,
      roomId: destination.roomId || null,
      roomName: destination.roomName || null,
      bedId: destination.bedId,
      bedType: destination.bedType,
      dailyRate: Number(destination.dailyRate) || 0,
      transferHistory: arrayUnion({
        fromBedId: admission.bedId,
        fromFloorName: admission.floorName || null,
        fromWardName: admission.wardName || null,
        fromRoomName: admission.roomName || null,
        toBedId: destination.bedId,
        toFloorName: destination.floorName,
        toWardName: destination.wardName || null,
        toRoomName: destination.roomName || null,
        transferredAt: new Date(),
        transferredBy,
      }),
      updatedAt: serverTimestamp(),
    })
  })
}

// Discharges an admission and releases its bedLock in the same transaction
// (reads the admission fresh to know its current bed position, rather than
// trusting a possibly-stale caller-supplied one).
export async function dischargePatient(admissionId, { dischargeSummary, dischargedBy, totalDays, totalCharges }) {
  const admissionRef = doc(db, ADMISSIONS_COLLECTION, admissionId)

  await runTransaction(db, async (transaction) => {
    const admissionSnap = await transaction.get(admissionRef)
    if (!admissionSnap.exists()) throw new Error('Admission not found.')
    const admission = admissionSnap.data()

    const lockRef = doc(
      db,
      BED_LOCKS_COLLECTION,
      bedLockId(admission.hospitalId, admission.floorId, admission.wardId, admission.roomId, admission.bedId)
    )
    transaction.set(lockRef, { hospitalId: admission.hospitalId, activeAdmissionId: null, updatedAt: serverTimestamp() })

    transaction.update(admissionRef, {
      status: 'discharged',
      dischargedAt: serverTimestamp(),
      dischargedBy,
      dischargeSummary: (dischargeSummary || '').trim(),
      totalDays,
      totalCharges,
      updatedAt: serverTimestamp(),
    })
  })
}
