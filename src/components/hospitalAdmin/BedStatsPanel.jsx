import { useMemo, useState } from 'react'
import Modal from '../common/Modal'
import { bedKey, getOccupiedMap, getBedDisplayStatus, formatBedLocation, getBedTypeColor } from '../../utils/bedManagement'

function BedStatsPanel({ stats, allBeds, bedTypes, activeAdmissions, onBedSelect }) {
  const [modalStatus, setModalStatus] = useState(null)
  const [modalSearch, setModalSearch] = useState('')

  const occupiedMap = useMemo(() => getOccupiedMap(activeAdmissions || []), [activeAdmissions])

  function findAdmission(bed) {
    return occupiedMap.get(bedKey(bed.floorId, bed.wardId, bed.roomId, bed.bedId)) || null
  }

  const modalBeds = modalStatus
    ? (allBeds || []).filter((b) => getBedDisplayStatus(b, findAdmission(b)) === modalStatus)
    : []

  const searchedBeds = modalSearch.trim()
    ? modalBeds.filter((b) => {
        const q = modalSearch.toLowerCase()
        const admission = findAdmission(b)
        if (admission?.patientName?.toLowerCase().includes(q)) return true
        if (b.bedId?.toLowerCase().includes(q)) return true
        if (formatBedLocation(b).toLowerCase().includes(q)) return true
        return false
      })
    : modalBeds

  function handleBedClick(bed) {
    const admission = findAdmission(bed)
    setModalStatus(null)
    setModalSearch('')
    onBedSelect?.(bed, admission)
  }

  const modalLabels = {
    occupied: { title: 'Occupied Beds', empty: 'No beds are currently occupied.', hint: 'discharge' },
    vacant: { title: 'Vacant Beds', empty: 'No vacant beds available.', hint: 'admit' },
    maintenance: { title: 'Beds Under Maintenance', empty: 'No beds are marked under maintenance.', hint: 'manage' },
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">Occupancy</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total" value={stats.total} color="text-heading" />
          <StatCard label="Rate" value={`${stats.occupancyRate}%`} color="text-indigo-600 dark:text-indigo-300" />
          <StatCard
            label="Occupied"
            value={stats.occupied}
            color="text-red-600 dark:text-red-400"
            onClick={() => setModalStatus('occupied')}
          />
          <StatCard
            label="Vacant"
            value={stats.vacant}
            color="text-emerald-600 dark:text-emerald-400"
            onClick={() => setModalStatus('vacant')}
          />
        </div>
      </div>

      {Object.keys(stats.byWard).length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">By Ward</h3>
          <div className="flex flex-col gap-1">
            {Object.entries(stats.byWard).map(([id, ward]) => (
              <div key={id} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-body">
                <span className="truncate font-medium">{ward.name}</span>
                <span className="shrink-0 pl-2 text-faint">
                  {ward.occupied}/{ward.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department/type color key (e.g. ICU = yellow, per BedConfigBuilder's
          color picker) — lets staff match a color seen on the grid back to a
          department without hovering every bed. */}
      {Object.keys(stats.byType).length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">By Type</h3>
          <div className="flex flex-col gap-1">
            {Object.entries(stats.byType).map(([key, t]) => (
              <div key={key} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-body">
                <span className="flex items-center gap-2 truncate font-medium">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: getBedTypeColor(bedTypes, key) }} />
                  {bedTypes?.[key]?.label || key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="shrink-0 pl-2 text-faint">
                  {t.occupied}/{t.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Legend</h3>
        <div className="flex flex-col gap-1.5 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Vacant
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Occupied
          </div>
          {stats.maintenance > 0 && (
            <button
              type="button"
              onClick={() => setModalStatus('maintenance')}
              className="flex items-center gap-2 text-left transition-colors hover:text-heading"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Under maintenance
              <span className="text-faint">({stats.maintenance})</span>
            </button>
          )}
        </div>
      </div>

      {modalStatus && (
        <Modal onClose={() => { setModalStatus(null); setModalSearch('') }} className="max-w-lg">
          <h2 className="mb-1 text-lg font-bold text-heading">{modalLabels[modalStatus].title}</h2>
          <p className="mb-3 text-xs text-muted">
            {modalBeds.length} bed{modalBeds.length !== 1 ? 's' : ''} &middot; Click a bed to {modalLabels[modalStatus].hint}
          </p>

          <input
            type="text"
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            placeholder="Search by patient name, bed ID, ward, room..."
            className="mb-3 w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading placeholder-faint outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
          />

          {modalBeds.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{modalLabels[modalStatus].empty}</p>
          ) : searchedBeds.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No beds match your search.</p>
          ) : (
            <div className="flex max-h-[55vh] flex-col gap-1.5 overflow-y-auto">
              {searchedBeds.map((bed) => {
                const admission = findAdmission(bed)
                const displayStatus = getBedDisplayStatus(bed, admission)
                const dotClass =
                  displayStatus === 'occupied' ? 'bg-red-500' : displayStatus === 'maintenance' ? 'bg-slate-400' : 'bg-emerald-500'
                const cardClass =
                  displayStatus === 'occupied'
                    ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30'
                    : displayStatus === 'maintenance'
                      ? 'border-slate-400/25 bg-slate-400/5 hover:bg-slate-400/10 hover:border-slate-400/40'
                      : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                return (
                  <button
                    key={`${bed.floorId}/${bed.wardId}/${bed.roomId}/${bed.bedId}`}
                    type="button"
                    onClick={() => handleBedClick(bed)}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${cardClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-bold text-heading">
                        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                        {bed.bedId}
                      </span>
                      <span className="text-[10px] font-semibold uppercase text-faint">{displayStatus}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted">{formatBedLocation(bed)}</div>
                    {admission?.patientName && (
                      <div className="mt-1.5 text-xs font-medium text-heading">{admission.patientName}</div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function StatCard({ label, value, color, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer rounded-xl border border-line/80 bg-card p-3 text-center transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5"
      >
        <div className={`text-lg font-bold ${color}`}>{value}</div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</div>
      </button>
    )
  }
  return (
    <div className="rounded-xl border border-line/80 bg-card p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</div>
    </div>
  )
}

export default BedStatsPanel
