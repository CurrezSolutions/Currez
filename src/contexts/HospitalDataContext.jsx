import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeHospital } from '../firebase/hospitals'
import { subscribeUsersByHospital } from '../firebase/users'
import { subscribePatients } from '../firebase/patients'
import { subscribeAppointments } from '../firebase/appointments'
import { subscribeToHospitalLimits } from '../firebase/hospitalLimits'
import { shiftDateString } from '../utils/dates'

const HospitalDataContext = createContext(null)

// Wide enough to cover every page that reads appointments — Prescriptions'
// 365-day history and Billing's 90-day invoicing window both fit inside this
// one subscription; each page narrows it further client-side (by date) so
// there is exactly one live `appointments` listener per session instead of
// one per page.
const APPOINTMENTS_WINDOW_DAYS = 365

const EMPTY_STATE = { hospital: undefined, staff: null, patients: null, appointments: null, limits: undefined }

// Lives inside /dashboard, mounted once per session (alongside
// FeatureProvider) — the single source of truth for the hospital doc, staff
// directory, patient directory and a shared appointments window. Every page
// under /dashboard used to open its own onSnapshot for these same
// collections, so navigating Overview -> Appointments -> Patients -> Staff
// -> Billing re-read the full staff/patients/appointments collections from
// the server on every click. Reading through useHospitalData() instead means
// each collection is subscribed exactly once for the whole portal session.
export function HospitalDataProvider({ tenantSlug, children }) {
  const [state, setState] = useState(EMPTY_STATE)

  useEffect(() => {
    setState(EMPTY_STATE)
    if (!tenantSlug) return

    const windowStart = shiftDateString(-APPOINTMENTS_WINDOW_DAYS)
    const unsubHospital = subscribeHospital(tenantSlug, (hospital) =>
      setState((prev) => ({ ...prev, hospital }))
    )
    const unsubStaff = subscribeUsersByHospital(tenantSlug, (staff) =>
      setState((prev) => ({ ...prev, staff }))
    )
    const unsubPatients = subscribePatients(tenantSlug, (patients) =>
      setState((prev) => ({ ...prev, patients }))
    )
    const unsubAppointments = subscribeAppointments(
      tenantSlug,
      (appointments) => setState((prev) => ({ ...prev, appointments })),
      windowStart
    )
    const unsubLimits = subscribeToHospitalLimits(tenantSlug, (limits) =>
      setState((prev) => ({ ...prev, limits }))
    )

    return () => {
      unsubHospital()
      unsubStaff()
      unsubPatients()
      unsubAppointments()
      unsubLimits()
    }
  }, [tenantSlug])

  const value = useMemo(() => {
    const { hospital, staff, patients, appointments, limits } = state
    return {
      hospital,
      staff: staff || [],
      patients: patients || [],
      appointments: appointments || [],
      limits,
      ready: hospital !== undefined && staff !== null && patients !== null && appointments !== null,
    }
  }, [state])

  return <HospitalDataContext.Provider value={value}>{children}</HospitalDataContext.Provider>
}

export function useHospitalData() {
  const context = useContext(HospitalDataContext)
  if (!context) throw new Error('useHospitalData must be used within a HospitalDataProvider')
  return context
}
