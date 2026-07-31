import { useState, useMemo } from 'react'
import Modal from '../common/Modal'
import { formatBedLocation, getBedTypeColor } from '../../utils/bedManagement'

function AdmitPatientModal({ bed, config, patients, doctors, onAdmit, onClose }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [isNewPatient, setIsNewPatient] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const bedType = config?.bedTypes?.[bed?.type] || { label: bed?.type || 'General', ratePerDay: 0 }

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return patients
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.phone?.includes(term) ||
          p.id?.toLowerCase().includes(term)
      )
      .slice(0, 8)
  }, [patients, searchTerm])

  const selectedDoctor = doctors.find((d) => d.uid === doctorId)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!isNewPatient && !selectedPatient) {
      setError('Select an existing patient or add a new one.')
      return
    }
    if (isNewPatient && !newPatientName.trim()) {
      setError('Patient name is required.')
      return
    }
    if (!doctorId) {
      setError('Select an attending doctor.')
      return
    }
    if (!diagnosis.trim()) {
      setError('Diagnosis is required.')
      return
    }

    setLoading(true)
    try {
      await onAdmit({
        patientId: selectedPatient?.id || null,
        patientName: isNewPatient ? newPatientName.trim() : selectedPatient?.name || '',
        patientPhone: isNewPatient ? newPatientPhone.trim() : selectedPatient?.phone || '',
        attendingDoctor: selectedDoctor?.displayName || '',
        attendingDoctorId: doctorId,
        diagnosis: diagnosis.trim(),
        notes: notes.trim(),
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to admit patient.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <h2 className="mb-1 text-lg font-bold text-heading">Admit Patient</h2>
      <div className="mb-5">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getBedTypeColor(config?.bedTypes, bed?.type) }} />
          Bed {bed?.bedId} — {bedType.label} — ₹{bedType.ratePerDay.toLocaleString('en-IN')}/day
        </p>
        {bed && formatBedLocation(bed) && <p className="text-xs text-faint">{formatBedLocation(bed)}</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!isNewPatient ? (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-heading">Patient *</label>
              <input
                type="text"
                placeholder="Search by name, phone or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setSelectedPatient(null)
                }}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading placeholder-faint outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
              />
              {filteredPatients.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatient(patient)
                        setSearchTerm(patient.name)
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-card-strong"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-bold text-indigo-600">
                        {(patient.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-heading">{patient.name}</div>
                        <div className="text-[11px] text-faint">{patient.phone}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchTerm && !selectedPatient && filteredPatients.length === 0 && (
                <p className="mt-1 text-xs text-muted">No patients found. Try a different search or add new.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsNewPatient(true)}
              className="self-start text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-300"
            >
              + Add new patient instead
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-heading">Patient Name *</label>
              <input
                type="text"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading placeholder-faint outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-heading">Phone</label>
              <input
                type="tel"
                value={newPatientPhone}
                onChange={(e) => setNewPatientPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading placeholder-faint outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setIsNewPatient(false)
                setNewPatientName('')
                setNewPatientPhone('')
              }}
              className="self-start text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-300"
            >
              Search existing patient instead
            </button>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-heading">Attending Doctor *</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
          >
            <option value="">Select doctor...</option>
            {doctors.map((d) => (
              <option key={d.uid} value={d.uid}>
                {d.displayName || d.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-heading">Diagnosis *</label>
          <input
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Post-appendectomy recovery"
            className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading placeholder-faint outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-heading">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
            className="w-full resize-none rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading placeholder-faint outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>

        {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-card-strong hover:text-heading"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Admitting...' : 'Admit Patient'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default AdmitPatientModal
