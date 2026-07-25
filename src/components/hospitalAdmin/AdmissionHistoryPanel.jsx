import { useEffect, useMemo, useState } from 'react'
import { subscribeAllAdmissions } from '../../firebase/bedManagement'
import { formatBedLocation, computeDaysSince } from '../../utils/bedManagement'
import { PageSpinner } from '../common/Spinner'
import NavIcon from '../common/NavIcon'
import Pagination from '../common/Pagination'

function formatTimestamp(ts) {
  const date = ts?.toDate?.()
  return date ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

const STATUS_STYLES = {
  active: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  discharged: 'bg-card-strong text-muted ring-line',
}

// Every past stay at this hospital, active or already discharged —
// subscribeAllAdmissions() already existed for exactly this but was never
// called from anywhere; the bed grid only ever shows currently-active
// admissions, with no way to look back at a completed one. See
// UAT_SECURITY_REPORT.md's missing-features list.
function AdmissionHistoryPanel({ hospitalId, onClose }) {
  const [admissions, setAdmissions] = useState(undefined)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const PAGE_SIZE = 15

  useEffect(() => subscribeAllAdmissions(hospitalId, setAdmissions), [hospitalId])

  const filtered = useMemo(() => {
    let list = admissions || []
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) => a.patientName?.toLowerCase().includes(q) || a.patientPhone?.includes(q) || a.diagnosis?.toLowerCase().includes(q)
      )
    }
    return list
  }, [admissions, statusFilter, search])

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-muted transition-colors hover:bg-card-strong hover:text-heading"
          aria-label="Back to beds"
        >
          <NavIcon name="arrowLeft" className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-heading">Admission History</h1>
          <p className="mt-0.5 text-sm text-muted">Every stay at this hospital, active or discharged.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by patient, phone, diagnosis..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
          className="min-w-[220px] flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        />
        <div className="flex gap-1 rounded-xl bg-card-strong p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'discharged', label: 'Discharged' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setStatusFilter(opt.key); setCurrentPage(1) }}
              className={`cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                statusFilter === opt.key ? 'bg-card text-heading shadow-sm' : 'text-muted hover:text-heading'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {admissions === undefined ? (
        <PageSpinner />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                <NavIcon name="bed" className="h-6 w-6 text-faint" />
              </div>
              <p className="mt-3 text-sm font-medium text-muted">
                {admissions.length === 0 ? 'No admissions recorded yet' : 'No admissions match your search'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {paginated.map((a) => (
                <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-heading">{a.patientName || 'Unknown'}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[a.status] || STATUS_STYLES.discharged}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{formatBedLocation(a)} · {a.bedId} · {a.diagnosis}</p>
                    {a.dischargeSummary && <p className="mt-1 text-xs text-faint">{a.dischargeSummary}</p>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted">
                    <p>Admitted {formatTimestamp(a.admittedAt)}</p>
                    <p>
                      {a.status === 'active'
                        ? `${computeDaysSince(a.admittedAt)} day(s) so far`
                        : a.dischargedAt
                        ? `Discharged ${formatTimestamp(a.dischargedAt)} · ${a.totalDays || 0} day(s)`
                        : ''}
                    </p>
                    {a.totalCharges > 0 && <p className="font-semibold text-heading">₹{a.totalCharges.toLocaleString('en-IN')}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      )}
    </div>
  )
}

export default AdmissionHistoryPanel
