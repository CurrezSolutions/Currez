import { useEffect, useMemo, useState, useCallback } from 'react'
import { useHospitalData } from '../../contexts/HospitalDataContext'
import { ROLES } from '../../utils/roles'
import { todayDateString, shiftDateString } from '../../utils/dates'
import { subscribeInvoices } from '../../firebase/billing'
import { PageSpinner } from '../../components/common/Spinner'
import NavIcon from '../../components/common/NavIcon'
import Modal from '../../components/common/Modal'

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: 'week', label: 'This Week', days: 6 },
  { key: '30', label: '30 Days', days: 30 },
  { key: '90', label: '90 Days', days: 90 },
  { key: 'year', label: 'This Year', days: 365 },
]

const STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  scheduled: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400',
  completed: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  cancelled: 'bg-slate-400/10 text-slate-500 ring-slate-400/20 dark:text-slate-400',
}

const INVOICE_STATUS_STYLES = {
  paid: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  due: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  void: 'bg-slate-400/10 text-slate-500 ring-slate-400/20 dark:text-slate-400',
}

const STATUS_DOTS = {
  pending: 'bg-amber-500',
  scheduled: 'bg-sky-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-slate-400',
}

function formatMoney(n) {
  return `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
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
    counts[d] = { total: 0, completed: 0, cancelled: 0, pending: 0, scheduled: 0 }
  }
  for (const a of appointments) {
    if (counts[a.date]) {
      counts[a.date].total++
      if (counts[a.date][a.status] !== undefined) counts[a.date][a.status]++
    }
  }
  return Object.entries(counts).map(([date, c]) => ({ date, ...c }))
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

function buildDoctorStats(appointments, staff) {
  const doctors = staff.filter((s) => s.role === ROLES.DOCTOR)
  const counts = {}
  for (const d of doctors) counts[d.uid] = { name: d.displayName || d.email, total: 0, completed: 0, cancelled: 0 }
  for (const a of appointments) {
    if (a.doctorId && counts[a.doctorId]) {
      counts[a.doctorId].total++
      if (a.status === 'completed') counts[a.doctorId].completed++
      if (a.status === 'cancelled') counts[a.doctorId].cancelled++
    }
  }
  return Object.values(counts)
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
}

function buildPeakHours(appointments) {
  const hours = Array.from({ length: 24 }, () => 0)
  for (const a of appointments) {
    if (a.time) {
      const h = parseInt(a.time.split(':')[0], 10)
      if (!isNaN(h) && h >= 0 && h < 24) hours[h]++
    }
  }
  return hours
}

function buildDepartmentStats(appointments) {
  const depts = {}
  for (const a of appointments) {
    const dept = a.department || 'General'
    if (!depts[dept]) depts[dept] = { name: dept, total: 0, completed: 0 }
    depts[dept].total++
    if (a.status === 'completed') depts[dept].completed++
  }
  return Object.values(depts).sort((a, b) => b.total - a.total)
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

function BarChart({ data, valueKey = 'total', color = 'from-sky-500 to-sky-400', height = 140, onBarClick }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-[2px] sm:gap-[3px]" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d[valueKey] / max) * 100
        const isToday = d.date === todayDateString()
        return (
          <div
            key={d.date}
            className="group relative flex flex-1 flex-col items-center"
            onClick={() => onBarClick?.(d)}
          >
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

function StatusBreakdown({ appointments, onStatusClick }) {
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, scheduled: 0, completed: 0, cancelled: 0 }
    for (const a of appointments) {
      if (counts[a.status] !== undefined) counts[a.status]++
    }
    return counts
  }, [appointments])

  const total = appointments.length || 1

  return (
    <div className="space-y-3">
      {Object.entries(statusCounts).map(([status, count]) => {
        const pct = Math.round((count / total) * 100)
        return (
          <button
            key={status}
            onClick={() => onStatusClick?.(status)}
            className="w-full text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOTS[status]}`} />
                <span className="font-medium capitalize text-heading group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">{status}</span>
              </div>
              <span className="text-muted">{count} <span className="text-faint">({pct}%)</span></span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-card-strong">
              <div className={`h-full rounded-full bg-gradient-to-r ${status === 'completed' ? 'from-emerald-500 to-emerald-400' : status === 'scheduled' ? 'from-sky-500 to-sky-400' : status === 'pending' ? 'from-amber-500 to-amber-400' : 'from-slate-400 to-slate-300'} transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function PeakHoursChart({ hours }) {
  const max = Math.max(...hours, 1)
  const peakHour = hours.indexOf(max)

  return (
    <div>
      <div className="flex items-end gap-[2px] sm:gap-1" style={{ height: 110 }}>
        {hours.map((count, h) => {
          const pct = (count / max) * 100
          const isPeak = h === peakHour && count > 0
          const label = h < 10 ? `0${h}` : `${h}`
          return (
            <div key={h} className="group relative flex flex-1 flex-col items-center">
              <div className="absolute -top-8 hidden whitespace-nowrap rounded-xl bg-heading px-3 py-1.5 text-[11px] font-medium text-page shadow-xl group-hover:block z-20">
                {label}:00 — {count} appts
              </div>
              <div className="w-full flex-1 flex items-end justify-center cursor-pointer">
                <div
                  className={`w-full max-w-[18px] rounded-t-lg transition-all duration-300 group-hover:scale-105 ${isPeak ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 ring-1 ring-indigo-500/30' : 'bg-gradient-to-t from-violet-500/70 to-violet-400/70'}`}
                  style={{ height: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                />
              </div>
              {h % 4 === 0 && <span className="text-[8px] text-faint leading-none mt-1">{label}</span>}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-card-strong/50 px-3 py-2">
        <span className="text-xs text-muted">Peak hour</span>
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">{peakHour < 10 ? `0${peakHour}` : peakHour}:00 ({max} appointments)</span>
      </div>
    </div>
  )
}

function AppointmentsModal({ appointments, onClose, initialStatus }) {
  const [filter, setFilter] = useState(initialStatus || 'all')
  const [search, setSearch] = useState('')

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
          a.token?.toLowerCase().includes(q)
      )
    }
    return list
  }, [appointments, filter, search])

  const handleExport = () => {
    const headers = ['Token', 'Date', 'Time', 'Patient', 'Phone', 'Doctor', 'Status', 'Created By']
    const rows = filtered.map((a) => [
      a.token, a.date, a.time || '', a.patientName, a.patientPhone || '', a.doctorName || 'Unassigned', a.status, a.createdBy || '',
    ])
    exportToCSV(headers, rows, `appointments-${filter}-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-heading">Appointments</h2>
        <p className="mt-1 text-sm text-muted">{filtered.length} appointment{filtered.length !== 1 ? 's' : ''} found</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, doctor, token..."
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
            {filtered.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line/50 bg-card-strong/30 px-4 py-3 transition-colors hover:bg-card-strong/60">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOTS[a.status]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-heading truncate">{a.patientName || 'Unknown'}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span>{formatDate(a.date)} {a.time || ''}</span>
                    <span>{a.doctorName || 'No doctor'}</span>
                    {a.patientPhone && <span>{a.patientPhone}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono font-bold text-faint bg-card-strong rounded-lg px-2 py-1">{a.token}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function InvoicesModal({ invoices, onClose, initialStatus }) {
  const [filter, setFilter] = useState(initialStatus || 'all')
  const [search, setSearch] = useState('')

  const tabs = [
    { key: 'all', label: 'All', count: invoices.length },
    { key: 'paid', label: 'Paid', count: invoices.filter((i) => i.status === 'paid').length },
    { key: 'due', label: 'Due', count: invoices.filter((i) => i.status === 'due').length },
    { key: 'void', label: 'Void', count: invoices.filter((i) => i.status === 'void').length },
  ]

  const filtered = useMemo(() => {
    let list = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (i) =>
          i.patientName?.toLowerCase().includes(q) ||
          i.patientPhone?.includes(q) ||
          i.invoiceNumber?.toLowerCase().includes(q) ||
          i.doctorName?.toLowerCase().includes(q)
      )
    }
    return list
  }, [invoices, filter, search])

  const totals = useMemo(() => ({
    total: filtered.reduce((s, i) => s + (i.total || 0), 0),
    paid: filtered.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0),
    due: filtered.filter((i) => i.status === 'due').reduce((s, i) => s + Math.max((i.total || 0) - (i.amountPaid || 0), 0), 0),
  }), [filtered])

  const handleExport = () => {
    const headers = ['Invoice #', 'Date', 'Patient', 'Phone', 'Doctor', 'Subtotal', 'Discount', 'Total', 'Paid', 'Status']
    const rows = filtered.map((i) => [
      i.invoiceNumber, i.date, i.patientName, i.patientPhone || '', i.doctorName || '',
      i.subtotal || 0, i.discount || 0, i.total || 0, i.amountPaid || 0, i.status,
    ])
    exportToCSV(headers, rows, `invoices-${filter}-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-heading">Invoices</h2>
        <p className="mt-1 text-sm text-muted">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''} found</p>
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
          placeholder="Search by patient, invoice #, doctor..."
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
          <div className="py-12 text-center text-sm text-muted">No invoices found</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((inv) => (
              <div key={inv.id} className="rounded-xl border border-line/50 bg-card-strong/30 px-4 py-3 transition-colors hover:bg-card-strong/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-heading">{inv.patientName || '—'}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${INVOICE_STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span className="font-mono text-faint">{inv.invoiceNumber}</span>
                      <span>{formatDate(inv.date)}</span>
                      <span>{inv.doctorName || '—'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-heading">{formatMoney(inv.total)}</p>
                    {inv.status === 'due' && inv.amountPaid > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">{formatMoney(inv.amountPaid)} paid</p>
                    )}
                  </div>
                </div>
                {inv.lineItems && inv.lineItems.length > 0 && (
                  <div className="mt-2 border-t border-line/50 pt-2 space-y-1">
                    {inv.lineItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-muted">
                        <span>{item.label}</span>
                        <span className="font-medium">{formatMoney(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function DoctorPerformanceModal({ doctorStats, onClose }) {
  const maxTotal = Math.max(...doctorStats.map((d) => d.total), 1)

  const handleExport = () => {
    const headers = ['Doctor', 'Total Appointments', 'Completed', 'Cancelled', 'Completion Rate']
    const rows = doctorStats.map((d) => [
      d.name, d.total, d.completed, d.cancelled,
      d.total > 0 ? `${Math.round((d.completed / d.total) * 100)}%` : '0%',
    ])
    exportToCSV(headers, rows, `doctor-performance-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-heading">Doctor Performance</h2>
          <p className="mt-1 text-sm text-muted">{doctorStats.length} doctor{doctorStats.length !== 1 ? 's' : ''} with appointments</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-heading transition-all hover:bg-card-strong hover:border-indigo-500/30 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto space-y-3">
        {doctorStats.map((doc, i) => {
          const pct = Math.round((doc.completed / (doc.total || 1)) * 100)
          return (
            <div key={i} className="rounded-xl border border-line/50 bg-card-strong/30 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/15 to-indigo-500/10 text-sm font-bold text-violet-600 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
                  {doc.name?.[0]?.toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-heading">{doc.name}</p>
                  <p className="text-xs text-muted">{doc.total} total · {doc.completed} completed · {doc.cancelled} cancelled</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-heading">{pct}%</p>
                  <p className="text-[10px] text-faint">completion</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-card-strong">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

function PeakHoursModal({ hours, appointments, onClose }) {
  const max = Math.max(...hours, 1)
  const peakHour = hours.indexOf(max)

  const handleExport = () => {
    const headers = ['Hour', 'Appointments']
    const rows = hours.map((count, h) => [`${h < 10 ? '0' + h : h}:00`, count])
    exportToCSV(headers, rows, `peak-hours-${todayDateString()}`)
  }

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-heading">Peak Hours Analysis</h2>
          <p className="mt-1 text-sm text-muted">Appointment distribution by hour of day</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-heading transition-all hover:bg-card-strong hover:border-indigo-500/30 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export
        </button>
      </div>

      <div className="flex items-end gap-[3px] sm:gap-1" style={{ height: 160 }}>
        {hours.map((count, h) => {
          const pct = (count / max) * 100
          const isPeak = h === peakHour && count > 0
          return (
            <div key={h} className="group relative flex flex-1 flex-col items-center">
              <div className="absolute -top-10 hidden whitespace-nowrap rounded-xl bg-heading px-3 py-1.5 text-[11px] font-medium text-page shadow-xl group-hover:block z-20">
                {h < 10 ? `0${h}` : h}:00 — {count} appts
              </div>
              <div className="w-full flex-1 flex items-end justify-center">
                <div
                  className={`w-full max-w-[22px] rounded-t-lg transition-all duration-300 group-hover:scale-105 ${isPeak ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 ring-2 ring-indigo-500/30' : 'bg-gradient-to-t from-violet-500/70 to-violet-400/70'}`}
                  style={{ height: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                />
              </div>
              {h % 3 === 0 && <span className="text-[9px] text-faint leading-none mt-1">{h < 10 ? `0${h}` : h}</span>}
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-indigo-500/5 px-4 py-3">
          <p className="text-xs text-muted">Busiest Hour</p>
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-300">{peakHour < 10 ? `0${peakHour}` : peakHour}:00</p>
          <p className="text-xs text-faint">{max} appointments</p>
        </div>
        <div className="rounded-xl bg-card-strong/50 px-4 py-3">
          <p className="text-xs text-muted">Quietest Hour</p>
          <p className="text-lg font-bold text-heading">{hours.indexOf(Math.min(...hours)) < 10 ? `0${hours.indexOf(Math.min(...hours))}` : hours.indexOf(Math.min(...hours))}:00</p>
          <p className="text-xs text-faint">{Math.min(...hours)} appointments</p>
        </div>
      </div>
    </Modal>
  )
}

function AnalyticsPage() {
  const { hospital, appointments, patients, staff } = useHospitalData()
  const [invoices, setInvoices] = useState(null)
  const [range, setRange] = useState('30')
  const [modal, setModal] = useState(null)

  useEffect(() => subscribeInvoices(hospital?.slug || '', setInvoices), [hospital?.slug])

  const days = getRangeDays(range)

  const stats = useMemo(() => {
    const cutoff = shiftDateString(-days)
    const rangeAppts = days === 0
      ? appointments.filter((a) => a.date === todayDateString())
      : appointments.filter((a) => a.date >= cutoff)
    const rangeInvoices = (invoices || []).filter((inv) => {
      const d = inv.date || (inv.createdAt?.toDate ? todayDateString(inv.createdAt.toDate()) : '')
      return days === 0 ? d === todayDateString() : d >= cutoff
    })
    const paid = rangeInvoices.filter((i) => i.status === 'paid')
    const totalRevenue = paid.reduce((s, i) => s + (i.total || 0), 0)
    const doctorCount = staff.filter((s) => s.role === ROLES.DOCTOR && s.status === 'active').length
    const completionRate = rangeAppts.length > 0 ? Math.round((rangeAppts.filter((a) => a.status === 'completed').length / rangeAppts.length) * 100) : 0
    return { rangeAppts, rangeInvoices, totalRevenue, doctorCount, completionRate }
  }, [appointments, invoices, staff, days])

  const dailyAppts = useMemo(() => buildDailyCounts(stats.rangeAppts, days), [stats.rangeAppts, days])
  const dailyRevenue = useMemo(() => buildRevenueByDay(stats.rangeInvoices, days), [stats.rangeInvoices, days])
  // Both used to compute from the full, unfiltered `appointments` list —
  // switching the range selector silently had no effect on either section,
  // unlike every other card on this page. Now consistent with the rest.
  const doctorStats = useMemo(() => buildDoctorStats(stats.rangeAppts, staff), [stats.rangeAppts, staff])
  const peakHours = useMemo(() => buildPeakHours(stats.rangeAppts), [stats.rangeAppts])
  const deptStats = useMemo(() => buildDepartmentStats(stats.rangeAppts), [stats.rangeAppts])

  if (hospital === undefined || invoices === null) return <PageSpinner />

  const greetingTime = new Date().getHours()
  const greeting = greetingTime < 12 ? 'Good morning' : greetingTime < 17 ? 'Good afternoon' : 'Good evening'
  const rangeLabel = RANGE_OPTIONS.find((o) => o.key === range)?.label || '30 Days'

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-600 to-blue-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="absolute top-1/2 right-8 -translate-y-1/2 hidden lg:block opacity-10">
          <NavIcon name="analytics" className="h-32 w-32" />
        </div>
        <div className="relative">
          <p className="text-sm font-medium text-indigo-100">{greeting}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="mt-2 max-w-lg text-sm text-indigo-100/80">
            Insights for <span className="font-semibold text-white">{hospital?.title}</span> — showing <span className="font-semibold text-white">{rangeLabel}</span> data.
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
              const headers = ['Date', 'Total', 'Completed', 'Pending', 'Scheduled', 'Cancelled']
              const rows = dailyAppts.map((d) => [d.date, d.total, d.completed, d.pending, d.scheduled, d.cancelled])
              exportToCSV(headers, rows, `appointments-trend-${todayDateString()}`)
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
          label="Appointments"
          value={stats.rangeAppts.length}
          hint={`${stats.completionRate}% completion rate`}
          icon="appointments"
          color="from-sky-500/15 to-sky-500/5"
          onClick={() => setModal({ type: 'appointments' })}
        />
        <StatCard
          label="Patients"
          value={patients.length}
          hint="All registered"
          icon="patients"
          color="from-emerald-500/15 to-emerald-500/5"
          onClick={() => setModal({ type: 'appointments', status: 'all' })}
        />
        <StatCard
          label="Revenue"
          value={formatMoney(stats.totalRevenue)}
          hint={`${stats.rangeInvoices.length} invoices`}
          icon="billing"
          color="from-amber-500/15 to-amber-500/5"
          onClick={() => setModal({ type: 'invoices' })}
        />
        <StatCard
          label="Active Doctors"
          value={stats.doctorCount}
          hint="Currently on staff"
          icon="doctors"
          color="from-violet-500/15 to-violet-500/5"
          onClick={() => setModal({ type: 'doctorPerformance' })}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Appointment Trends</h2>
            <button
              onClick={() => setModal({ type: 'appointments' })}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
            >
              View all →
            </button>
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
            <h2 className="text-sm font-semibold text-heading">Status Breakdown</h2>
            <span className="text-xs text-faint">{stats.rangeAppts.length} total</span>
          </div>
          {stats.rangeAppts.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No data</p>
          ) : (
            <StatusBreakdown
              appointments={stats.rangeAppts}
              onStatusClick={(status) => setModal({ type: 'appointments', status })}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Revenue Trends</h2>
            <button
              onClick={() => setModal({ type: 'invoices' })}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
            >
              View invoices →
            </button>
          </div>
          {dailyRevenue.every((d) => d.amount === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-card-strong flex items-center justify-center mb-3">
                <NavIcon name="billing" className="h-6 w-6 text-faint" />
              </div>
              <p className="text-sm font-medium text-muted">No revenue in this period</p>
            </div>
          ) : (
            <BarChart data={dailyRevenue} valueKey="amount" color="from-emerald-500 to-emerald-400" height={140} />
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Top Doctors</h2>
            <button
              onClick={() => setModal({ type: 'doctorPerformance' })}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
            >
              View all →
            </button>
          </div>
          {doctorStats.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No data</p>
          ) : (
            <div className="space-y-3">
              {doctorStats.slice(0, 4).map((doc, i) => {
                const pct = doc.total > 0 ? Math.round((doc.completed / doc.total) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-card-strong/30 px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[11px] font-bold text-violet-600 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
                      {doc.name?.[0]?.toUpperCase() || '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-heading">{doc.name}</p>
                      <p className="text-[11px] text-faint">{doc.completed}/{doc.total} · {pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Peak Hours</h2>
            <button
              onClick={() => setModal({ type: 'peakHours' })}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
            >
              Details →
            </button>
          </div>
          <PeakHoursChart hours={peakHours} />
        </div>

        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-heading">Departments</h2>
            <span className="text-xs text-faint">{deptStats.length} departments</span>
          </div>
          {deptStats.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No data</p>
          ) : (
            <div className="space-y-3">
              {deptStats.slice(0, 6).map((dept, i) => {
                const pct = stats.rangeAppts.length > 0 ? Math.round((dept.total / stats.rangeAppts.length) * 100) : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-heading">{dept.name}</span>
                      <span className="text-muted">{dept.total} <span className="text-faint">({pct}%)</span></span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-card-strong">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'appointments' && (
        <AppointmentsModal
          appointments={modal.status ? stats.rangeAppts.filter((a) => a.status === modal.status) : stats.rangeAppts}
          initialStatus={modal.status || 'all'}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'invoices' && (
        <InvoicesModal invoices={stats.rangeInvoices} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'doctorPerformance' && (
        <DoctorPerformanceModal doctorStats={doctorStats} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'peakHours' && (
        <PeakHoursModal hours={peakHours} appointments={appointments} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

export default AnalyticsPage
