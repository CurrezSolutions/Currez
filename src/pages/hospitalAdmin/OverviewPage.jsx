import { useAuth } from '../../contexts/AuthContext'
import { useHospitalData } from '../../contexts/HospitalDataContext'
import { ROLES } from '../../utils/roles'
import { todayDateString } from '../../utils/dates'
import StatCard from '../../components/superadmin/StatCard'
import StatusBadge from '../../components/superadmin/StatusBadge'
import PlanLimitsPanel from '../../components/hospitalAdmin/PlanLimitsPanel'
import DoctorOverviewPage from './DoctorOverviewPage'

function OverviewPage() {
  const { role } = useAuth()
  if (role === ROLES.DOCTOR) return <DoctorOverviewPage />
  return <HospitalOverview />
}

function HospitalOverview() {
  const { role } = useAuth()
  const { hospital, appointments, patients, staff, limits } = useHospitalData()

  const today = todayDateString()
  const todaysAppointments = appointments.filter((a) => a.date === today)
  const doctorCount = staff.filter((s) => s.role === ROLES.DOCTOR && s.status === 'active').length
  const pendingCount = todaysAppointments.filter((a) => a.status === 'pending').length
  const completedCount = todaysAppointments.filter((a) => a.status === 'completed').length
  // Matches what actually counts against the plan's daily patient cap (see
  // checkAndClaimDailyPatientSlot in src/firebase/appointments.js): a
  // `pending` self-booking isn't confirmed yet and doesn't count, so this
  // stays lower than todaysAppointments.length until reception confirms it.
  const confirmedTodayCount = todaysAppointments.filter((a) => a.status === 'scheduled' || a.status === 'completed').length

  const greetingTime = new Date().getHours()
  const greeting = greetingTime < 12 ? 'Good morning' : greetingTime < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-100">{greeting}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{hospital?.title}</h1>
          <p className="mt-2 max-w-lg text-sm text-indigo-100/80">
            Here's what's happening at your hospital today. You have{' '}
            <span className="font-semibold text-white">{todaysAppointments.length} appointments</span>
            {pendingCount > 0 && (
              <> — <span className="font-semibold text-amber-200">{pendingCount} pending confirmation</span></>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Appointments" value={todaysAppointments.length} hint="Total scheduled for today" icon="appointments" />
        <StatCard label="Active Doctors" value={doctorCount} hint="Currently on staff" icon="doctors" />
        <StatCard label="Total Patients" value={patients.length} hint="Registered patients" icon="patients" />
        <StatCard label="Completed Today" value={completedCount} hint={`${todaysAppointments.length - completedCount} remaining`} icon="schedule" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-heading">Hospital Details</h2>
            <StatusBadge status={hospital.status} />
          </div>
          <dl className="mt-4 space-y-3">
            <div className="flex justify-between gap-4 rounded-xl bg-card-strong/50 px-4 py-2.5">
              <dt className="text-sm text-muted">Name</dt>
              <dd className="text-right text-sm font-medium text-heading">{hospital.title}</dd>
            </div>
            {hospital.footer?.address && (
              <div className="flex justify-between gap-4 rounded-xl bg-card-strong/50 px-4 py-2.5">
                <dt className="text-sm text-muted">Address</dt>
                <dd className="text-right text-sm font-medium text-heading">{hospital.footer.address}</dd>
              </div>
            )}
            {hospital.footer?.phone && (
              <div className="flex justify-between gap-4 rounded-xl bg-card-strong/50 px-4 py-2.5">
                <dt className="text-sm text-muted">Phone</dt>
                <dd className="text-right text-sm font-medium text-heading">{hospital.footer.phone}</dd>
              </div>
            )}
            {hospital.footer?.email && (
              <div className="flex justify-between gap-4 rounded-xl bg-card-strong/50 px-4 py-2.5">
                <dt className="text-sm text-muted">Email</dt>
                <dd className="text-right text-sm font-medium text-heading">{hospital.footer.email}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-heading">Today's Appointments</h2>
          {todaysAppointments.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                <svg className="h-6 w-6 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3M16 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-muted">No appointments today</p>
              <p className="mt-1 text-xs text-faint">New bookings will appear here</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {todaysAppointments.slice(0, 6).map((appt) => (
                <div key={appt.id} className="flex items-center justify-between rounded-xl bg-card-strong/50 px-4 py-2.5 transition-colors hover:bg-card-strong">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-heading">{appt.patientName}</p>
                    <p className="text-xs text-faint">{appt.time || 'No time set'}</p>
                  </div>
                  <span className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                    appt.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400'
                      : appt.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400'
                      : 'bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-400'
                  }`}>
                    {appt.status}
                  </span>
                </div>
              ))}
              {todaysAppointments.length > 6 && (
                <p className="pt-1 text-center text-xs text-faint">
                  +{todaysAppointments.length - 6} more appointments
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {role === ROLES.HOSPITAL_ADMIN && (
        <PlanLimitsPanel staff={staff} patientsToday={confirmedTodayCount} limits={limits} />
      )}
    </div>
  )
}

export default OverviewPage
