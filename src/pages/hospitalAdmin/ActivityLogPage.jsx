import { useEffect, useMemo, useState } from 'react'
import { subscribeActivityLog, ACTIVITY_LABELS } from '../../firebase/activityLog'
import { useHospitalData } from '../../contexts/HospitalDataContext'
import { PageSpinner } from '../../components/common/Spinner'
import NavIcon from '../../components/common/NavIcon'
import Pagination from '../../components/common/Pagination'

const ACTION_STYLES = {
  'invoice.voided': 'bg-red-500/10 text-red-500 ring-red-500/20',
  'staff.deactivated': 'bg-red-500/10 text-red-500 ring-red-500/20',
  'staff.reactivated': 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  'staff.created': 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  'staff.permissions_changed': 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  'staff.billing_access_changed': 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  'appointment.cancelled': 'bg-slate-400/10 text-slate-500 ring-slate-400/20',
}

function formatTimestamp(ts) {
  const date = ts?.toDate?.()
  return date ? date.toLocaleString() : '—'
}

function ActivityLogPage({ tenantSlug }) {
  const { staff } = useHospitalData()
  const [entries, setEntries] = useState(undefined)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const PAGE_SIZE = 20

  useEffect(() => subscribeActivityLog(tenantSlug, setEntries), [tenantSlug])

  const staffByUid = useMemo(() => Object.fromEntries((staff || []).map((s) => [s.uid, s])), [staff])

  const actionOptions = useMemo(() => {
    const seen = new Set((entries || []).map((e) => e.action))
    return Array.from(seen)
  }, [entries])

  const filtered = useMemo(() => {
    let list = entries || []
    if (actionFilter !== 'all') list = list.filter((e) => e.action === actionFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((e) => {
        const actorName = staffByUid[e.actorUid]?.displayName || e.actorEmail || ''
        return (
          actorName.toLowerCase().includes(q) ||
          e.targetLabel?.toLowerCase().includes(q) ||
          e.details?.toLowerCase().includes(q)
        )
      })
    }
    return list
  }, [entries, actionFilter, search, staffByUid])

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  if (entries === undefined) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-heading">Activity Log</h1>
        <p className="mt-0.5 text-sm text-muted">
          A permanent, tamper-proof record of sensitive actions taken on this hospital's account — invoice voids, staff
          status/permission changes, appointment cancellations. Entries can never be edited or deleted, by anyone.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by staff member, target, details..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
          className="min-w-[220px] flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
          className="cursor-pointer rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        >
          <option value="all">All actions</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>{ACTIVITY_LABELS[action] || action}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
              <NavIcon name="clipboard" className="h-6 w-6 text-faint" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted">
              {entries.length === 0 ? 'No activity recorded yet' : 'No entries match your search'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {paginated.map((entry) => {
              const actor = staffByUid[entry.actorUid]
              return (
                <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${ACTION_STYLES[entry.action] || 'bg-card-strong text-muted ring-line'}`}>
                        {ACTIVITY_LABELS[entry.action] || entry.action}
                      </span>
                      <span className="text-sm font-medium text-heading">{entry.targetLabel || '—'}</span>
                    </div>
                    {entry.details && <p className="mt-1 text-xs text-muted">{entry.details}</p>}
                    <p className="mt-1 text-xs text-faint">
                      by {actor?.displayName || entry.actorEmail || 'Unknown'} · {formatTimestamp(entry.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      )}
    </div>
  )
}

export default ActivityLogPage
