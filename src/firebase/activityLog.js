import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from './config'

const ACTIVITY_LOG_COLLECTION = 'activityLog'

// Hospital-wide, append-only record of sensitive staff actions — see
// firestore.rules' /activityLog match for why entries can never be edited
// or deleted once written, and who can read them (that hospital's own
// admin, or Super Admin — never Doctors/Receptionists). Call this
// immediately after the real action already succeeded; logging is
// best-effort and must never block or fail the action it's recording, same
// division as autoCreateConsultationInvoice in billing.js.
export function logActivity({ hospitalId, action, actorUid, actorEmail, targetType, targetId, targetLabel, details }) {
  return addDoc(collection(db, ACTIVITY_LOG_COLLECTION), {
    hospitalId,
    action,
    actorUid: actorUid || null,
    actorEmail: actorEmail || null,
    targetType: targetType || null,
    targetId: targetId || null,
    targetLabel: targetLabel || '',
    details: details || '',
    createdAt: serverTimestamp(),
  }).catch(() => {})
}

export function subscribeActivityLog(hospitalId, callback) {
  const q = query(collection(db, ACTIVITY_LOG_COLLECTION), where('hospitalId', '==', hospitalId))
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    entries.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(entries)
  })
}

// Human-readable label per action key — shared by whatever renders the feed.
export const ACTIVITY_LABELS = {
  'invoice.voided': 'Voided an invoice',
  'staff.deactivated': 'Deactivated a staff member',
  'staff.reactivated': 'Reactivated a staff member',
  'staff.created': 'Created a staff account',
  'staff.permissions_changed': "Changed a staff member's permissions",
  'staff.billing_access_changed': "Changed a receptionist's billing access",
  'appointment.cancelled': 'Cancelled an appointment',
}
