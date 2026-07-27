import { useMemo, useState } from 'react'
import { ACTIVITY_LABELS, fetchAllActivityLogEntries } from '../../firebase/activityLog'
import { useActivityLog } from '../../hooks/useActivityLog'
import { toCsv, downloadCsv } from '../../utils/csv'
import NavIcon from '../common/NavIcon'
import { PageSpinner } from '../common/Spinner'
import Pagination from '../common/Pagination'

function formatTimestamp(ts) {
  const date = ts?.toDate?.()
  return date ? date.toLocaleString() : '—'
}

// Super Admin's own view of a hospital's activity log — unlike
// ActivityLogPage.jsx (that hospital's own admin view, only reachable once
// they've turned the module on), this is always available regardless of
// that toggle, since it's Super Admin's own oversight/support tool (see
// firestore.rules' /activityLog read rule). Shares useActivityLog's
// paginated fetch — one screenful at a time, never a live listener.
function HospitalActivityLogPanel({ hospitalId }) {
  const { entries, hasMore, loadingMore, error, loadMore, reload } = useActivityLog(hospitalId)
  const [actionFilter, setActionFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [downloading, setDownloading] = useState(false)

  const PAGE_SIZE = 15

  const actionOptions = useMemo(() => {
    const seen = new Set((entries || []).map((e) => e.action))
    return Array.from(seen)
  }, [entries])

  const filtered = useMemo(() => {
    const list = entries || []
    return actionFilter === 'all' ? list : list.filter((e) => e.action === actionFilter)
  }, [entries, actionFilter])

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  async function handleDownload() {
    setDownloading(true)
    try {
      const all = await fetchAllActivityLogEntries(hospitalId)
      const csv = toCsv(all, [
        { label: 'Date', value: (e) => formatTimestamp(e.createdAt) },
        { label: 'Action', value: (e) => ACTIVITY_LABELS[e.action] || e.action },
        { label: 'Actor', value: (e) => e.actorEmail || e.actorUid || '' },
        { label: 'Target', value: (e) => e.targetLabel || '' },
        { label: 'Details', value: (e) => e.details || '' },
      ])
      downloadCsv(`${hospitalId}-activity-log.csv`, csv)
    } finally {
      setDownloading(false)
    }
  }

  if (entries === undefined) return <PageSpinner />

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-muted">
          Every sensitive action recorded for {hospitalId} — visible to you regardless of whether this hospital's
          own Activity Log module is turned on for its admin (see the Modules tab).
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={reload}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-body transition-colors hover:bg-card-strong hover:text-heading"
          >
            <NavIcon name="schedule" className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <NavIcon name="clipboard" className="h-3.5 w-3.5" />
            {downloading ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>
      </div>

      <div className="mt-3">
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

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
              <NavIcon name="clipboard" className="h-6 w-6 text-faint" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted">No activity recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {paginated.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-card-strong px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted ring-1 ring-inset ring-line">
                      {ACTIVITY_LABELS[entry.action] || entry.action}
                    </span>
                    <span className="text-sm font-medium text-heading">{entry.targetLabel || '—'}</span>
                  </div>
                  {entry.details && <p className="mt-1 text-xs text-muted">{entry.details}</p>}
                  <p className="mt-1 text-xs text-faint">
                    by {entry.actorEmail || 'Unknown'} · {formatTimestamp(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-3">
          <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
        </div>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="cursor-pointer rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-body transition-colors hover:bg-card-strong hover:text-heading disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load older entries'}
          </button>
        </div>
      )}
    </section>
  )
}

export default HospitalActivityLogPanel
