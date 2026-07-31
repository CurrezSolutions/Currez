import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from './config'

const PATIENTS_COLLECTION = 'patients'
const PATIENTS_BY_PHONE_COLLECTION = 'patientsByPhone'

// A single phone number (a family's shared phone, for example) may only ever
// have this many distinct patient records at one hospital — past this, the
// booking form and the doctor's "Find Patient" page both expect the caller
// to pick one of the existing patients instead of registering another one.
export const MAX_PATIENTS_PER_PHONE = 5

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '')
}

function patientsByPhoneId(hospitalId, phone) {
  return `${hospitalId}::${normalizePhone(phone)}`
}

export function subscribePatients(hospitalId, callback) {
  const q = query(collection(db, PATIENTS_COLLECTION), where('hospitalId', '==', hospitalId))
  return onSnapshot(q, (snapshot) => {
    const patients = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    patients.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(patients)
  })
}

// One-off (non-realtime) lookup of every patient already registered under a
// phone number at this hospital — reads the PII-light patientsByPhone index
// (just { id, name } per entry) instead of the patients collection itself,
// which is what lets the unauthenticated public booking form offer "is this
// you?" before creating a duplicate record, the same way doctorSlots lets it
// see taken appointment times without any query access to appointments.
export async function getPatientsByPhone(hospitalId, phone) {
  if (!normalizePhone(phone)) return []
  const snap = await getDoc(doc(db, PATIENTS_BY_PHONE_COLLECTION, patientsByPhoneId(hospitalId, phone)))
  return snap.exists() ? snap.data().patients || [] : []
}

// Transactional so the per-phone cap can't be raced past by two concurrent
// bookings for the same number: reads the current count off patientsByPhone,
// throws before creating anything if it's already at MAX_PATIENTS_PER_PHONE,
// otherwise creates the patient and appends { id, name } to the index doc in
// the same atomic write.
export async function createPatient(hospitalId, { name, phone, email }, createdBy) {
  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()
  const ref = doc(collection(db, PATIENTS_COLLECTION))
  const lookupRef = doc(db, PATIENTS_BY_PHONE_COLLECTION, patientsByPhoneId(hospitalId, trimmedPhone))

  await runTransaction(db, async (transaction) => {
    const existing = trimmedPhone
      ? (await transaction.get(lookupRef)).data()?.patients || []
      : []

    if (existing.length >= MAX_PATIENTS_PER_PHONE) {
      throw new Error(
        `This phone number already has ${MAX_PATIENTS_PER_PHONE} patients registered. Please select one of the existing patients instead of adding a new one.`
      )
    }

    transaction.set(ref, {
      hospitalId,
      name: trimmedName,
      phone: trimmedPhone,
      email: email?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy,
    })

    if (trimmedPhone) {
      transaction.set(
        lookupRef,
        {
          hospitalId,
          phone: normalizePhone(trimmedPhone),
          patients: [...existing, { id: ref.id, name: trimmedName }],
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    }
  })

  return ref.id
}

export function updatePatient(patientId, patch) {
  return updateDoc(doc(db, PATIENTS_COLLECTION, patientId), { ...patch, updatedAt: serverTimestamp() })
}
