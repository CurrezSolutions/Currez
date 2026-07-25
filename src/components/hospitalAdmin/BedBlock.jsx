import { useState } from 'react'
import BedIcon from './BedIcon'
import { computeDaysSince, computeRunningCharges, getBedDisplayStatus } from '../../utils/bedManagement'

const STYLES = {
  vacant:
    'bg-emerald-500/8 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/14 cursor-pointer',
  occupied:
    'bg-red-500/8 border-red-500/25 text-red-500 hover:border-red-500/45 cursor-pointer',
  maintenance:
    'bg-slate-500/8 border-slate-500/25 text-slate-400 dark:text-slate-500 cursor-not-allowed',
}

function BedBlock({ bed, admission, onSelect, canManage, onToggleMaintenance, onTransferRequest }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const rawStatus = getBedDisplayStatus(bed, admission)

  const days = admission ? computeDaysSince(admission.admittedAt) : 0
  const charges = admission ? computeRunningCharges(admission.dailyRate, admission.admittedAt) : 0

  const clickable = rawStatus !== 'maintenance' || !!admission
  const showQuickAction = canManage

  return (
    <div className="group relative">
      <button
        type="button"
        disabled={!clickable}
        onClick={() => clickable && onSelect?.(bed, admission)}
        className={`flex w-full min-w-28 flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all duration-200 ${STYLES[rawStatus]} ${!clickable ? 'opacity-70' : ''}`}
      >
        <BedIcon status={rawStatus} className="h-7 w-7" />

        <span className="text-xs font-bold tracking-wide text-heading">{bed.bedId}</span>

        <span className="text-[10px] font-medium uppercase tracking-wider text-faint">
          {(bed.type || 'general').replace(/([A-Z])/g, ' $1').trim()}
        </span>

        {rawStatus === 'occupied' && admission ? (
          <div className="mt-0.5 flex flex-col items-center gap-0.5">
            <span className="max-w-full truncate text-[11px] font-medium text-heading">
              {admission.patientName}
            </span>
            <span className="text-[10px] text-muted">{days}d</span>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              ₹{charges.toLocaleString('en-IN')}
            </span>
          </div>
        ) : rawStatus === 'maintenance' ? (
          <span className="mt-0.5 text-[11px] font-medium">Out of service</span>
        ) : (
          <span className="mt-0.5 text-[11px] font-medium">Vacant</span>
        )}
      </button>

      {showQuickAction && (
        <div className="absolute top-1.5 right-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full text-faint opacity-0 transition-opacity hover:bg-card-strong hover:text-heading group-hover:opacity-100 focus:opacity-100"
            aria-label="Bed quick actions"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-6 right-0 z-20 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-fade-in-up">
                {admission ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onTransferRequest?.(bed, admission)
                    }}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-body hover:bg-card-strong hover:text-heading"
                  >
                    Move to another bed
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onToggleMaintenance?.(bed, rawStatus === 'maintenance' ? 'active' : 'maintenance')
                    }}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-body hover:bg-card-strong hover:text-heading"
                  >
                    {rawStatus === 'maintenance' ? 'Mark as available' : 'Mark under maintenance'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default BedBlock
