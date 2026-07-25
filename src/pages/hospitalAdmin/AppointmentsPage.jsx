import { useMemo, useState } from 'react'
import { updateAppointmentStatus } from '../../firebase/appointments'
import { logActivity } from '../../firebase/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { useHospitalData } from '../../contexts/HospitalDataContext'
import { ROLES } from '../../utils/roles'
import { canEditModule } from '../../utils/permissions'
import { isTimeWithinSchedule } from '../../utils/doctorSchedule'
import { shiftDateString } from '../../utils/dates'
import { TABS, TAB_TODAY, categorizeAppointments } from '../../utils/appointmentFilters'
import BookAppointmentModal from '../../components/hospitalAdmin/BookAppointmentModal'
import ConfirmPaymentModal from '../../components/hospitalAdmin/ConfirmPaymentModal'
import CompleteVisitModal from '../../components/hospitalAdmin/CompleteVisitModal'
import RescheduleAppointmentModal from '../../components/hospitalAdmin/RescheduleAppointmentModal'
import ConfirmModal from '../../components/common/ConfirmModal'
import NavIcon from '../../components/common/NavIcon'
import Pagination from '../../components/common/Pagination'

const STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  scheduled: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400',
  completed: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  cancelled: 'bg-card-strong text-muted ring-line',
}

const STATUS_LABELS = {
  pending: 'Pending',
  scheduled: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const PAYMENT_LABELS = { cash: 'Cash', online: 'Online' }

function AppointmentStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.scheduled
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function AppointmentsPage({ tenantSlug }) {
  const { role, user, userDoc } = useAuth()
  const weekAgo = shiftDateString(-7)
  const weekLater = shiftDateString(7)
  const isDoctor = role === ROLES.DOCTOR
  // Super-Admin-assigned permission (see src/utils/permissions.js) narrows
  // this further — a role that could normally book/confirm/complete may
  // still be restricted to view-only for this specific staff member.
  const canEdit = canEditModule(userDoc, 'appointments')
  const canBook = (role === ROLES.HOSPITAL_ADMIN || role === ROLES.RECEPTIONIST) && canEdit
  const canConfirm = canBook
  const canViewNotes = isDoctor || role === ROLES.HOSPITAL_ADMIN

  const { appointments: allAppointments, patients, staff } = useHospitalData()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState(TAB_TODAY)
  const [currentPage, setCurrentPage] = useState(1)
  const [showBookModal, setShowBookModal] = useState(false)
  const [confirmingAppointment, setConfirmingAppointment] = useState(null)
  const [completingAppt, setCompletingAppt] = useState(null)
  const [viewingAppt, setViewingAppt] = useState(null)
  const [reschedulingAppt, setReschedulingAppt] = useState(null)
  const [cancellingAppt, setCancellingAppt] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const PAGE_SIZE = 10

  async function handleCancelConfirmed() {
    if (!cancellingAppt) return
    setCancelling(true)
    try {
      await updateAppointmentStatus(cancellingAppt.id, 'cancelled')
      logActivity({
        hospitalId: tenantSlug,
        action: 'appointment.cancelled',
        actorUid: user.uid,
        actorEmail: user.email,
        targetType: 'appointment',
        targetId: cancellingAppt.id,
        targetLabel: `${cancellingAppt.patientName || 'Unknown'} — ${cancellingAppt.date} ${cancellingAppt.time || ''}`.trim(),
      })
      setCancellingAppt(null)
    } finally {
      setCancelling(false)
    }
  }

  // The shared context holds a much wider window (365 days back, unbounded
  // forward) than this page needs — narrow it to the ±7 day operational
  // view here instead of opening a second, differently-windowed listener.
  const appointments = useMemo(
    () => allAppointments.filter((a) => a.date >= weekAgo && a.date <= weekLater),
    [allAppointments, weekAgo, weekLater]
  )

  const doctors = staff.filter((s) => s.role === ROLES.DOCTOR && s.status === 'active')
  const doctorsById = useMemo(
    () => Object.fromEntries(staff.filter((s) => s.role === ROLES.DOCTOR).map((d) => [d.uid, d])),
    [staff]
  )

  function hasScheduleConflict(appt) {
    if (appt.status !== 'scheduled' || !appt.doctorId || !appt.time) return false
    const doctor = doctorsById[appt.doctorId]
    if (!doctor) return false
    return !isTimeWithinSchedule(doctor.schedule, appt.date, appt.time)
  }

  const visible = useMemo(() => {
    let list = isDoctor
      ? appointments.filter((a) => a.doctorId === user.uid && a.status !== 'pending')
      : appointments
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) => a.patientName?.toLowerCase().includes(q) || a.patientPhone?.toLowerCase().includes(q)
      )
    }
    return list
  }, [appointments, isDoctor, user.uid, search])

  const categorized = useMemo(() => categorizeAppointments(visible), [visible])

  const tabItems = useMemo(() => categorized[activeTab] || [], [categorized, activeTab])
  const totalPages = Math.ceil(tabItems.length / PAGE_SIZE)
  const paginatedItems = useMemo(
    () => tabItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [tabItems, currentPage]
  )

  // Reset to page 1 when search or tab changes
  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setCurrentPage(1)
  }
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  // Shared between the desktop table row and the mobile card so the two
  // views can never drift out of sync on which actions are available.
  function renderActions(appt) {
    return (
      <>
        {appt.status === 'pending' && canConfirm && (
          <button
            onClick={() => setConfirmingAppointment(appt)}
            className="cursor-pointer rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-300"
          >
            Confirm
          </button>
        )}
        {appt.status === 'scheduled' && canEdit && (
          <>
            {canBook && (
              <button
                onClick={() => setReschedulingAppt(appt)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  hasScheduleConflict(appt)
                    ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400'
                    : 'text-muted hover:bg-card-strong hover:text-heading'
                }`}
              >
                Reschedule
              </button>
            )}
            <button
              onClick={() =>
                isDoctor ? setCompletingAppt(appt) : updateAppointmentStatus(appt.id, 'completed')
              }
              className="cursor-pointer rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              Complete
            </button>
            <button
              onClick={() => setCancellingAppt(appt)}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            >
              Cancel
            </button>
          </>
        )}
        {appt.status === 'completed' && canViewNotes && (
          <button
            onClick={() => setViewingAppt(appt)}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-card-strong hover:text-heading"
          >
            View notes
          </button>
        )}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-heading">{isDoctor ? 'My Appointments' : 'Appointments'}</h1>
          <p className="mt-0.5 text-sm text-muted">Manage and track patient appointments</p>
        </div>
        {canBook && (
          <button
            onClick={() => setShowBookModal(true)}
            className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/30 active:scale-[0.98]"
          >
            <NavIcon name="appointments" className="h-4 w-4" />
            Book Appointment
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Search by patient name or phone..."
        value={search}
        onChange={handleSearchChange}
        className="w-full max-w-sm rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
      />

      <div className="flex gap-1 rounded-xl bg-card-strong p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-card text-heading shadow-sm'
                : 'text-muted hover:text-heading'
            }`}
          >
            {tab.label}
            {categorized[tab.key]?.length > 0 && (
              <span className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'bg-card-strong text-faint'
              }`}>
                {categorized[tab.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile: stacked cards instead of a horizontally-scrolling table —
          one card per appointment, same data and actions as the table below. */}
      <div className="space-y-3 md:hidden">
        {paginatedItems.map((appt) => (
          <div key={appt.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-heading">{appt.patientName}</p>
                {appt.patientPhone && <p className="text-xs text-faint">{appt.patientPhone}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <AppointmentStatusBadge status={appt.status} />
                {hasScheduleConflict(appt) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-500/20 ring-inset dark:text-amber-400">
                    <NavIcon name="schedule" className="h-3 w-3" />
                    Conflict
                  </span>
                )}
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-faint">Date</dt>
              <dd className="text-right font-medium text-heading">{appt.date}</dd>
              <dt className="text-faint">Time</dt>
              <dd className="text-right text-body">{appt.time || '—'}</dd>
              {!isDoctor && (
                <>
                  <dt className="text-faint">Doctor</dt>
                  <dd className="text-right text-body">{appt.doctorName || 'Unassigned'}</dd>
                  <dt className="text-faint">Payment</dt>
                  <dd className="text-right text-body">{PAYMENT_LABELS[appt.paymentMethod] || '—'}</dd>
                </>
              )}
            </dl>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
              {renderActions(appt)}
            </div>
          </div>
        ))}
        {tabItems.length === 0 && (
          <div className="rounded-2xl border border-line bg-card px-5 py-16 text-center">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                <NavIcon name="appointments" className="h-6 w-6 text-faint" />
              </div>
              <p className="mt-3 text-sm font-medium text-muted">No {activeTab} appointments</p>
              <p className="mt-1 text-xs text-faint">Appointments will appear here once booked</p>
            </div>
          </div>
        )}
      </div>

      {tabItems.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={tabItems.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card shadow-sm md:block">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead>
            <tr className="border-b border-line bg-card-strong/30">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-faint">Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-faint">Time</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-faint">Patient</th>
              {!isDoctor && <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-faint">Doctor</th>}
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-faint">Status</th>
              {!isDoctor && <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-faint">Payment</th>}
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-faint">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paginatedItems.map((appt) => (
              <tr key={appt.id} className="group transition-colors hover:bg-card-strong/50">
                <td className="whitespace-nowrap px-5 py-3.5">
                  <span className="font-medium text-heading">{appt.date}</span>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-muted">{appt.time || '—'}</td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-heading">{appt.patientName}</div>
                  {appt.patientPhone && (
                    <div className="text-xs text-faint">{appt.patientPhone}</div>
                  )}
                </td>
                {!isDoctor && (
                  <td className="px-5 py-3.5 text-muted">{appt.doctorName || 'Unassigned'}</td>
                )}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <AppointmentStatusBadge status={appt.status} />
                    {hasScheduleConflict(appt) && (
                      <span
                        title="The doctor's schedule no longer covers this time — reschedule it."
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-500/20 ring-inset dark:text-amber-400"
                      >
                        <NavIcon name="schedule" className="h-3 w-3" />
                        Conflict
                      </span>
                    )}
                  </div>
                </td>
                {!isDoctor && (
                  <td className="px-5 py-3.5 text-muted">{PAYMENT_LABELS[appt.paymentMethod] || '—'}</td>
                )}
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">{renderActions(appt)}</div>
                </td>
              </tr>
            ))}
            {tabItems.length === 0 && (
              <tr>
                <td colSpan={isDoctor ? 5 : 7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                      <NavIcon name="appointments" className="h-6 w-6 text-faint" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-muted">No {activeTab} appointments</p>
                    <p className="mt-1 text-xs text-faint">Appointments will appear here once booked</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showBookModal && (
        <BookAppointmentModal
          hospitalId={tenantSlug}
          patients={patients}
          doctors={doctors}
          appointments={appointments}
          onCancel={() => setShowBookModal(false)}
          onCreated={() => setShowBookModal(false)}
        />
      )}

      {confirmingAppointment && (
        <ConfirmPaymentModal
          appointment={confirmingAppointment}
          doctors={doctors}
          appointments={appointments}
          onClose={() => setConfirmingAppointment(null)}
        />
      )}

      {reschedulingAppt && (
        <RescheduleAppointmentModal
          appointment={reschedulingAppt}
          doctors={doctors}
          appointments={appointments}
          onClose={() => setReschedulingAppt(null)}
        />
      )}

      {completingAppt && (
        <CompleteVisitModal
          appointment={completingAppt}
          onClose={() => setCompletingAppt(null)}
          onCompleted={() => setCompletingAppt(null)}
        />
      )}

      {viewingAppt && (
        <CompleteVisitModal appointment={viewingAppt} readOnly onClose={() => setViewingAppt(null)} />
      )}

      {cancellingAppt && (
        <ConfirmModal
          title="Cancel this appointment?"
          message={`This frees up ${cancellingAppt.doctorName ? `${cancellingAppt.doctorName}'s` : 'the'} ${cancellingAppt.time || ''} slot on ${cancellingAppt.date} for ${cancellingAppt.patientName || 'this patient'}. This can't be undone from here — they'd need to book again.`}
          confirmLabel="Cancel appointment"
          danger
          busy={cancelling}
          onConfirm={handleCancelConfirmed}
          onCancel={() => setCancellingAppt(null)}
        />
      )}
    </div>
  )
}

export default AppointmentsPage
