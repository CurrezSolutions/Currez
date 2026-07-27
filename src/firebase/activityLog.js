import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, startAfter, where } from 'firebase/firestore'
import { db } from './config'

const ACTIVITY_LOG_COLLECTION = 'activityLog'

// One "page" per read — an audit log only ever grows, so there's no reason
// to pull more than a screenful at a time (see fetchActivityLogPage below).
const PAGE_SIZE = 25

// Hospital-wide, append-only record of sensitive staff/admin actions — see
// firestore.rules' /activityLog match for why entries can never be edited
// or deleted once written, and who can read them (that hospital's own
// admin — only once Super Admin has turned the Activity Log module on for
// them — or Super Admin, always, for every hospital). Call this immediately
// after the real action already succeeded; logging is best-effort and must
// never block or fail the action it's recording, same division as
// autoCreateConsultationInvoice in billing.js.
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

// One-off, paginated fetch — deliberately NOT a live onSnapshot listener.
// An audit log is historical by nature and only ever grows; a live listener
// on the whole collection would re-read every entry on mount and then every
// single write anywhere in the hospital, forever, for as long as the page
// stayed open — the exact "more calls to Firebase" this is meant to avoid.
// Callers that want fresh data call this again (see useActivityLog's
// `reload`) instead of paying for a permanently open, ever-more-expensive
// listener. `cursor` is the last QueryDocumentSnapshot from a previous page
// (pass `page.cursor` back in to fetch the next one).
export async function fetchActivityLogPage(hospitalId, { cursor } = {}) {
  const constraints = [where('hospitalId', '==', hospitalId), orderBy('createdAt', 'desc')]
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(PAGE_SIZE))

  const snapshot = await getDocs(query(collection(db, ACTIVITY_LOG_COLLECTION), ...constraints))
  const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  return {
    entries,
    cursor: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === PAGE_SIZE,
  }
}

// Walks every page for a hospital's full history — only ever called from an
// explicit, manual "Download" action (see HospitalActivityLogPanel), never
// on page load, so its cost is bounded by how often someone actually
// exports, not by how often the page is viewed.
export async function fetchAllActivityLogEntries(hospitalId) {
  const entries = []
  let cursor = null
  for (;;) {
    const page = await fetchActivityLogPage(hospitalId, { cursor })
    entries.push(...page.entries)
    if (!page.hasMore) break
    cursor = page.cursor
  }
  return entries
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
  'hospital.feature_toggled': 'Turned a module on/off',
  'hospital.limit_changed': 'Changed a plan limit',
  'hospital.status_changed': 'Changed hospital status',
  'admission.admitted': 'Admitted a patient',
  'admission.discharged': 'Discharged a patient',
  'admission.transferred': 'Transferred a patient to another bed',
}
