import { useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useHospitalData } from '../../contexts/HospitalDataContext'
import { todayDateString } from '../../utils/dates'
import PatientFormModal from '../../components/hospitalAdmin/PatientFormModal'
import CompleteVisitModal from '../../components/hospitalAdmin/CompleteVisitModal'
import NavIcon from '../../components/common/NavIcon'
import Pagination from '../../components/common/Pagination'

const STATUS_STYLES = {
  scheduled: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400',
  completed: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  cancelled: 'bg-card-strong text-muted ring-line',
}

const PAGE_SIZE = 10

function normalizeDigits(value) {
  return (value || '').replace(/\D/g, '')
}

// A doctor's own "who am I seeing" tool: search a phone number (or name) to
// find who's already registered under it — up to MAX_PATIENTS_PER_PHONE
// (see src/firebase/patients.js) can share a number — pick the right one,
// see every visit that patient has had with this doctor plus their next
// appointment, or register them on the spot if they're not found. Reads
// straight off the same useHospitalData() window every other staff page
// already subscribes to; no new Firestore queries needed since a doctor's
// own hospital staff read access already covers `patients`.
function PatientLookupPage() {
  const { user, userDoc } = useAuth()
  const { patients, appointments } = useHospitalData()
  const [search, setSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewingApptId, setViewingApptId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  const trimmedSearch = search.trim()
  const searchDigits = normalizeDigits(search)

  const matches = useMemo(() => {
    if (!trimmedSearch) return []
    const q = trimmedSearch.toLowerCase()
    return patients.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(q)
      const phoneMatch = searchDigits.length >= 3 && normalizeDigits(p.phone).includes(searchDigits)
      return nameMatch || phoneMatch
    })
  }, [patients, trimmedSearch, searchDigits])

  const selectedPatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) || null : null

  // Only this doctor's own visits with this patient — never confirmed
  // (`pending`) bookings, same visibility rule every other doctor-facing
  // view in the app already applies (AppointmentsPage, DoctorOverviewPage).
  const history = useMemo(() => {
    if (!selectedPatient) return []
    return appointments
      .filter((a) => a.doctorId === user.uid && a.patientId === selectedPatient.id && a.status !== 'pending')
      .sort((a, b) => `${b.date}T${b.time || ''}`.localeCompare(`${a.date}T${a.time || ''}`))
  }, [appointments, selectedPatient, user.uid])

  const today = todayDateString()
  const nextAppointment = useMemo(
    () =>
      history
        .filter((a) => a.status === 'scheduled' && a.date >= today)
        .sort((a, b) => `${a.date}T${a.time || ''}`.localeCompare(`${b.date}T${b.time || ''}`))[0] || null,
    [history, today]
  )

  const paginatedHistory = useMemo(
    () => history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [history, currentPage]
  )

  function selectPatient(id) {
    setSelectedPatientId(id)
    setCurrentPage(1)
  }

  function backToSearch() {
    setSelectedPatientId(null)
    setSearch('')
  }

  const viewingAppt = viewingApptId ? history.find((a) => a.id === viewingApptId) || null : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-heading">Find Patient</h1>
          <p className="mt-0.5 text-sm text-muted">Search a phone number to see who's registered under it and their history with you</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/30 active:scale-[0.98]"
        >
          <NavIcon name="patients" className="h-4 w-4" />
          Register new patient
        </button>
      </div>

      {!selectedPatient ? (
        <>
          <input
            type="text"
            placeholder="Search by phone number or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
          />

          {trimmedSearch ? (
            <div className="space-y-2">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPatient(p.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left shadow-sm transition-colors hover:border-indigo-500/30 hover:bg-card-strong/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-bold text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                    {(p.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-heading">{p.name}</p>
                    <p className="truncate text-xs text-faint">{p.phone || '—'}</p>
                  </div>
                  <NavIcon name="arrowLeft" className="h-4 w-4 rotate-180 text-faint" />
                </button>
              ))}
              {matches.length === 0 && (
                <div className="rounded-2xl border border-line bg-card px-5 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                      <NavIcon name="patients" className="h-6 w-6 text-faint" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-muted">No matching patients</p>
                    <p className="mt-1 text-xs text-faint">Nobody registered under that number or name yet</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500"
                    >
                      + Register new patient
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-card px-5 py-16 text-center">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                  <NavIcon name="patients" className="h-6 w-6 text-faint" />
                </div>
                <p className="mt-3 text-sm font-medium text-muted">Search for a patient to get started</p>
                <p className="mt-1 text-xs text-faint">Enter their phone number or name above</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <button
            onClick={backToSearch}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted hover:text-heading"
          >
            <NavIcon name="arrowLeft" className="h-3.5 w-3.5" />
            Back to search
          </button>

          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-base font-bold text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                {(selectedPatient.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-base font-semibold text-heading">{selectedPatient.name}</p>
                <p className="text-xs text-faint">
                  {selectedPatient.phone || '—'}{selectedPatient.email ? ` · ${selectedPatient.email}` : ''}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-card-strong/40 p-4">
              {nextAppointment ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 ring-1 ring-inset ring-sky-500/20">
                    <NavIcon name="appointments" className="h-4.5 w-4.5 text-sky-600 dark:text-sky-300" />
                  </div>
                  <div>
                    <p className="text-xs text-faint">Next appointment with you</p>
                    <p className="text-sm font-semibold text-heading">
                      {nextAppointment.date}
                      {nextAppointment.time && ` at ${nextAppointment.time}`}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No upcoming appointment with you scheduled.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-heading">Visit history with you</h2>
              <p className="mt-0.5 text-xs text-faint">{history.length} visit{history.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-line">
              {paginatedHistory.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading">
                      {appt.date}
                      {appt.time && <span className="ml-1.5 text-xs text-faint">{appt.time}</span>}
                    </p>
                    {appt.concerns && <p className="mt-0.5 max-w-md truncate text-xs text-faint">{appt.concerns}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                        STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled
                      }`}
                    >
                      {appt.status}
                    </span>
                    {appt.status === 'completed' && (
                      <button
                        onClick={() => setViewingApptId(appt.id)}
                        className="cursor-pointer rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-300"
                      >
                        View notes
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="px-5 py-16 text-center">
                  <p className="text-sm font-medium text-muted">No visits with you yet</p>
                </div>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <Pagination currentPage={currentPage} totalItems={history.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      {showAddModal && (
        <PatientFormModal
          hospitalId={userDoc.hospitalId}
          initialPhone={selectedPatient ? selectedPatient.phone || '' : searchDigits.length >= 3 ? search : ''}
          onCancel={() => setShowAddModal(false)}
          onCreated={(newPatientId) => {
            setShowAddModal(false)
            if (newPatientId) selectPatient(newPatientId)
          }}
        />
      )}

      {viewingAppt && <CompleteVisitModal appointment={viewingAppt} readOnly onClose={() => setViewingApptId(null)} />}
    </div>
  )
}

export default PatientLookupPage
