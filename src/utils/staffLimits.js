import { ROLES } from './roles'

// Which plan limit (src/config/limitsRegistry.js) governs a given staff
// role's seat count. RECEPTIONIST/DOCTOR seats are set by Super Admin and
// spent by either Super Admin or a Hospital Admin (via StaffFormModal);
// HOSPITAL_ADMIN seats are only ever spent by Super Admin, since a Hospital
// Admin can't create another one (see CREATABLE_STAFF_ROLES_BY_HOSPITAL_ADMIN
// in roles.js).
const LIMIT_KEY_BY_ROLE = {
  [ROLES.DOCTOR]: 'maxDoctors',
  [ROLES.RECEPTIONIST]: 'maxReceptionists',
  [ROLES.HOSPITAL_ADMIN]: 'maxHospitalAdmins',
}

export function limitKeyForRole(role) {
  return LIMIT_KEY_BY_ROLE[role] || null
}

// Deactivated staff free up a seat — this matches how "active staff" is
// already counted and surfaced elsewhere (e.g. StaffPage.jsx's header).
export function countActiveStaffByRole(staff, role) {
  return staff.filter((s) => s.role === role && s.status === 'active').length
}

// `null`/missing limit means Unlimited (see limitsRegistry.js) — never at cap.
export function isAtStaffCap(staff, limits, role) {
  const key = limitKeyForRole(role)
  if (!key || !limits) return false
  const max = limits[key]
  if (max === null || max === undefined) return false
  return countActiveStaffByRole(staff, role) >= max
}
