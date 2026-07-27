import NavIcon from '../common/NavIcon'
import { ROLES } from '../../utils/roles'
import { countActiveStaffByRole } from '../../utils/staffLimits'

// Hospital-Admin-facing view of the same limits Super Admin sets in
// LimitsManagementPanel (src/components/superadmin/LimitsManagementPanel.jsx)
// — read-only here, matching firestore.rules' hospitalLimits get rule
// (staff may read their own hospital's limits, only Super Admin may write
// them). Lives on the Overview page since that's the one screen every
// Hospital Admin already lands on.
function PlanLimitsPanel({ staff, patientsToday, limits }) {
  if (!limits) return null

  const rows = [
    {
      icon: 'doctors',
      label: 'Doctors',
      used: countActiveStaffByRole(staff, ROLES.DOCTOR),
      max: limits.maxDoctors,
    },
    {
      icon: 'staff',
      label: 'Staff (Receptionists)',
      used: countActiveStaffByRole(staff, ROLES.RECEPTIONIST),
      max: limits.maxReceptionists,
    },
    {
      icon: 'profile',
      label: 'Hospital Admins',
      used: countActiveStaffByRole(staff, ROLES.HOSPITAL_ADMIN),
      max: limits.maxHospitalAdmins,
    },
    {
      icon: 'patients',
      label: 'Confirmed patients today',
      used: patientsToday,
      max: limits.maxPatientsPerDay,
    },
  ]

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-heading">Your Plan Limits</h2>
        <span className="rounded-full bg-card-strong px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Set by Currez
        </span>
      </div>
      <p className="mt-1 text-xs text-faint">
        Need more room? Contact your plan administrator to raise any of these limits.
      </p>

      <div className="mt-4 space-y-3.5">
        {rows.map((row) => (
          <LimitUsageRow key={row.label} {...row} />
        ))}
        <p className="text-[11px] text-faint">
          "Confirmed patients today" only counts appointments once reception confirms them — a pending,
          unconfirmed self-booking doesn't use up a slot until then.
        </p>

        <div className="flex items-center justify-between rounded-xl bg-card-strong/50 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card-strong text-faint">
              <NavIcon name="mail" className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm text-body">Email notifications / month</span>
          </div>
          <span className="text-sm font-medium text-heading">
            {limits.maxEmailsPerMonth === null ? 'Unlimited' : `${limits.maxEmailsPerMonth.toLocaleString()} included`}
          </span>
        </div>
        <p className="text-[11px] text-faint">
          Email sending isn't wired up in this build yet — this is the allowance your plan includes for when it is.
        </p>
      </div>
    </div>
  )
}

function LimitUsageRow({ icon, label, used, max }) {
  const unlimited = max === null || max === undefined
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100))
  const atCap = !unlimited && used >= max
  const nearCap = !unlimited && !atCap && pct >= 80

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card-strong text-faint">
            <NavIcon name={icon} className="h-3.5 w-3.5" />
          </span>
          <span className="text-body">{label}</span>
        </div>
        <span
          className={`font-medium ${
            atCap ? 'text-red-500' : nearCap ? 'text-amber-600 dark:text-amber-400' : 'text-heading'
          }`}
        >
          {used} / {unlimited ? '∞' : max}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-1.5 ml-9.5 h-1.5 overflow-hidden rounded-full bg-card-strong">
          <div
            className={`h-full rounded-full transition-all ${
              atCap ? 'bg-red-500' : nearCap ? 'bg-amber-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default PlanLimitsPanel
