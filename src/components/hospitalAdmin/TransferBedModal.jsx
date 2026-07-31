import { useMemo, useState } from 'react'
import Modal from '../common/Modal'
import { bedKey, formatBedLocation, getBedDisplayStatus, getOccupiedMap, getBedTypeColor } from '../../utils/bedManagement'

// Moves an already-admitted patient to a different vacant bed in place —
// the alternative to discharge-then-readmit, which used to fragment one
// continuous stay into two admissions (and two invoices, since the invoice
// doc id is the admission id). Picking a bed here just relocates the same
// admission record via transferAdmission().
function TransferBedModal({ admission, allBeds, activeAdmissions, config, onTransfer, onClose }) {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const occupiedMap = useMemo(() => getOccupiedMap(activeAdmissions || []), [activeAdmissions])

  const vacantBeds = useMemo(
    () =>
      (allBeds || []).filter((b) => {
        const adm = occupiedMap.get(bedKey(b.floorId, b.wardId, b.roomId, b.bedId)) || null
        return getBedDisplayStatus(b, adm) === 'vacant'
      }),
    [allBeds, occupiedMap]
  )

  const filteredBeds = search.trim()
    ? vacantBeds.filter((b) => {
        const q = search.toLowerCase()
        return b.bedId?.toLowerCase().includes(q) || formatBedLocation(b).toLowerCase().includes(q)
      })
    : vacantBeds

  async function handlePick(bed) {
    setError('')
    setLoading(true)
    try {
      await onTransfer({
        floorId: bed.floorId,
        floorName: bed.floorName,
        wardId: bed.wardId,
        wardName: bed.wardName,
        roomId: bed.roomId,
        roomName: bed.roomName,
        bedId: bed.bedId,
        bedType: bed.type,
        dailyRate: config?.bedTypes?.[bed.type]?.ratePerDay || 0,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to move patient.')
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <h2 className="mb-1 text-lg font-bold text-heading">Move to Another Bed</h2>
      <p className="mb-4 text-sm text-muted">
        {admission.patientName} — currently Bed {admission.bedId}
        {formatBedLocation(admission) && <> · {formatBedLocation(admission)}</>}
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by bed ID, floor, ward, room..."
        className="mb-3 w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-heading placeholder-faint outline-none transition-colors focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
      />

      {error && <p className="mb-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      {vacantBeds.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No vacant beds available to move to right now.</p>
      ) : filteredBeds.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No beds match your search.</p>
      ) : (
        <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {filteredBeds.map((bed) => {
            const rate = config?.bedTypes?.[bed.type]?.ratePerDay || 0
            return (
              <button
                key={`${bed.floorId}/${bed.wardId}/${bed.roomId}/${bed.bedId}`}
                type="button"
                disabled={loading}
                onClick={() => handlePick(bed)}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-left transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-heading">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getBedTypeColor(config?.bedTypes, bed.type) }} />
                    {bed.bedId}
                  </span>
                  <span className="text-xs font-medium text-muted">₹{rate.toLocaleString('en-IN')}/day</span>
                </div>
                <div className="mt-1 text-[11px] text-muted">{formatBedLocation(bed)}</div>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default TransferBedModal
