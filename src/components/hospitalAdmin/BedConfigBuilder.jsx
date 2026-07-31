import { useMemo, useState } from 'react'
import NavIcon from '../common/NavIcon'
import {
  createEmptyFloor,
  createEmptyWard,
  createEmptyRoom,
  generateBedBatch,
  flattenBeds,
  bedKey,
  getOccupiedMap,
  countBedsUnder,
  getBedTypeColor,
  BED_TYPE_COLOR_PALETTE,
} from '../../utils/bedManagement'

// Colors follow BED_TYPE_COLOR_PALETTE's fixed order (slot 1-4) so the
// out-of-the-box look is already colorblind-safe — ICU defaults to yellow,
// matching how hospitals commonly color-code that department.
const DEFAULT_BED_TYPES = {
  general: { label: 'General', ratePerDay: 500, color: BED_TYPE_COLOR_PALETTE[0] },
  semiPrivate: { label: 'Semi-Private', ratePerDay: 1500, color: BED_TYPE_COLOR_PALETTE[1] },
  private: { label: 'Private Room', ratePerDay: 3000, color: BED_TYPE_COLOR_PALETTE[2] },
  icu: { label: 'ICU', ratePerDay: 5000, color: BED_TYPE_COLOR_PALETTE[3] },
}

function bedCountLabel(n) {
  return `${n} bed${n !== 1 ? 's' : ''}`
}

// Full-width visual builder for the floor → ward → room → bed hierarchy —
// a collapsible accordion (floor cards containing ward cards containing
// room cards) rather than a cramped modal, so setting up a hospital takes
// minutes instead of dozens of individual "+ Bed" clicks. Every level
// (ward, room, bed) is optional at every parent — a floor can hold a room
// directly, a ward can hold beds directly, matching how real hospitals are
// actually laid out.
// Config is only ever read once, on mount — after that, local edit state is
// the source of truth. This is deliberate: without it, the Firestore
// onSnapshot echo that follows every save would re-fire this component's
// props and (via a config-keyed effect) blow away in-progress edits and
// collapsed/expanded state mid-session.
function initBuilderState(config) {
  const bedTypes = config?.bedTypes || { ...DEFAULT_BED_TYPES }
  const floors = JSON.parse(JSON.stringify(config?.floors || []))
  return { bedTypes, floors, snapshot: JSON.stringify({ bedTypes, floors }) }
}

function BedConfigBuilder({ config, activeAdmissions, onSave, onClose }) {
  const [initial] = useState(() => initBuilderState(config))
  const [bedTypes, setBedTypes] = useState(initial.bedTypes)
  const [floors, setFloors] = useState(initial.floors)
  const [expandedFloors, setExpandedFloors] = useState(() => new Set(initial.floors.map((f) => f.id)))
  const [expandedWards, setExpandedWards] = useState(
    () => new Set(initial.floors.flatMap((f) => (f.wards || []).map((w) => w.id)))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [initialSnapshot, setInitialSnapshot] = useState(initial.snapshot)

  const occupiedMap = useMemo(() => getOccupiedMap(activeAdmissions || []), [activeAdmissions])
  const dirty = JSON.stringify({ bedTypes, floors }) !== initialSnapshot
  const totalBeds = floors.reduce((sum, f) => sum + countBedsUnder(f), 0)

  function toggleFloor(floorId) {
    setExpandedFloors((prev) => {
      const next = new Set(prev)
      next.has(floorId) ? next.delete(floorId) : next.add(floorId)
      return next
    })
  }

  function toggleWard(wardId) {
    setExpandedWards((prev) => {
      const next = new Set(prev)
      next.has(wardId) ? next.delete(wardId) : next.add(wardId)
      return next
    })
  }

  // ── Delete guards ──────────────────────────────────────────────────────
  function bedsUnder(floor, wardId, roomId) {
    if (roomId) {
      const rooms = wardId ? floor.wards?.find((w) => w.id === wardId)?.rooms : floor.rooms
      const room = (rooms || []).find((r) => r.id === roomId)
      return (room?.beds || []).map((b) => ({ ...b, floorId: floor.id, wardId: wardId || null, roomId }))
    }
    if (wardId) {
      const ward = floor.wards?.find((w) => w.id === wardId)
      if (!ward) return []
      const direct = (ward.beds || []).map((b) => ({ ...b, floorId: floor.id, wardId, roomId: null }))
      const nested = (ward.rooms || []).flatMap((r) =>
        (r.beds || []).map((b) => ({ ...b, floorId: floor.id, wardId, roomId: r.id }))
      )
      return [...direct, ...nested]
    }
    return flattenBeds({ floors: [floor] })
  }

  function hasActiveAdmissions(floor, wardId, roomId) {
    return bedsUnder(floor, wardId, roomId).some((b) =>
      occupiedMap.has(bedKey(b.floorId, b.wardId, b.roomId, b.bedId))
    )
  }

  function guardDelete(floor, wardId, roomId, label) {
    if (hasActiveAdmissions(floor, wardId, roomId)) {
      setError(`Discharge the active patient(s) in "${label}" before deleting it.`)
      return false
    }
    setError('')
    return true
  }

  // ── Floor operations ───────────────────────────────────────────────────
  function addFloor() {
    const floor = createEmptyFloor(floors.length + 1)
    setFloors((prev) => [...prev, floor])
    setExpandedFloors((prev) => new Set(prev).add(floor.id))
  }

  function removeFloor(floor) {
    if (!guardDelete(floor, null, null, floor.name)) return
    setFloors((prev) => prev.filter((f) => f.id !== floor.id))
  }

  function renameFloor(floorId, name) {
    setFloors((prev) => prev.map((f) => (f.id === floorId ? { ...f, name } : f)))
  }

  function moveFloor(floorId, dir) {
    setFloors((prev) => {
      const idx = prev.findIndex((f) => f.id === floorId)
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((f, i) => ({ ...f, order: i + 1 }))
    })
  }

  // ── Ward operations ────────────────────────────────────────────────────
  function addWard(floorId) {
    const floor = floors.find((f) => f.id === floorId)
    const ward = createEmptyWard((floor?.wards?.length || 0) + 1)
    setFloors((prev) => prev.map((f) => (f.id === floorId ? { ...f, wards: [...(f.wards || []), ward] } : f)))
    setExpandedWards((prev) => new Set(prev).add(ward.id))
  }

  function removeWard(floor, ward) {
    if (!guardDelete(floor, ward.id, null, ward.name)) return
    setFloors((prev) =>
      prev.map((f) => (f.id === floor.id ? { ...f, wards: f.wards.filter((w) => w.id !== ward.id) } : f))
    )
  }

  function renameWard(floorId, wardId, name) {
    setFloors((prev) =>
      prev.map((f) =>
        f.id === floorId ? { ...f, wards: f.wards.map((w) => (w.id === wardId ? { ...w, name } : w)) } : f
      )
    )
  }

  // ── Room operations (direct-on-floor when wardId is null) ─────────────
  function addRoom(floorId, wardId) {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.id !== floorId) return f
        if (wardId) {
          return {
            ...f,
            wards: f.wards.map((w) =>
              w.id === wardId
                ? { ...w, rooms: [...(w.rooms || []), createEmptyRoom(`Room ${(w.rooms?.length || 0) + 1}`)] }
                : w
            ),
          }
        }
        return { ...f, rooms: [...(f.rooms || []), createEmptyRoom(`Room ${(f.rooms?.length || 0) + 1}`)] }
      })
    )
  }

  function removeRoom(floor, wardId, room) {
    if (!guardDelete(floor, wardId, room.id, room.name)) return
    setFloors((prev) =>
      prev.map((f) => {
        if (f.id !== floor.id) return f
        if (wardId) {
          return { ...f, wards: f.wards.map((w) => (w.id === wardId ? { ...w, rooms: w.rooms.filter((r) => r.id !== room.id) } : w)) }
        }
        return { ...f, rooms: f.rooms.filter((r) => r.id !== room.id) }
      })
    )
  }

  function renameRoom(floorId, wardId, roomId, name) {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.id !== floorId) return f
        if (wardId) {
          return {
            ...f,
            wards: f.wards.map((w) =>
              w.id === wardId ? { ...w, rooms: w.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)) } : w
            ),
          }
        }
        return { ...f, rooms: f.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)) }
      })
    )
  }

  // ── Bed operations (floorId + optional wardId + optional roomId) ──────
  function withBeds(node, fn) {
    return { ...node, beds: fn(node.beds || []) }
  }

  function addBeds(floorId, wardId, roomId, newBeds) {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.id !== floorId) return f
        if (roomId) {
          const patchRooms = (rooms) => (rooms || []).map((r) => (r.id === roomId ? withBeds(r, (beds) => [...beds, ...newBeds]) : r))
          if (wardId) {
            return { ...f, wards: f.wards.map((w) => (w.id === wardId ? { ...w, rooms: patchRooms(w.rooms) } : w)) }
          }
          return { ...f, rooms: patchRooms(f.rooms) }
        }
        if (wardId) {
          return { ...f, wards: f.wards.map((w) => (w.id === wardId ? withBeds(w, (beds) => [...beds, ...newBeds]) : w)) }
        }
        return withBeds(f, (beds) => [...beds, ...newBeds])
      })
    )
  }

  // Addressed by array index rather than bedId — bedId is a free-text field
  // the admin edits inline, so two beds can transiently share an ID mid-edit
  // (e.g. a typo fix, or two bulk-adds with the same prefix); index stays
  // unambiguous while bedId doesn't.
  function removeBed(floorId, wardId, roomId, bedIndex) {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.id !== floorId) return f
        if (roomId) {
          const patchRooms = (rooms) => (rooms || []).map((r) => (r.id === roomId ? withBeds(r, (beds) => beds.filter((_, i) => i !== bedIndex)) : r))
          if (wardId) {
            return { ...f, wards: f.wards.map((w) => (w.id === wardId ? { ...w, rooms: patchRooms(w.rooms) } : w)) }
          }
          return { ...f, rooms: patchRooms(f.rooms) }
        }
        if (wardId) {
          return { ...f, wards: f.wards.map((w) => (w.id === wardId ? withBeds(w, (beds) => beds.filter((_, i) => i !== bedIndex)) : w)) }
        }
        return withBeds(f, (beds) => beds.filter((_, i) => i !== bedIndex))
      })
    )
  }

  function updateBed(floorId, wardId, roomId, bedIndex, patch) {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.id !== floorId) return f
        if (roomId) {
          const patchRooms = (rooms) => (rooms || []).map((r) => (r.id === roomId ? withBeds(r, (beds) => beds.map((b, i) => (i === bedIndex ? { ...b, ...patch } : b))) : r))
          if (wardId) {
            return { ...f, wards: f.wards.map((w) => (w.id === wardId ? { ...w, rooms: patchRooms(w.rooms) } : w)) }
          }
          return { ...f, rooms: patchRooms(f.rooms) }
        }
        if (wardId) {
          return { ...f, wards: f.wards.map((w) => (w.id === wardId ? withBeds(w, (beds) => beds.map((b, i) => (i === bedIndex ? { ...b, ...patch } : b))) : w)) }
        }
        return withBeds(f, (beds) => beds.map((b, i) => (i === bedIndex ? { ...b, ...patch } : b)))
      })
    )
  }

  // ── Bed types ───────────────────────────────────────────────────────────
  function addBedType() {
    const key = `type-${Date.now()}`
    setBedTypes((prev) => ({
      ...prev,
      [key]: { label: 'New Type', ratePerDay: 0, color: BED_TYPE_COLOR_PALETTE[Object.keys(prev).length % BED_TYPE_COLOR_PALETTE.length] },
    }))
  }
  function updateBedType(key, patch) {
    setBedTypes((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }
  function removeBedType(key) {
    setBedTypes((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function handleSave() {
    setError('')
    if (totalBeds === 0) {
      setError('Add at least one bed to save the configuration.')
      return
    }
    setLoading(true)
    try {
      await onSave({ bedTypes, floors })
      setInitialSnapshot(JSON.stringify({ bedTypes, floors }))
    } catch (err) {
      setError(err.message || 'Failed to save configuration.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
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
          <h1 className="text-2xl font-bold text-heading">Configure Beds &amp; Wards</h1>
          <p className="mt-0.5 text-sm text-muted">
            Add floors, wards, rooms and beds. Only beds are required — skip any level you don't need.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <BedTypesEditor bedTypes={bedTypes} onAdd={addBedType} onUpdate={updateBedType} onRemove={removeBedType} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-faint">{bedCountLabel(totalBeds)} configured</span>
        <button
          type="button"
          onClick={addFloor}
          className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          + Add Floor
        </button>
      </div>

      {floors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">
          No floors yet. Click "+ Add Floor" to start building your hospital's layout.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {floors.map((floor, idx) => (
            <FloorCard
              key={floor.id}
              floor={floor}
              bedTypes={bedTypes}
              isFirst={idx === 0}
              isLast={idx === floors.length - 1}
              expanded={expandedFloors.has(floor.id)}
              onToggle={() => toggleFloor(floor.id)}
              onMove={(dir) => moveFloor(floor.id, dir)}
              onRename={(name) => renameFloor(floor.id, name)}
              onDelete={() => removeFloor(floor)}
              onAddWard={() => addWard(floor.id)}
              onAddRoom={() => addRoom(floor.id, null)}
              onAddDirectBeds={(beds) => addBeds(floor.id, null, null, beds)}
              onRemoveDirectBed={(i) => removeBed(floor.id, null, null, i)}
              onUpdateDirectBed={(i, patch) => updateBed(floor.id, null, null, i, patch)}
              onRemoveRoom={(room) => removeRoom(floor, null, room)}
              onRenameRoom={(roomId, name) => renameRoom(floor.id, null, roomId, name)}
              onAddRoomBeds={(roomId, beds) => addBeds(floor.id, null, roomId, beds)}
              onRemoveRoomBed={(roomId, i) => removeBed(floor.id, null, roomId, i)}
              onUpdateRoomBed={(roomId, i, patch) => updateBed(floor.id, null, roomId, i, patch)}
              expandedWards={expandedWards}
              onToggleWard={toggleWard}
              onRemoveWard={(ward) => removeWard(floor, ward)}
              onRenameWard={(wardId, name) => renameWard(floor.id, wardId, name)}
              onAddWardRoom={(wardId) => addRoom(floor.id, wardId)}
              onAddWardBeds={(wardId, beds) => addBeds(floor.id, wardId, null, beds)}
              onRemoveWardBed={(wardId, i) => removeBed(floor.id, wardId, null, i)}
              onUpdateWardBed={(wardId, i, patch) => updateBed(floor.id, wardId, null, i, patch)}
              onRemoveWardRoom={(wardId, room) => removeRoom(floor, wardId, room)}
              onRenameWardRoom={(wardId, roomId, name) => renameRoom(floor.id, wardId, roomId, name)}
              onAddWardRoomBeds={(wardId, roomId, beds) => addBeds(floor.id, wardId, roomId, beds)}
              onRemoveWardRoomBed={(wardId, roomId, i) => removeBed(floor.id, wardId, roomId, i)}
              onUpdateWardRoomBed={(wardId, roomId, i, patch) => updateBed(floor.id, wardId, roomId, i, patch)}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xs text-muted">
            {bedCountLabel(totalBeds)} configured
            {dirty && <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">&bull; Unsaved changes</span>}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-card-strong hover:text-heading"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || !dirty}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BedTypesEditor({ bedTypes, onAdd, onUpdate, onRemove }) {
  return (
    <section className="rounded-2xl border border-line/80 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">Bed Types &amp; Rates</h3>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-300"
        >
          + Add Type
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(bedTypes).map(([key, bt]) => (
          <div key={key} className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5">
            <input
              type="color"
              value={bt.color || '#2a78d6'}
              onChange={(e) => onUpdate(key, { color: e.target.value })}
              title="Color for this bed type — shown on every bed of this type"
              className="h-5 w-5 shrink-0 cursor-pointer rounded-full border border-line bg-transparent p-0"
            />
            <input
              type="text"
              value={bt.label}
              onChange={(e) => onUpdate(key, { label: e.target.value })}
              className="w-24 bg-transparent text-sm font-medium text-heading outline-none"
              placeholder="Type name"
            />
            <span className="text-xs text-faint">₹</span>
            <input
              type="number"
              value={bt.ratePerDay}
              onChange={(e) => onUpdate(key, { ratePerDay: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 bg-transparent text-sm text-heading outline-none"
              min="0"
            />
            <span className="text-[10px] text-faint">/day</span>
            <button type="button" onClick={() => onRemove(key)} className="ml-1 rounded-full p-1 text-red-500 hover:bg-red-500/10">
              <NavIcon name="close" className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Accordion header shared by floor + ward cards ───────────────────────
function AccordionHeader({ expanded, onToggle, name, onRename, count, onDelete, strong, onMove, canMoveUp, canMoveDown }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-card-strong hover:text-heading"
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        <NavIcon name="chevronDown" className={`h-4 w-4 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>
      <input
        type="text"
        value={name}
        onChange={(e) => onRename(e.target.value)}
        className={`min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 outline-none transition-colors focus:border-line focus:bg-card ${
          strong ? 'text-base font-bold text-heading' : 'text-sm font-semibold text-heading'
        }`}
        placeholder="Name"
      />
      <span className="shrink-0 rounded-full bg-card-strong px-2.5 py-1 text-[11px] font-semibold text-muted tabular-nums">
        {bedCountLabel(count)}
      </span>
      {onMove && (
        <div className="flex shrink-0 flex-col">
          <button type="button" onClick={() => onMove(-1)} disabled={!canMoveUp} className="text-faint transition-colors hover:text-heading disabled:opacity-20">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 6l6 8H6z" /></svg>
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={!canMoveDown} className="text-faint transition-colors hover:text-heading disabled:opacity-20">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 18l-6-8h12z" /></svg>
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-red-500/10 hover:text-red-500"
        aria-label="Delete"
      >
        <NavIcon name="trash" className="h-4 w-4" />
      </button>
    </div>
  )
}

function ActionLink({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-300"
    >
      {label}
    </button>
  )
}

function FloorCard(props) {
  const { floor, bedTypes, expanded, onToggle, isFirst, isLast, onMove } = props
  const directBeds = floor.beds || []
  const directRooms = floor.rooms || []
  const wards = floor.wards || []
  const total = countBedsUnder(floor)

  return (
    <div className="rounded-2xl border border-line/80 bg-surface p-4">
      <AccordionHeader
        expanded={expanded}
        onToggle={onToggle}
        name={floor.name}
        onRename={props.onRename}
        count={total}
        onDelete={props.onDelete}
        strong
        onMove={onMove}
        canMoveUp={!isFirst}
        canMoveDown={!isLast}
      />

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 pl-9">
          <div className="flex flex-wrap gap-3">
            <ActionLink onClick={props.onAddWard} label="+ Add Ward" />
            <ActionLink onClick={props.onAddRoom} label="+ Add Room" />
          </div>

          <BedBatchAdder
            triggerLabel="+ Add bed to floor"
            contextName={floor.name}
            existingCount={directBeds.length}
            bedTypes={bedTypes}
            onAdd={props.onAddDirectBeds}
          />
          {directBeds.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-faint">Beds on this floor (no ward or room)</p>
              <BedList beds={directBeds} bedTypes={bedTypes} onRemove={props.onRemoveDirectBed} onUpdate={props.onUpdateDirectBed} />
            </div>
          )}

          {directRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              bedTypes={bedTypes}
              onRename={(name) => props.onRenameRoom(room.id, name)}
              onDelete={() => props.onRemoveRoom(room)}
              onAddBeds={(beds) => props.onAddRoomBeds(room.id, beds)}
              onRemoveBed={(i) => props.onRemoveRoomBed(room.id, i)}
              onUpdateBed={(i, patch) => props.onUpdateRoomBed(room.id, i, patch)}
            />
          ))}

          {wards.map((ward) => (
            <WardCard
              key={ward.id}
              ward={ward}
              bedTypes={bedTypes}
              expanded={props.expandedWards.has(ward.id)}
              onToggle={() => props.onToggleWard(ward.id)}
              onRename={(name) => props.onRenameWard(ward.id, name)}
              onDelete={() => props.onRemoveWard(ward)}
              onAddRoom={() => props.onAddWardRoom(ward.id)}
              onAddBeds={(beds) => props.onAddWardBeds(ward.id, beds)}
              onRemoveBed={(i) => props.onRemoveWardBed(ward.id, i)}
              onUpdateBed={(i, patch) => props.onUpdateWardBed(ward.id, i, patch)}
              onRemoveRoom={(room) => props.onRemoveWardRoom(ward.id, room)}
              onRenameRoom={(roomId, name) => props.onRenameWardRoom(ward.id, roomId, name)}
              onAddRoomBeds={(roomId, beds) => props.onAddWardRoomBeds(ward.id, roomId, beds)}
              onRemoveRoomBed={(roomId, i) => props.onRemoveWardRoomBed(ward.id, roomId, i)}
              onUpdateRoomBed={(roomId, i, patch) => props.onUpdateWardRoomBed(ward.id, roomId, i, patch)}
            />
          ))}

          {directRooms.length === 0 && wards.length === 0 && directBeds.length === 0 && (
            <p className="text-xs text-faint">Nothing on this floor yet — add a ward, a room, or beds directly above.</p>
          )}
        </div>
      )}
    </div>
  )
}

function WardCard(props) {
  const { ward, bedTypes, expanded, onToggle } = props
  const wardBeds = ward.beds || []
  const rooms = ward.rooms || []
  const total = countBedsUnder(ward)

  return (
    <div className="rounded-xl border border-line/60 bg-card p-3">
      <AccordionHeader
        expanded={expanded}
        onToggle={onToggle}
        name={ward.name}
        onRename={props.onRename}
        count={total}
        onDelete={props.onDelete}
      />

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 pl-9">
          <ActionLink onClick={props.onAddRoom} label="+ Add Room" />

          <BedBatchAdder
            triggerLabel="+ Add bed to ward"
            contextName={ward.name}
            existingCount={wardBeds.length}
            bedTypes={bedTypes}
            onAdd={props.onAddBeds}
          />
          {wardBeds.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-faint">Beds in this ward (no room)</p>
              <BedList beds={wardBeds} bedTypes={bedTypes} onRemove={props.onRemoveBed} onUpdate={props.onUpdateBed} />
            </div>
          )}

          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              bedTypes={bedTypes}
              onRename={(name) => props.onRenameRoom(room.id, name)}
              onDelete={() => props.onRemoveRoom(room)}
              onAddBeds={(beds) => props.onAddRoomBeds(room.id, beds)}
              onRemoveBed={(i) => props.onRemoveRoomBed(room.id, i)}
              onUpdateBed={(i, patch) => props.onUpdateRoomBed(room.id, i, patch)}
            />
          ))}

          {wardBeds.length === 0 && rooms.length === 0 && (
            <p className="text-xs text-faint">No beds in this ward yet — add a room or beds directly above.</p>
          )}
        </div>
      )}
    </div>
  )
}

function RoomCard({ room, bedTypes, onRename, onDelete, onAddBeds, onRemoveBed, onUpdateBed }) {
  const beds = room.beds || []
  return (
    <div className="rounded-lg border border-line/50 bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={room.name}
          onChange={(e) => onRename(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xs font-semibold text-heading outline-none transition-colors focus:border-line focus:bg-card"
          placeholder="Room name"
        />
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-red-500/10 hover:text-red-500"
          aria-label="Delete room"
        >
          <NavIcon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>

      {beds.length > 0 && <BedList beds={beds} bedTypes={bedTypes} onRemove={onRemoveBed} onUpdate={onUpdateBed} />}
      <BedBatchAdder triggerLabel="+ Add bed" contextName={room.name} existingCount={beds.length} bedTypes={bedTypes} onAdd={onAddBeds} />
    </div>
  )
}

function BedList({ beds, bedTypes, onRemove, onUpdate }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {beds.map((bed, idx) => (
        <div key={idx} className="flex items-center gap-1 rounded-lg border border-line/60 bg-card px-2 py-1">
          <input
            type="text"
            value={bed.bedId}
            onChange={(e) => onUpdate(idx, { bedId: e.target.value })}
            className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-bold text-heading outline-none focus:border-indigo-500/50 focus:bg-surface"
          />
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getBedTypeColor(bedTypes, bed.type) }} />
          <select
            value={bed.type}
            onChange={(e) => onUpdate(idx, { type: e.target.value })}
            className="rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] text-muted outline-none focus:border-indigo-500/50 focus:bg-surface"
          >
            {Object.entries(bedTypes).map(([k, bt]) => (
              <option key={k} value={k}>
                {bt.label}
              </option>
            ))}
          </select>
          {bed.status === 'maintenance' && (
            <span className="rounded bg-slate-400/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-slate-500">Maint.</span>
          )}
          <button type="button" onClick={() => onRemove(idx)} className="rounded-full p-0.5 text-red-500 transition-colors hover:bg-red-500/10">
            <NavIcon name="close" className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

function BedBatchAdder({ triggerLabel, contextName, existingCount, bedTypes, onAdd }) {
  const defaultPrefix = (contextName || 'BED').replace(/\s+/g, '').slice(0, 6).toUpperCase()
  const [open, setOpen] = useState(false)
  const [prefix, setPrefix] = useState(defaultPrefix)
  const [count, setCount] = useState(1)
  const [type, setType] = useState(Object.keys(bedTypes)[0] || 'general')

  if (!open) {
    return <ActionLink onClick={() => setOpen(true)} label={triggerLabel} />
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-card-strong p-2">
      <input
        type="text"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        placeholder="Prefix"
        className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-heading outline-none focus:border-indigo-500/50"
      />
      <input
        type="number"
        min="1"
        max="200"
        value={count}
        onChange={(e) => setCount(e.target.value)}
        className="w-14 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-heading outline-none focus:border-indigo-500/50"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-heading outline-none focus:border-indigo-500/50"
      >
        {Object.entries(bedTypes).map(([k, bt]) => (
          <option key={k} value={k}>
            {bt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onAdd(generateBedBatch(prefix, existingCount + 1, count, type))
          setOpen(false)
          setCount(1)
        }}
        className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-500"
      >
        Add {count || 0}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-[11px] text-muted hover:text-heading">
        Cancel
      </button>
    </div>
  )
}

export default BedConfigBuilder
