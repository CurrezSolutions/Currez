import BedBlock from './BedBlock'
import { bedKey, getOccupiedMap, countBedsUnder } from '../../utils/bedManagement'

// Renders the selected floor as stacked "zone cards" — one per ward, one per
// room that sits directly on the floor, plus a card for beds that sit
// directly on the floor with no ward/room at all. Every level is optional,
// so a hospital can mix "Floor → Room → Bed", "Floor → Ward → Bed" and the
// full "Floor → Ward → Room → Bed" shape side by side.
function BedGrid({ floors, bedTypes, activeAdmissions, selectedFloorId, wardFilter, onBedSelect, canManage, onToggleMaintenance, onTransferRequest }) {
  const occupiedMap = getOccupiedMap(activeAdmissions || [])

  function admissionFor(bed) {
    return occupiedMap.get(bedKey(bed.floorId, bed.wardId, bed.roomId, bed.bedId)) || null
  }

  const filteredFloors = (floors || []).filter((floor) => !selectedFloorId || floor.id === selectedFloorId)

  if (filteredFloors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7h18M3 7l1.5-3h15L21 7 M7 11h.01 M12 11h.01 M17 11h.01" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-heading">No beds configured yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Use "Configure Beds" to build your floors, wards and rooms — it only takes a couple of minutes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {filteredFloors.map((floor) => {
        const directBeds = floor.beds || []
        const directRooms = floor.rooms || []
        const wards = (floor.wards || []).filter((w) => !wardFilter || w.id === wardFilter)
        const hideDirect = !!wardFilter

        const nothingToShow =
          (hideDirect || directBeds.length === 0) &&
          (hideDirect || directRooms.length === 0) &&
          wards.length === 0

        if (nothingToShow) return null

        return (
          <div key={floor.id}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-heading">{floor.name}</h2>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="flex flex-col gap-4">
              {!hideDirect && directBeds.length > 0 && (
                <ZoneCard
                  title={`${floor.name} — Beds`}
                  beds={directBeds.map((b) => ({ ...b, floorId: floor.id, floorName: floor.name, wardId: null, wardName: null, roomId: null, roomName: null }))}
                  admissionFor={admissionFor}
                  bedTypes={bedTypes}
                  onBedSelect={onBedSelect}
                  canManage={canManage}
                  onToggleMaintenance={onToggleMaintenance}
                  onTransferRequest={onTransferRequest}
                />
              )}

              {!hideDirect &&
                directRooms.map((room) => (
                  <ZoneCard
                    key={room.id}
                    title={room.name}
                    beds={(room.beds || []).map((b) => ({
                      ...b,
                      floorId: floor.id,
                      floorName: floor.name,
                      wardId: null,
                      wardName: null,
                      roomId: room.id,
                      roomName: room.name,
                    }))}
                    admissionFor={admissionFor}
                    bedTypes={bedTypes}
                    onBedSelect={onBedSelect}
                    canManage={canManage}
                    onToggleMaintenance={onToggleMaintenance}
                    onTransferRequest={onTransferRequest}
                  />
                ))}

              {wards.map((ward) => {
                const wardBeds = (ward.beds || []).map((b) => ({
                  ...b,
                  floorId: floor.id,
                  floorName: floor.name,
                  wardId: ward.id,
                  wardName: ward.name,
                  roomId: null,
                  roomName: null,
                }))
                const rooms = ward.rooms || []

                return (
                  <div key={ward.id} className="rounded-2xl border border-line/80 bg-surface p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-heading">{ward.name}</h3>
                      <OccupancyBadge total={countBedsUnder(ward)} occupied={countOccupied(ward, floor, admissionFor)} />
                    </div>

                    <div className="flex flex-col gap-4">
                      {wardBeds.length > 0 && (
                        <BedSubSection
                          label={null}
                          beds={wardBeds}
                          admissionFor={admissionFor}
                          bedTypes={bedTypes}
                          onBedSelect={onBedSelect}
                          canManage={canManage}
                          onToggleMaintenance={onToggleMaintenance}
                          onTransferRequest={onTransferRequest}
                        />
                      )}
                      {rooms.map((room) => (
                        <BedSubSection
                          key={room.id}
                          label={room.name}
                          beds={(room.beds || []).map((b) => ({
                            ...b,
                            floorId: floor.id,
                            floorName: floor.name,
                            wardId: ward.id,
                            wardName: ward.name,
                            roomId: room.id,
                            roomName: room.name,
                          }))}
                          admissionFor={admissionFor}
                          bedTypes={bedTypes}
                          onBedSelect={onBedSelect}
                          canManage={canManage}
                          onToggleMaintenance={onToggleMaintenance}
                          onTransferRequest={onTransferRequest}
                        />
                      ))}
                      {wardBeds.length === 0 && rooms.length === 0 && (
                        <p className="text-xs text-faint">No beds in this ward yet.</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function countOccupied(ward, floor, admissionFor) {
  let n = 0
  for (const b of ward.beds || []) {
    if (admissionFor({ ...b, floorId: floor.id, wardId: ward.id, roomId: null })) n++
  }
  for (const room of ward.rooms || []) {
    for (const b of room.beds || []) {
      if (admissionFor({ ...b, floorId: floor.id, wardId: ward.id, roomId: room.id })) n++
    }
  }
  return n
}

function ZoneCard({ title, beds, admissionFor, bedTypes, onBedSelect, canManage, onToggleMaintenance, onTransferRequest }) {
  const occupied = beds.filter((b) => admissionFor(b)).length
  return (
    <div className="rounded-2xl border border-line/80 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-heading">{title}</h3>
        <OccupancyBadge total={beds.length} occupied={occupied} />
      </div>
      <div className="flex flex-wrap gap-2">
        {beds.map((bed) => (
          <BedBlock
            key={bed.bedId}
            bed={bed}
            bedTypes={bedTypes}
            admission={admissionFor(bed)}
            onSelect={onBedSelect}
            canManage={canManage}
            onToggleMaintenance={onToggleMaintenance}
            onTransferRequest={onTransferRequest}
          />
        ))}
      </div>
    </div>
  )
}

function BedSubSection({ label, beds, admissionFor, bedTypes, onBedSelect, canManage, onToggleMaintenance, onTransferRequest }) {
  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-medium text-faint">{label}</span>
          <span className="text-[10px] text-faint/60">
            {beds.length} bed{beds.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {beds.map((bed) => (
          <BedBlock
            key={bed.bedId}
            bed={bed}
            bedTypes={bedTypes}
            admission={admissionFor(bed)}
            onSelect={onBedSelect}
            canManage={canManage}
            onToggleMaintenance={onToggleMaintenance}
            onTransferRequest={onTransferRequest}
          />
        ))}
      </div>
    </div>
  )
}

function OccupancyBadge({ total, occupied }) {
  return (
    <span className="rounded-full bg-card-strong px-2.5 py-1 text-[11px] font-semibold text-muted tabular-nums">
      {occupied}/{total} occupied
    </span>
  )
}

export default BedGrid
