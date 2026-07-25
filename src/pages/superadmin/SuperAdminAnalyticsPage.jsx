import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { subscribeHospitals, getHospitalCounts } from '../../firebase/hospitals'
import { getStaffCount } from '../../firebase/users'
import { ROLES, ROLE_LABELS } from '../../utils/roles'
import { todayDateString, shiftDateString } from '../../utils/dates'
import { PageSpinner } from '../../components/common/Spinner'
import NavIcon from '../../components/common/NavIcon'
import StatusBadge from '../../components/superadmin/StatusBadge'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: 'week', label: 'This Week', days: 6 },
  { key: '30', label: '30 Days', days: 30 },
  { key: '90', label: '90 Days', days: 90 },
  { key: 'year', label: 'This Year', days: 365 },
]

const STATUS_DOTS = {
  pending: 'bg-amber-500',
  scheduled: 'bg-sky-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-slate-400',
}

const APPT_STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  scheduled: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400',
  completed: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  cancelled: 'bg-slate-400/10 text-slate-500 ring-slate-400/20 dark:text-slate-400',
}

function formatMoney(n) {
  return `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`
}

function getRangeDays(key) {
  const opt = RANGE_OPTIONS.find((o) => o.key === key)
  return opt ? opt.days : 30
}

function buildDailyCounts(appointments, days) {
  const counts = {}
  for (let i = days; i >= 0; i--) {
    const d = shiftDateString(-i)
    counts[d] = 0
  }
  for (const a of appointments) {
    if (counts[a.date] !== undefined) counts[a.date]++
  }
  return Object.entries(counts).map(([date, total]) => ({ date, total }))
}

function buildRevenueByDay(invoices, days) {
  const rev = {}
  for (let i = days; i >= 0; i--) {
    rev[shiftDateString(-i)] = 0
  }
  for (const inv of invoices) {
    if (inv.status === 'paid') {
      const paidDate = inv.paidAt?.toDate
        ? todayDateString(inv.paidAt.toDate())
        : inv.date || ''
      if (rev[paidDate] !== undefined) rev[paidDate] += inv.total || 0
    }
  }
  return Object.entries(rev).map(([date, amount]) => ({ date, amount }))
}

function buildHospitalStats(appointments, invoices, hospitals) {
  const stats = {}
  for (const h of hospitals) {
    stats[h.slug] = { name: h.title || h.slug, slug: h.slug, status: h.status, total: 0, completed: 0, revenue: 0 }
  }
  for (const a of appointments) {
    if (stats[a.hospitalId]) {
      stats[a.hospitalId].total++
      if (a.status === 'completed') stats[a.hospitalId].completed++
    }
  }
  for (const inv of invoices) {
    if (inv.status === 'paid' && stats[inv.hospitalId]) {
      stats[inv.hospitalId].revenue += inv.total || 0
    }
  }
  return Object.values(stats).sort((a, b) => b.total - a.total)
}

function exportToCSV(headers, rows, filename) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const val = String(cell ?? '')
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"`
          : val
      }).join(',')
    ),
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function StatCard({ label, value, hint, icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-line bg-card p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-500/30 cursor-pointer active:scale-[0.98]"
    >
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity group-hover:opacity-100" style={{ background: color || 'rgba(99,102,241,0.08)' }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color || 'from-indigo-500/15 to-indigo-500/5'} ring-1 ring-inset ring-white/20`}>
            <NavIcon name={icon} className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          </span>
          <NavIcon name="arrowLeft" className="h-4 w-4 rotate-180 text-faint opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-heading">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
      </div>
    </button>
  )
}

function BarChart({ data, valueKey = 'total', color = 'from-indigo-500 to-indigo-400', height = 140 }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-[2px] sm:gap-[3px]" style={{ height }}>
      {data.map((d) => {
        const pct = (d[valueKey] / max) * 100
        const isToday = d.date === todayDateString()
        return (
          <div key={d.date} className="group relative flex flex-1 flex-col items-center">
            <div className="absolute -top-9 hidden whitespace-nowrap rounded-xl bg-heading px-3 py-1.5 text-[11px] font-medium text-page shadow-xl group-hover:block z-20">
              <div>{formatDate(d.date)}</div>
              <div className="font-bold">{valueKey === 'amount' ? formatMoney(d[valueKey]) : d[valueKey]}</div>
            </div>
            <div className="w-full flex-1 flex items-end justify-center cursor-pointer">
              <div
                className={`w-full max-w-[28px] rounded-t-lg bg-gradient-to-t ${color} transition-all duration-300 group-hover:shadow-md group-hover:scale-105 ${isToday ? 'ring-2 ring-indigo-500/40 ring-offset-1 ring-offset-transparent' : ''}`}
                style={{ height: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
              />
            </div>
            {data.length <= 31 && (
              <span className={`text-[8px] sm:text-[9px] leading-none mt-1 ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-300' : 'text-faint'}`}>
                {d.date?.slice(-2)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HospitalRankingModal({ hospitalStats, onClose }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return hospitalStats
    return hospitalStats.filter((h) => h.name.toLowerCase().includes(q) || h.slug.toLowerCase().includes(q))
  }, [hospitalStats, search])

  const maxRevenue = Math.max(...hospitalStats.map((h) => h.revenue), 1)

  const handleExport = () => {
    const headers = ['Hospital', 'Slug', 'Status', 'Total Appointments', 'Completed', 'Revenue']
    const rows = filtered.map((h) => [h.name, h.slug, h.status, h.total, h.completed, h.revenue])
    exportToCSV(headers, rows, `hospital-ranking-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-heading">Hospital Rankings</h2>
        <p className="mt-1 text-sm text-muted">{hospitalStats.length} hospitals by appointment volume</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search hospitals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        />
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-heading transition-all hover:bg-card-strong hover:border-indigo-500/30 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export CSV
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No hospitals found</div>
        ) : (
          filtered.map((h, i) => {
            const revenuePct = (h.revenue / maxRevenue) * 100
            return (
              <div key={h.slug} className="flex items-center gap-4 rounded-xl border border-line/50 bg-card-strong/30 px-4 py-3 transition-colors hover:bg-card-strong/60">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 ring-1 ring-indigo-500/20 ring-inset dark:text-indigo-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-heading truncate">{h.name}</p>
                    <StatusBadge status={h.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-muted">
                    <span>{h.total} appts</span>
                    <span>{h.completed} completed</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatMoney(h.revenue)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-strong">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500" style={{ width: `${revenuePct}%` }} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}

function AppointmentsModal({ appointments, onClose, initialStatus }) {
  const [filter, setFilter] = useState(initialStatus || 'all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const MODAL_PAGE_SIZE = 20

  const tabs = [
    { key: 'all', label: 'All', count: appointments.length },
    { key: 'pending', label: 'Pending', count: appointments.filter((a) => a.status === 'pending').length },
    { key: 'scheduled', label: 'Scheduled', count: appointments.filter((a) => a.status === 'scheduled').length },
    { key: 'completed', label: 'Completed', count: appointments.filter((a) => a.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelled', count: appointments.filter((a) => a.status === 'cancelled').length },
  ]

  const filtered = useMemo(() => {
    let list = filter === 'all' ? appointments : appointments.filter((a) => a.status === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          a.patientName?.toLowerCase().includes(q) ||
          a.patientPhone?.includes(q) ||
          a.doctorName?.toLowerCase().includes(q) ||
          a.hospitalId?.toLowerCase().includes(q)
      )
    }
    return list
  }, [appointments, filter, search])

  const paginatedFiltered = useMemo(
    () => filtered.slice((currentPage - 1) * MODAL_PAGE_SIZE, currentPage * MODAL_PAGE_SIZE),
    [filtered, currentPage]
  )

  const handleExport = () => {
    const headers = ['Hospital', 'Date', 'Time', 'Patient', 'Phone', 'Doctor', 'Status']
    const rows = filtered.map((a) => [a.hospitalId, a.date, a.time || '', a.patientName, a.patientPhone || '', a.doctorName || 'Unassigned', a.status])
    exportToCSV(headers, rows, `platform-appointments-${filter}-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-heading">All Appointments</h2>
        <p className="mt-1 text-sm text-muted">{filtered.length} appointment{filtered.length !== 1 ? 's' : ''} across all hospitals</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, doctor, hospital..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        />
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-heading transition-all hover:bg-card-strong hover:border-indigo-500/30 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export CSV
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-card-strong p-1 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              filter === tab.key ? 'bg-card text-heading shadow-sm' : 'text-muted hover:text-heading'
            }`}
          >
            {tab.label}
            <span className={`ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${
              filter === tab.key ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'bg-card-strong text-faint'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No appointments found</div>
        ) : (
          <div className="space-y-2">
            {paginatedFiltered.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line/50 bg-card-strong/30 px-4 py-3 transition-colors hover:bg-card-strong/60">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOTS[a.status]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-heading truncate">{a.patientName || 'Unknown'}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${APPT_STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span className="font-medium text-indigo-600 dark:text-indigo-300">{a.hospitalId}</span>
                    <span>{formatDate(a.date)} {a.time || ''}</span>
                    <span>{a.doctorName || 'No doctor'}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                pageSize={MODAL_PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function StaffModal({ staff, hospitalsBySlug, onClose }) {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const MODAL_PAGE_SIZE = 20

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return staff
    return staff.filter(
      (s) =>
        s.displayName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        (hospitalsBySlug[s.hospitalId]?.title || s.hospitalId || '').toLowerCase().includes(q)
    )
  }, [staff, search, hospitalsBySlug])

  const paginatedFiltered = useMemo(
    () => filtered.slice((currentPage - 1) * MODAL_PAGE_SIZE, currentPage * MODAL_PAGE_SIZE),
    [filtered, currentPage]
  )

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Role', 'Hospital', 'Status']
    const rows = filtered.map((s) => [
      s.displayName || '', s.email || '', ROLE_LABELS[s.role] || s.role,
      hospitalsBySlug[s.hospitalId]?.title || s.hospitalId || '', s.status || '',
    ])
    exportToCSV(headers, rows, `platform-staff-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-heading">All Staff</h2>
        <p className="mt-1 text-sm text-muted">{filtered.length} staff member{filtered.length !== 1 ? 's' : ''} across every hospital</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, email, hospital..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        />
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-heading transition-all hover:bg-card-strong hover:border-indigo-500/30 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export CSV
        </button>
      </div>

      <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No staff found</div>
        ) : (
          <div className="space-y-2">
            {paginatedFiltered.map((s) => (
              <div key={s.uid} className="flex items-center gap-3 rounded-xl border border-line/50 bg-card-strong/30 px-4 py-3 transition-colors hover:bg-card-strong/60">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-bold text-violet-600 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
                  {(s.displayName || '?')[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-heading truncate">{s.displayName || s.email}</p>
                    <StatusBadge status={s.status} kind="user" />
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span className="font-medium text-indigo-600 dark:text-indigo-300">{hospitalsBySlug[s.hospitalId]?.title || s.hospitalId}</span>
                    <span>{ROLE_LABELS[s.role] || s.role}</span>
                    {s.email && <span className="text-faint">{s.email}</span>}
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                pageSize={MODAL_PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function RevenueModal({ invoices, onClose }) {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const MODAL_PAGE_SIZE = 20

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter(
      (i) =>
        i.patientName?.toLowerCase().includes(q) ||
        i.patientPhone?.includes(q) ||
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.hospitalId?.toLowerCase().includes(q)
    )
  }, [invoices, search])

  const paginatedFiltered = useMemo(
    () => filtered.slice((currentPage - 1) * MODAL_PAGE_SIZE, currentPage * MODAL_PAGE_SIZE),
    [filtered, currentPage]
  )

  const totals = useMemo(() => ({
    total: filtered.reduce((s, i) => s + (i.total || 0), 0),
    paid: filtered.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0),
    due: filtered.filter((i) => i.status === 'due').reduce((s, i) => s + Math.max((i.total || 0) - (i.amountPaid || 0), 0), 0),
  }), [filtered])

  const handleExport = () => {
    const headers = ['Hospital', 'Invoice #', 'Date', 'Patient', 'Phone', 'Doctor', 'Total', 'Paid', 'Status']
    const rows = filtered.map((i) => [i.hospitalId, i.invoiceNumber, i.date, i.patientName, i.patientPhone || '', i.doctorName || '', i.total || 0, i.amountPaid || 0, i.status])
    exportToCSV(headers, rows, `platform-invoices-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-heading">All Invoices</h2>
        <p className="mt-1 text-sm text-muted">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''} across all hospitals</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl bg-card-strong/50 px-4 py-3">
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg font-bold text-heading">{formatMoney(totals.total)}</p>
        </div>
        <div className="rounded-xl bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Collected</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(totals.paid)}</p>
        </div>
        <div className="rounded-xl bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-600 dark:text-amber-400">Outstanding</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatMoney(totals.due)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by hospital, patient, invoice #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        />
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-heading transition-all hover:bg-card-strong hover:border-indigo-500/30 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export CSV
        </button>
      </div>

      <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No invoices found</div>
        ) : (
          <div className="space-y-2">
            {paginatedFiltered.map((inv) => (
              <div key={inv.id} className="rounded-xl border border-line/50 bg-card-strong/30 px-4 py-3 transition-colors hover:bg-card-strong/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-heading">{inv.patientName || '—'}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400' :
                        inv.status === 'due' ? 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400' :
                        'bg-slate-400/10 text-slate-500 ring-slate-400/20'
                      }`}>{inv.status}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span className="font-medium text-indigo-600 dark:text-indigo-300">{inv.hospitalId}</span>
                      <span className="font-mono text-faint">{inv.invoiceNumber}</span>
                      <span>{formatDate(inv.date)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-heading">{formatMoney(inv.total)}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                pageSize={MODAL_PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function PlatformAnalytics() {
  const [hospitals, setHospitals] = useState(null)
  const [counts, setCounts] = useState(null)
  const [staffCount, setStaffCount] = useState(null)
  const [staff, setStaff] = useState(null)
  const [appointments, setAppointments] = useState(null)
  const [invoices, setInvoices] = useState(null)
  const [range, setRange] = useState('30')
  const [modal, setModal] = useState(null)

  useEffect(() => {
    const unsubHospitals = subscribeHospitals(setHospitals)
    getHospitalCounts().then(setCounts)
    getStaffCount().then(setStaffCount)
    // Live listener (not a one-off count) so the Total Staff drill-down
    // modal has actual rows to show, not just the number.
    const unsubStaff = onSnapshot(
      query(collection(db, 'users'), where('role', '!=', ROLES.SUPERADMIN)),
      (snap) => setStaff(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    )
    return () => { unsubHospitals(); unsubStaff() }
  }, [])

  const hospitalsBySlug = useMemo(
    () => Object.fromEntries((hospitals || []).map((h) => [h.slug, h])),
    [hospitals]
  )

  const days = getRangeDays(range)

  useEffect(() => {
    const cutoff = days === 0 ? todayDateString() : shiftDateString(-days)
    const dateField = days === 0 ? 'date' : 'date'
    const unsubAppts = onSnapshot(
      query(collection(db, 'appointments'), where(dateField, '>=', cutoff)),
      (snap) => setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => { unsubAppts(); unsubInvoices() }
  }, [days])

  const stats = useMemo(() => {
    if (!hospitals || !appointments || !invoices) return null
    const today = todayDateString()
    const rangeAppts = days === 0
      ? appointments.filter((a) => a.date === today)
      : appointments
    const rangeInvoices = (invoices || []).filter((inv) => {
      const d = inv.date || (inv.createdAt?.toDate ? todayDateString(inv.createdAt.toDate()) : '')
      return days === 0 ? d === today : true
    })
    const paid = rangeInvoices.filter((i) => i.status === 'paid')
    const totalRevenue = paid.reduce((s, i) => s + (i.total || 0), 0)
    const todayAppts = appointments.filter((a) => a.date === today)
    const completionRate = rangeAppts.length > 0 ? Math.round((rangeAppts.filter((a) => a.status === 'completed').length / rangeAppts.length) * 100) : 0
    return { todayAppts, totalRevenue, completionRate, rangeAppts }
  }, [hospitals, appointments, invoices, days])

  const dailyAppts = useMemo(
    () => (appointments ? buildDailyCounts(days === 0 ? appointments.filter((a) => a.date === todayDateString()) : appointments, days) : []),
    [appointments, days]
  )
  const dailyRevenue = useMemo(
    () => (invoices ? buildRevenueByDay(invoices, days) : []),
    [invoices, days]
  )
  const hospitalStats = useMemo(
    () => (appointments && invoices && hospitals ? buildHospitalStats(appointments, invoices, hospitals) : []),
    [appointments, invoices, hospitals]
  )

  if (!counts || staffCount === null || !stats) return <PageSpinner />

  const greetingTime = new Date().getHours()
  const greeting = greetingTime < 12 ? 'Good morning' : greetingTime < 17 ? 'Good afternoon' : 'Good evening'
  const rangeLabel = RANGE_OPTIONS.find((o) => o.key === range)?.label || '30 Days'

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="absolute top-1/2 right-8 -translate-y-1/2 hidden lg:block opacity-10">
          <NavIcon name="analytics" className="h-32 w-32" />
        </div>
        <div className="relative">
          <p className="text-sm font-medium text-indigo-100">{greeting}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Platform Analytics</h1>
          <p className="mt-2 max-w-lg text-sm text-indigo-100/80">
            Insights across <span className="font-semibold text-white">{counts.total} hospital{counts.total !== 1 ? 's' : ''}</span> and{' '}
            <span className="font-semibold text-white">{staffCount} staff</span> — <span className="font-semibold text-white">{rangeLabel}</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              range === opt.key
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'bg-card border border-line text-muted hover:text-heading hover:border-indigo-500/30 hover:bg-card-strong'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="ml-auto hidden sm:block">
          <button
            onClick={() => {
              const headers = ['Date', 'Total Appointments']
              const rows = dailyAppts.map((d) => [d.date, d.total])
              exportToCSV(headers, rows, `platform-trend-${todayDateString()}`)
            }}
            className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-heading transition-all hover:bg-card-strong hover:border-indigo-500/30 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export All Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Hospitals"
          value={counts.total}
          hint={`${counts.active} active · ${counts.trial} trial`}
          icon="hospitals"
          color="from-indigo-500/15 to-indigo-500/5"
          onClick={() => setModal({ type: 'hospitals' })}
        />
        <StatCard
          label="Today's Appointments"
          value={stats.todayAppts.length}
          hint={`${stats.completionRate}% completion`}
          icon="appointments"
          color="from-sky-500/15 to-sky-500/5"
          onClick={() => setModal({ type: 'appointments' })}
        />
        <StatCard
          label="Platform Revenue"
          value={formatMoney(stats.totalRevenue)}
          hint="All time paid"
          icon="billing"
          color="from-emerald-500/15 to-emerald-500/5"
          onClick={() => setModal({ type: 'revenue' })}
        />
        <StatCard
          label="Total Staff"
          value={staffCount}
          hint="Across every hospital"
          icon="staff"
          color="from-violet-500/15 to-violet-500/5"
          onClick={() => setModal({ type: 'staff' })}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Appointment Volume</h2>
            <button onClick={() => setModal({ type: 'appointments' })} className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer">View all →</button>
          </div>
          {dailyAppts.every((d) => d.total === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-card-strong flex items-center justify-center mb-3">
                <NavIcon name="appointments" className="h-6 w-6 text-faint" />
              </div>
              <p className="text-sm font-medium text-muted">No appointments in this period</p>
            </div>
          ) : (
            <BarChart data={dailyAppts} valueKey="total" color="from-sky-500 to-sky-400" />
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Hospital Status</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Active', count: counts.active, color: 'from-emerald-500 to-emerald-400' },
              { label: 'Trial', count: counts.trial, color: 'from-amber-500 to-amber-400' },
            ].map(({ label, count, color }) => {
              const pct = counts.total ? Math.round((count / counts.total) * 100) : 0
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-heading">{label}</span>
                    <span className="text-muted">{count} <span className="text-faint">({pct}%)</span></span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-card-strong">
                    <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 rounded-xl bg-card-strong/50 px-4 py-3">
            <p className="text-xs text-muted">Total Staff</p>
            <p className="text-2xl font-bold text-heading">{staffCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Revenue Trend</h2>
            <button onClick={() => setModal({ type: 'revenue' })} className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer">View invoices →</button>
          </div>
          {dailyRevenue.every((d) => d.amount === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-card-strong flex items-center justify-center mb-3">
                <NavIcon name="billing" className="h-6 w-6 text-faint" />
              </div>
              <p className="text-sm font-medium text-muted">No revenue data</p>
            </div>
          ) : (
            <BarChart data={dailyRevenue} valueKey="amount" color="from-emerald-500 to-emerald-400" height={140} />
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Top Hospitals</h2>
            <button onClick={() => setModal({ type: 'hospitals' })} className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer">View all →</button>
          </div>
          {hospitalStats.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No data</p>
          ) : (
            <div className="space-y-3">
              {hospitalStats.slice(0, 5).map((h, i) => (
                <div key={h.slug} className="flex items-center gap-3 rounded-xl bg-card-strong/30 px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-500/20 ring-inset dark:text-indigo-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-heading">{h.name}</p>
                    <p className="text-[11px] text-faint">{h.total} appts · {formatMoney(h.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'hospitals' && (
        <HospitalRankingModal hospitalStats={hospitalStats} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'appointments' && (
        <AppointmentsModal appointments={stats.rangeAppts} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'revenue' && (
        <RevenueModal invoices={invoices || []} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'staff' && (
        <StaffModal staff={staff || []} hospitalsBySlug={hospitalsBySlug} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

function SuperAdminAnalyticsPage() {
  return <PlatformAnalytics />
}

export default SuperAdminAnalyticsPage
