// The single source of truth for every plan limit a Super Admin can set for
// a hospital (staff seats, daily patient volume, monthly email notifications
// — the same dimensions marketed on the pricing page, see PRICING_TIERS in
// src/pages/CompanyLandingPage.jsx). Nothing here talks to Firestore — that's
// src/firebase/hospitalLimits.js, which stores the actual per-hospital values
// keyed by these `key`s. `null` always means "Unlimited" for a limit's value.
//
// See NEW_MODULE_DEVELOPMENT_GUIDE.md-style convention: add a new limit here
// and it shows up automatically in LimitsManagementPanel — no other UI change
// needed. If you add a limit that should also be enforced (not just
// displayed), wire the enforcement where the resource is created (see
// createAppointment in src/firebase/appointments.js for the daily-patient-cap
// example) and keep firestore.rules' hardcoded defaults in sync.
export const LIMITS_REGISTRY = [
  {
    key: 'maxDoctors',
    label: 'Doctors',
    description: 'How many doctor accounts this hospital may add.',
    icon: 'doctors',
    unit: 'doctors',
    default: 3,
    presets: [1, 3, 6, 12],
  },
  {
    key: 'maxReceptionists',
    label: 'Staff (Receptionists)',
    description: 'How many receptionist/front-desk accounts this hospital may add.',
    icon: 'staff',
    unit: 'staff',
    default: 2,
    presets: [2, 4, 8, 15],
  },
  {
    key: 'maxHospitalAdmins',
    label: 'Hospital Admins',
    description: 'How many Hospital Admin accounts this hospital may have (created by Super Admin only).',
    icon: 'profile',
    unit: 'admins',
    default: 1,
    presets: [1, 2, 3, 5],
  },
  {
    key: 'maxPatientsPerDay',
    label: 'Patients / day',
    description: 'Daily cap on new appointments booked across the whole hospital, enforced at booking time.',
    icon: 'patients',
    unit: 'patients/day',
    default: 60,
    presets: [60, 100, 200, 500],
  },
  {
    key: 'maxEmailsPerMonth',
    label: 'Email notifications / month',
    description: 'Included email notification allowance per month.',
    icon: 'mail',
    unit: 'emails/mo',
    default: 500,
    presets: [200, 500, 1000, 2500, 10000],
  },
]

export function getLimitDefinition(key) {
  return LIMITS_REGISTRY.find((limit) => limit.key === key) || null
}

// Human-friendly rendering of a limit value — shared by the Super Admin
// editor and the hospital-admin usage view so "Unlimited" is spelled the
// same way everywhere.
export function formatLimitValue(value, unit) {
  if (value === null || value === undefined) return 'Unlimited'
  return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`
}
