// Fixed-order categorical palette for bed types (department color-coding —
// e.g. ICU shows yellow) so colors stay distinguishable at a glance instead
// of being picked ad hoc. Order matters more than any individual hex: it's
// what keeps adjacent colors distinguishable for colorblind users, so new
// types are assigned the next slot in this order, never a random one.
export const BED_TYPE_COLOR_PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]

// Resolves a bed type's display color: whatever the hospital's config
// explicitly set (see BedConfigBuilder's color picker) or, for configs saved
// before this feature existed and for unknown/custom type keys, a
// deterministic fallback so the same type always renders the same color
// across sessions instead of a random one.
export function getBedTypeColor(bedTypes, typeKey) {
  const explicit = bedTypes?.[typeKey]?.color
  if (explicit) return explicit
  const key = typeKey || 'general'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return BED_TYPE_COLOR_PALETTE[hash % BED_TYPE_COLOR_PALETTE.length]
}

// Build a unique composite key for a bed's position in the hierarchy.
// wardId/roomId are optional (a bed can sit directly on a floor or directly
// in a ward) so missing segments fall back to a stable placeholder — that
// keeps the key format fixed-shape instead of branching per bed.
export function bedKey(floorId, wardId, roomId, bedId) {
  return `${floorId}/${wardId || '_'}/${roomId || '_'}/${bedId}`
}

// Flatten all beds from a bed config into a flat list with hierarchy info.
// Walks every valid path a bed can live on:
//   floor.beds            — direct on floor, no ward/room
//   floor.rooms[].beds    — direct room on floor, no ward
//   floor.wards[].beds    — direct in ward, no room
//   floor.wards[].rooms[].beds — full hierarchy
export function flattenBeds(config) {
  if (!config?.floors) return []
  const beds = []

  for (const floor of config.floors || []) {
    for (const bed of floor.beds || []) {
      beds.push({
        ...bed,
        floorId: floor.id,
        floorName: floor.name,
        wardId: null,
        wardName: null,
        roomId: null,
        roomName: null,
      })
    }

    for (const room of floor.rooms || []) {
      for (const bed of room.beds || []) {
        beds.push({
          ...bed,
          floorId: floor.id,
          floorName: floor.name,
          wardId: null,
          wardName: null,
          roomId: room.id,
          roomName: room.name,
        })
      }
    }

    for (const ward of floor.wards || []) {
      for (const bed of ward.beds || []) {
        beds.push({
          ...bed,
          floorId: floor.id,
          floorName: floor.name,
          wardId: ward.id,
          wardName: ward.name,
          roomId: null,
          roomName: null,
        })
      }
      for (const room of ward.rooms || []) {
        for (const bed of room.beds || []) {
          beds.push({
            ...bed,
            floorId: floor.id,
            floorName: floor.name,
            wardId: ward.id,
            wardName: ward.name,
            roomId: room.id,
            roomName: room.name,
          })
        }
      }
    }
  }

  return beds
}

// Human-readable location breadcrumb that gracefully omits missing levels,
// e.g. "Ground Floor · ICU Ward · Room 4", "Ground Floor · Room 4", or
// "Ground Floor · ICU Ward".
export function formatBedLocation(bed) {
  if (!bed) return ''
  return [bed.floorName, bed.wardName, bed.roomName].filter(Boolean).join(' · ')
}

// Build a Map of occupied beds keyed by composite position key → admission.
export function getOccupiedMap(activeAdmissions) {
  const map = new Map()
  for (const a of activeAdmissions) {
    if (a.status === 'active' && a.floorId && a.bedId) {
      map.set(bedKey(a.floorId, a.wardId, a.roomId, a.bedId), a)
    }
  }
  return map
}

// Resolve the display status of a bed: an active admission always wins,
// otherwise fall back to the bed's own stored status (e.g. 'maintenance'),
// otherwise it's vacant.
export function getBedDisplayStatus(bed, admission) {
  if (admission) return 'occupied'
  if (bed?.status === 'maintenance') return 'maintenance'
  return 'vacant'
}

// Compute occupancy stats from flat beds + active admissions.
export function computeOccupancyStats(beds, activeAdmissions) {
  const occupied = getOccupiedMap(activeAdmissions)
  const total = beds.length
  const occupiedCount = beds.filter((b) => occupied.has(bedKey(b.floorId, b.wardId, b.roomId, b.bedId))).length
  const maintenanceCount = beds.filter(
    (b) => !occupied.has(bedKey(b.floorId, b.wardId, b.roomId, b.bedId)) && b.status === 'maintenance'
  ).length
  const vacant = total - occupiedCount - maintenanceCount
  const occupancyRate = total > 0 ? Math.round((occupiedCount / total) * 1000) / 10 : 0

  const byWard = {}
  for (const bed of beds) {
    const key = bed.wardId || `floor-direct-${bed.floorId}`
    if (!byWard[key]) byWard[key] = { name: bed.wardName || `${bed.floorName} (direct)`, total: 0, occupied: 0 }
    byWard[key].total++
    if (occupied.has(bedKey(bed.floorId, bed.wardId, bed.roomId, bed.bedId))) byWard[key].occupied++
  }

  const byType = {}
  for (const bed of beds) {
    const key = bed.type || 'unspecified'
    if (!byType[key]) byType[key] = { count: 0, occupied: 0 }
    byType[key].count++
    if (occupied.has(bedKey(bed.floorId, bed.wardId, bed.roomId, bed.bedId))) byType[key].occupied++
  }

  return { total, occupied: occupiedCount, vacant, maintenance: maintenanceCount, occupancyRate, byWard, byType }
}

// Get the admission record for a specific bed (or null).
export function getAdmissionForBed(floorId, wardId, roomId, bedId, activeAdmissions) {
  const key = bedKey(floorId, wardId, roomId, bedId)
  return activeAdmissions.find((a) => a.status === 'active' && bedKey(a.floorId, a.wardId, a.roomId, a.bedId) === key) || null
}

// Compute days since admission.
export function computeDaysSince(admittedAt) {
  if (!admittedAt) return 0
  const admitted = admittedAt.toDate ? admittedAt.toDate() : new Date(admittedAt)
  const now = new Date()
  const diffMs = now - admitted
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

// Compute running charges.
export function computeRunningCharges(dailyRate, admittedAt) {
  const days = computeDaysSince(admittedAt)
  return (Number(dailyRate) || 0) * days
}

// Format bed status for display.
export function getBedStatus(floorId, wardId, roomId, bedId, occupiedMap) {
  if (occupiedMap.has(bedKey(floorId, wardId, roomId, bedId))) return 'occupied'
  return 'vacant'
}

// Generate a unique bed ID from room prefix + index.
export function generateBedId(roomPrefix, index) {
  return `${roomPrefix}-${String(index).padStart(2, '0')}`
}

// Generate a batch of beds at once (prefix + running index) for the bulk
// bed-add UI — the single biggest ergonomic fix over adding beds one by one.
export function generateBedBatch(prefix, startIndex, count, type) {
  const safePrefix = (prefix || 'BED').trim() || 'BED'
  const safeCount = Math.max(1, Math.min(200, Number(count) || 0))
  const beds = []
  for (let i = 0; i < safeCount; i++) {
    beds.push(createEmptyBed(generateBedId(safePrefix, startIndex + i), type))
  }
  return beds
}

// Create an empty floor template.
export function createEmptyFloor(order) {
  return {
    id: `floor-${Date.now()}`,
    name: `Floor ${order}`,
    order,
    wards: [],
    rooms: [],
    beds: [],
  }
}

// Create an empty ward template.
export function createEmptyWard(order) {
  return {
    id: `ward-${Date.now()}`,
    name: `Ward ${order}`,
    order,
    rooms: [],
    beds: [],
  }
}

// Create an empty room template.
export function createEmptyRoom(name) {
  return {
    id: `room-${Date.now()}`,
    name: name || 'New Room',
    beds: [],
  }
}

// Create an empty bed template.
export function createEmptyBed(bedId, type) {
  return { bedId, type: type || 'general', status: 'active' }
}

// Count all beds under a floor/ward/room node (used by delete guards and
// zone-header occupancy badges).
export function countBedsUnder(node) {
  if (!node) return 0
  let count = (node.beds || []).length
  for (const room of node.rooms || []) count += (room.beds || []).length
  for (const ward of node.wards || []) count += countBedsUnder(ward)
  return count
}

// Immutably flip a single bed's stored status (e.g. to/from 'maintenance')
// anywhere in the floor/ward/room tree. Returns a new config object.
export function setBedStatusInConfig(config, floorId, wardId, roomId, bedId, status) {
  function patchBeds(beds) {
    if (!beds) return beds
    return beds.map((b) => (b.bedId === bedId ? { ...b, status } : b))
  }
  function patchRooms(rooms) {
    if (!rooms) return rooms
    return rooms.map((r) => (r.id === roomId ? { ...r, beds: patchBeds(r.beds) } : r))
  }

  const floors = (config.floors || []).map((floor) => {
    if (floor.id !== floorId) return floor

    if (!wardId && !roomId) {
      return { ...floor, beds: patchBeds(floor.beds) }
    }
    if (!wardId && roomId) {
      return { ...floor, rooms: patchRooms(floor.rooms) }
    }
    return {
      ...floor,
      wards: (floor.wards || []).map((ward) => {
        if (ward.id !== wardId) return ward
        if (!roomId) {
          return { ...ward, beds: patchBeds(ward.beds) }
        }
        return { ...ward, rooms: patchRooms(ward.rooms) }
      }),
    }
  })

  return { ...config, floors }
}
