import { ROLES } from '../utils/roles'

// The single source of truth for every module in the hospital staff portal
// (/dashboard). Nothing here talks to Firestore — this is a static catalog
// a developer edits when a module is created. Whether a given hospital may
// actually use a non-core module is tenant data, decided by the Super Admin
// and stored in the `hospitalFeatures` Firestore collection (see
// src/firebase/hospitalFeatures.js) — never in this file.
//
// See NEW_MODULE_DEVELOPMENT_GUIDE.md for the full checklist to add an entry
// here when building a new module.
export const FEATURE_CATEGORIES = {
  CORE: 'core',
  CLINICAL: 'clinical',
  ENGAGEMENT: 'engagement',
  OPERATIONS: 'operations',
}

// isCore: true means every hospital always has it — it's not shown as a
// toggle in the Super Admin Feature Management panel, and RequireFeature/
// isFeatureEnabled treat it as permanently on regardless of what (if
// anything) is stored for that key in hospitalFeatures.
export const FEATURE_REGISTRY = [
  {
    key: 'overview',
    label: 'Overview',
    description: "Daily summary and stats for the hospital's staff dashboard.",
    icon: 'overview',
    path: 'overview',
    allowedRoles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR],
    category: FEATURE_CATEGORIES.CORE,
    isCore: true,
  },
  {
    key: 'appointments',
    label: 'Appointments',
    description: 'Book, confirm, reschedule and track patient appointments.',
    icon: 'appointments',
    path: 'appointments',
    allowedRoles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR],
    category: FEATURE_CATEGORIES.CORE,
    isCore: true,
  },
  {
    key: 'patients',
    label: 'Patients',
    description: 'Patient records for this hospital.',
    icon: 'patients',
    path: 'patients',
    allowedRoles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST],
    category: FEATURE_CATEGORIES.CORE,
    isCore: true,
  },
  {
    key: 'staff',
    label: 'Staff',
    description: 'Manage doctor and receptionist accounts for this hospital.',
    icon: 'staff',
    path: 'staff',
    allowedRoles: [ROLES.HOSPITAL_ADMIN],
    category: FEATURE_CATEGORIES.CORE,
    isCore: true,
  },
  {
    key: 'doctors',
    label: 'Doctors',
    description: "Read-only view of the hospital's doctor directory and schedules.",
    icon: 'doctors',
    path: 'doctors',
    allowedRoles: [ROLES.RECEPTIONIST],
    category: FEATURE_CATEGORIES.CORE,
    isCore: true,
  },
  {
    key: 'schedule',
    label: 'My Schedule',
    description: 'A doctor manages their own availability.',
    icon: 'schedule',
    path: 'schedule',
    allowedRoles: [ROLES.DOCTOR],
    category: FEATURE_CATEGORIES.CORE,
    isCore: true,
  },
  {
    key: 'profile',
    label: 'My Profile',
    description: 'Edit your public profile shown to patients.',
    icon: 'profile',
    path: 'profile',
    allowedRoles: [ROLES.DOCTOR],
    category: FEATURE_CATEGORIES.CORE,
    isCore: true,
  },
  {
    key: 'chatbot',
    label: 'Chatbot',
    description: 'AI assistant that helps patients book appointments, ask hospital questions and navigate services.',
    icon: 'chat',
    path: 'chatbot',
    allowedRoles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST],
    category: FEATURE_CATEGORIES.ENGAGEMENT,
    isCore: false,
    defaultEnabled: false,
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Generate itemized invoices for visits and track paid/due status.',
    icon: 'billing',
    path: 'billing',
    allowedRoles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST],
    category: FEATURE_CATEGORIES.OPERATIONS,
    isCore: false,
    defaultEnabled: false,
  },
  {
    key: 'prescriptions',
    label: 'Prescriptions',
    description: 'Searchable prescription history with a printable, letterhead-style prescription document.',
    icon: 'prescription',
    path: 'prescriptions',
    allowedRoles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR],
    category: FEATURE_CATEGORIES.CLINICAL,
    isCore: false,
    defaultEnabled: false,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Revenue reports, appointment trends, doctor performance and operational insights.',
    icon: 'analytics',
    path: 'analytics',
    allowedRoles: [ROLES.HOSPITAL_ADMIN],
    category: FEATURE_CATEGORIES.OPERATIONS,
    isCore: false,
    defaultEnabled: false,
  },
  {
    key: 'bedManagement',
    label: 'Beds & Wards',
    description: 'Manage hospital beds, wards, rooms and inpatient admissions.',
    icon: 'bed',
    path: 'beds',
    allowedRoles: [ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST],
    category: FEATURE_CATEGORIES.OPERATIONS,
    isCore: false,
    defaultEnabled: false,
  },
  {
    key: 'activityLog',
    label: 'Activity Log',
    description: 'Who voided an invoice, deactivated a staff member, changed permissions or cancelled an appointment, and when.',
    icon: 'clipboard',
    path: 'activity-log',
    allowedRoles: [ROLES.HOSPITAL_ADMIN],
    category: FEATURE_CATEGORIES.OPERATIONS,
    // Off by default, unlike most other CORE modules — most hospitals never
    // need to look at their own audit trail day-to-day, so there's no reason
    // to default every hospital into it. Super Admin can turn it on per
    // hospital from here same as any other module — but Super Admin's OWN
    // access to any hospital's log is never gated by this flag at all (see
    // firestore.rules' /activityLog read rule and
    // HospitalActivityLogPanel): it's primarily their own oversight/support
    // tool, and stays available even for hospitals that never opt in.
    isCore: false,
    defaultEnabled: false,
  },
]

export function getFeatureDefinition(key) {
  return FEATURE_REGISTRY.find((feature) => feature.key === key) || null
}

export function isCoreFeature(key) {
  return getFeatureDefinition(key)?.isCore === true
}
