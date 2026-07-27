import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useHospitalData } from '../../contexts/HospitalDataContext'
import { useFeature } from '../../hooks/useFeature'
import { ROLES } from '../../utils/roles'
import {
  subscribeBedConfig,
  subscribeActiveAdmissions,
  admitPatient,
  dischargePatient,
  transferAdmission,
  createBedConfig,
  updateBedConfig,
} from '../../firebase/bedManagement'
import { autoCreateDischargeInvoice } from '../../firebase/billing'
import { logActivity } from '../../firebase/activityLog'
import { flattenBeds, computeOccupancyStats, setBedStatusInConfig } from '../../utils/bedManagement'
import BedGrid from '../../components/hospitalAdmin/BedGrid'
import BedStatsPanel from '../../components/hospitalAdmin/BedStatsPanel'
import FloorTabs from '../../components/hospitalAdmin/FloorTabs'
import AdmitPatientModal from '../../components/hospitalAdmin/AdmitPatientModal'
import DischargeModal from '../../components/hospitalAdmin/DischargeModal'
import TransferBedModal from '../../components/hospitalAdmin/TransferBedModal'
import BedConfigBuilder from '../../components/hospitalAdmin/BedConfigBuilder'
import AdmissionHistoryPanel from '../../components/hospitalAdmin/AdmissionHistoryPanel'
import { PageSpinner } from '../../components/common/Spinner'

function BedManagementPage({ tenantSlug }) {
  const { user, role } = useAuth()
  const { staff, patients } = useHospitalData()
  const { enabled: billingEnabled } = useFeature('billing')
  const isAdmin = role === ROLES.HOSPITAL_ADMIN

  const [config, setConfig] = useState(undefined)
  const [activeAdmissions, setActiveAdmissions] = useState(null)
  const [selectedFloorId, setSelectedFloorId] = useState(null)
  const [wardFilter, setWardFilter] = useState(null)
  const [view, setView] = useState('grid') // 'grid' | 'configure' | 'history'
  const [admitModal, setAdmitModal] = useState(null)
  const [dischargeModal, setDischargeModal] = useState(null)
  const [transferModal, setTransferModal] = useState(null)

  useEffect(() => {
    const unsub = subscribeBedConfig(tenantSlug, setConfig)
    return unsub
  }, [tenantSlug])

  useEffect(() => {
    const unsub = subscribeActiveAdmissions(tenantSlug, setActiveAdmissions)
    return unsub
  }, [tenantSlug])

  useEffect(() => {
    setWardFilter(null)
  }, [selectedFloorId])

  const doctors = useMemo(
    () => (staff || []).filter((s) => s.role === 'DOCTOR' && s.status === 'active'),
    [staff]
  )

  const allBeds = useMemo(() => flattenBeds(config), [config])
  const stats = useMemo(() => computeOccupancyStats(allBeds, activeAdmissions || []), [allBeds, activeAdmissions])
  const selectedFloor = (config?.floors || []).find((f) => f.id === selectedFloorId) || null

  function handleBedSelect(bed, admission) {
    if (admission) {
      setDischargeModal(admission)
    } else {
      setAdmitModal(bed)
    }
  }

  async function handleAdmit(data) {
    await admitPatient(
      {
        hospitalId: tenantSlug,
        ...data,
        floorId: admitModal.floorId,
        floorName: admitModal.floorName,
        wardId: admitModal.wardId,
        wardName: admitModal.wardName,
        roomId: admitModal.roomId,
        roomName: admitModal.roomName,
        bedId: admitModal.bedId,
        bedType: admitModal.type,
        dailyRate: config?.bedTypes?.[admitModal.type]?.ratePerDay || 0,
      },
      user.email
    )
    logActivity({
      hospitalId: tenantSlug,
      action: 'admission.admitted',
      actorUid: user.uid,
      actorEmail: user.email,
      targetType: 'patient',
      targetLabel: data.patientName,
      details: `${admitModal.wardName} · ${admitModal.roomName} · Bed ${admitModal.bedId}`,
    })
  }

  async function handleDischarge(admissionId, data) {
    const { createInvoice, ...dischargeData } = data
    await dischargePatient(admissionId, {
      ...dischargeData,
      dischargedBy: user.email,
    })
    logActivity({
      hospitalId: tenantSlug,
      action: 'admission.discharged',
      actorUid: user.uid,
      actorEmail: user.email,
      targetType: 'patient',
      targetId: admissionId,
      targetLabel: dischargeModal?.patientName,
    })

    if (createInvoice && billingEnabled && dischargeModal) {
      await autoCreateDischargeInvoice({
        billingEnabled: true,
        hospitalId: tenantSlug,
        admissionId,
        patientId: dischargeModal.patientId,
        patientName: dischargeModal.patientName,
        patientPhone: dischargeModal.patientPhone,
        doctorId: dischargeModal.attendingDoctorId,
        doctorName: dischargeModal.attendingDoctor,
        bedType: dischargeModal.bedType,
        wardName: dischargeModal.wardName,
        roomName: dischargeModal.roomName,
        dailyRate: dischargeModal.dailyRate,
        totalDays: dischargeData.totalDays,
        totalCharges: dischargeData.totalCharges,
        linkedAppointmentId: dischargeModal.linkedAppointmentId,
        createdBy: user.email,
      })
    }
  }

  async function handleSaveConfig(newConfig) {
    if (config) {
      await updateBedConfig(tenantSlug, newConfig, user.email)
    } else {
      await createBedConfig(tenantSlug, newConfig, user.email)
    }
  }

  async function handleToggleMaintenance(bed, status) {
    if (!config) return
    const nextConfig = setBedStatusInConfig(config, bed.floorId, bed.wardId, bed.roomId, bed.bedId, status)
    await updateBedConfig(tenantSlug, nextConfig, user.email)
  }

  function handleTransferRequest(bed, admission) {
    setTransferModal(admission)
  }

  async function handleTransfer(destination) {
    await transferAdmission(transferModal, destination, user.email)
    logActivity({
      hospitalId: tenantSlug,
      action: 'admission.transferred',
      actorUid: user.uid,
      actorEmail: user.email,
      targetType: 'patient',
      targetId: transferModal?.id,
      targetLabel: transferModal?.patientName,
      details: `${destination.wardName} · ${destination.roomName} · Bed ${destination.bedId}`,
    })
  }

  if (config === undefined || activeAdmissions === null) {
    return <PageSpinner />
  }

  if (view === 'configure') {
    return (
      <BedConfigBuilder
        config={config}
        activeAdmissions={activeAdmissions}
        onSave={handleSaveConfig}
        onClose={() => setView('grid')}
      />
    )
  }

  if (view === 'history') {
    return <AdmissionHistoryPanel hospitalId={tenantSlug} onClose={() => setView('grid')} />
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Beds &amp; Wards</h1>
          <p className="mt-0.5 text-sm text-muted">Manage hospital beds, admissions and occupancy</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('history')}
            className="self-start rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium text-heading transition-colors hover:bg-card-strong"
          >
            Admission History
          </button>
          {isAdmin && (
            <button
              onClick={() => setView('configure')}
              className="self-start rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium text-heading transition-colors hover:bg-card-strong"
            >
              Configure Beds
            </button>
          )}
        </div>
      </div>

      {/* Main layout: sidebar + grid */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Stats sidebar */}
        <aside className="w-full shrink-0 rounded-2xl border border-line/80 bg-surface p-4 lg:w-64">
          <BedStatsPanel
            stats={stats}
            allBeds={allBeds}
            activeAdmissions={activeAdmissions || []}
            onBedSelect={handleBedSelect}
          />
        </aside>

        {/* Floor tabs + ward filter + bed grid */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FloorTabs
            floors={config?.floors || []}
            allBeds={allBeds}
            activeAdmissions={activeAdmissions || []}
            selectedFloorId={selectedFloorId}
            onSelectFloor={setSelectedFloorId}
          />

          {selectedFloor && selectedFloor.wards?.length > 0 && (
            <div className="-mt-1 flex flex-wrap gap-1.5">
              <WardPill active={!wardFilter} onClick={() => setWardFilter(null)} label="All Wards" />
              {selectedFloor.wards.map((ward) => (
                <WardPill
                  key={ward.id}
                  active={wardFilter === ward.id}
                  onClick={() => setWardFilter(ward.id)}
                  label={ward.name}
                />
              ))}
            </div>
          )}

          <BedGrid
            floors={config?.floors || []}
            activeAdmissions={activeAdmissions}
            selectedFloorId={selectedFloorId}
            wardFilter={wardFilter}
            onBedSelect={handleBedSelect}
            canManage
            onToggleMaintenance={handleToggleMaintenance}
            onTransferRequest={handleTransferRequest}
          />
        </div>
      </div>

      {/* Modals */}
      {admitModal && (
        <AdmitPatientModal
          bed={admitModal}
          config={config}
          patients={patients}
          doctors={doctors}
          onAdmit={handleAdmit}
          onClose={() => setAdmitModal(null)}
        />
      )}

      {dischargeModal && (
        <DischargeModal
          admission={dischargeModal}
          onDischarge={handleDischarge}
          onClose={() => setDischargeModal(null)}
        />
      )}

      {transferModal && (
        <TransferBedModal
          admission={transferModal}
          allBeds={allBeds}
          activeAdmissions={activeAdmissions || []}
          config={config}
          onTransfer={handleTransfer}
          onClose={() => setTransferModal(null)}
        />
      )}
    </div>
  )
}

function WardPill({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-indigo-500/15 text-indigo-600 ring-1 ring-inset ring-indigo-500/25 dark:text-indigo-300'
          : 'text-muted hover:bg-card-strong hover:text-heading'
      }`}
    >
      {label}
    </button>
  )
}

export default BedManagementPage
