import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { subscribeHospital, updateHospital } from '../../firebase/hospitals'
import { subscribeUsersByHospital, setUserStatus } from '../../firebase/users'
import { subscribeToHospitalFeatures } from '../../firebase/hospitalFeatures'
import { subscribeToHospitalLimits } from '../../firebase/hospitalLimits'
import { subscribeAppointments } from '../../firebase/appointments'
import { resetPassword } from '../../firebase/auth'
import { logActivity } from '../../firebase/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { ROLE_LABELS } from '../../utils/roles'
import { todayDateString } from '../../utils/dates'
import { CONTENT_SECTIONS } from '../../utils/hospitalContentSchema'
import HospitalFormPage from './HospitalFormPage'
import ContentSectionEditor from '../../components/superadmin/ContentSectionEditor'
import FeatureManagementPanel from '../../components/superadmin/FeatureManagementPanel'
import LimitsManagementPanel from '../../components/superadmin/LimitsManagementPanel'
import HospitalActivityLogPanel from '../../components/superadmin/HospitalActivityLogPanel'
import StaffFormModal from '../../components/superadmin/StaffFormModal'
import CredentialsDialog from '../../components/superadmin/CredentialsDialog'
import StatCard from '../../components/superadmin/StatCard'
import StatusBadge from '../../components/superadmin/StatusBadge'
import ConfirmModal from '../../components/common/ConfirmModal'
import { PageSpinner } from '../../components/common/Spinner'
import NavIcon from '../../components/common/NavIcon'
import Pagination from '../../components/common/Pagination'
import TenantNotFound from '../TenantNotFound'

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'overview' },
  { key: 'branding', label: 'Branding & Contact', icon: 'profile' },
  { key: 'content', label: 'Content', icon: 'clipboard' },
  { key: 'features', label: 'Modules', icon: 'dashboard' },
  { key: 'limits', label: 'Limits', icon: 'lock' },
  { key: 'staff', label: 'Staff', icon: 'staff' },
  { key: 'activity', label: 'Activity Log', icon: 'clipboard' },
]

function HospitalDetailPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [hospital, setHospital] = useState(undefined)
  const [staff, setStaff] = useState([])
  const [features, setFeatures] = useState(undefined)
  const [limits, setLimits] = useState(undefined)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [newCredentials, setNewCredentials] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [resetSentFor, setResetSentFor] = useState(null)
  const [staffPage, setStaffPage] = useState(1)
  const [confirmAction, setConfirmAction] = useState(null)
  const [appointments, setAppointments] = useState(undefined)

  const STAFF_PAGE_SIZE = 10

  useEffect(() => subscribeHospital(slug, setHospital), [slug])
  useEffect(() => subscribeUsersByHospital(slug, setStaff), [slug])
  // Only reads hospitalFeatures when the Modules tab is actually open —
  // Overview/Branding/Content/Staff never need it, so this saves a read on
  // every hospital-detail visit that doesn't touch Modules.
  useEffect(() => {
    if (activeTab !== 'features') return
    return subscribeToHospitalFeatures(slug, setFeatures)
  }, [slug, activeTab])
  // Same reasoning, for the Limits tab — also needed on the Staff tab so
  // "Add Staff" can be checked against the hospital's seat caps.
  useEffect(() => {
    if (activeTab !== 'limits' && activeTab !== 'staff') return
    return subscribeToHospitalLimits(slug, setLimits)
  }, [slug, activeTab])
  // Same reasoning, for Overview's stat cards — these used to be hardcoded
  // to 0 regardless of real data; only fetch when that tab is actually open.
  useEffect(() => {
    if (activeTab !== 'overview') return
    return subscribeAppointments(slug, setAppointments)
  }, [slug, activeTab])
  useEffect(() => setActiveTab('overview'), [slug])
  useEffect(() => setFeatures(undefined), [slug])
  useEffect(() => setLimits(undefined), [slug])
  useEffect(() => setAppointments(undefined), [slug])

  if (hospital === undefined) return <PageSpinner />
  if (hospital === null) return <TenantNotFound slug={slug} />

  async function executeResetPassword(member) {
    setResetSentFor(null)
    try {
      await resetPassword(member.email)
    } finally {
      setResetSentFor(member.uid)
      setTimeout(() => setResetSentFor(null), 4000)
    }
  }

  function handleConfirmAction() {
    if (!confirmAction) return
    const { type, member } = confirmAction
    if (type === 'resetPassword') {
      executeResetPassword(member)
    } else if (type === 'deactivate' || type === 'reactivate') {
      setUserStatus(member.uid, type === 'deactivate' ? 'disabled' : 'active')
      logActivity({
        hospitalId: slug,
        action: type === 'deactivate' ? 'staff.deactivated' : 'staff.reactivated',
        actorUid: user.uid,
        actorEmail: user.email,
        targetType: 'user',
        targetId: member.uid,
        targetLabel: member.displayName || member.email,
      })
    }
    setConfirmAction(null)
  }

  async function toggleStatus() {
    setTogglingStatus(true)
    try {
      const nextStatus = hospital.status === 'trial' ? 'active' : 'trial'
      await updateHospital(slug, { status: nextStatus })
      logActivity({
        hospitalId: slug,
        action: 'hospital.status_changed',
        actorUid: user.uid,
        actorEmail: user.email,
        targetType: 'hospital',
        targetId: slug,
        targetLabel: hospital.title,
        details: `Switched to ${nextStatus === 'active' ? 'Ongoing' : 'Trial'}`,
      })
    } finally {
      setTogglingStatus(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <Link
        to="/superadmin/hospitals"
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-heading"
      >
        <NavIcon name="arrowLeft" className="h-4 w-4" />
        Back to hospitals
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-lg font-bold text-indigo-600 ring-1 ring-indigo-500/20 ring-inset dark:text-indigo-300">
            {(hospital.title || '?')[0].toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-heading">{hospital.title}</h1>
            <p className="text-sm text-muted">{hospital.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={hospital.status} />
          <button
            onClick={toggleStatus}
            disabled={togglingStatus}
            className="cursor-pointer rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-body transition-colors hover:bg-card-strong hover:text-heading disabled:cursor-not-allowed disabled:opacity-50"
          >
            {togglingStatus ? 'Updating…' : `Switch to ${hospital.status === 'trial' ? 'Ongoing' : 'Trial'}`}
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-card-strong p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-card text-heading shadow-sm'
                : 'text-muted hover:text-heading'
            }`}
          >
            <NavIcon name={tab.icon} className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 animate-fade-in-up">
        {activeTab === 'overview' && (
          <section>
            <h2 className="text-sm font-semibold text-heading">Activity</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Appointments today"
                value={appointments === undefined ? '—' : appointments.filter((a) => a.date === todayDateString()).length}
                hint={appointments === undefined ? 'Loading…' : undefined}
                icon="appointments"
              />
              <StatCard
                label="Total appointments"
                value={appointments === undefined ? '—' : appointments.length}
                hint={appointments === undefined ? 'Loading…' : undefined}
                icon="appointments"
              />
              <StatCard
                label="Active staff"
                value={staff.filter((s) => s.status === 'active').length}
                icon="staff"
              />
            </div>
          </section>
        )}

        {activeTab === 'branding' && (
          <section>
            <HospitalFormPage mode="edit" hospital={hospital} />
          </section>
        )}

        {activeTab === 'content' && (
          <section className="space-y-4">
            <p className="text-sm text-muted">
              Controls what shows on {hospital.title}'s public landing page.
            </p>
            {CONTENT_SECTIONS.map((cfg) => (
              <ContentSectionEditor
                key={`${hospital.slug}-${cfg.key}`}
                slug={hospital.slug}
                sectionKey={cfg.key}
                label={cfg.label}
                fields={cfg.fields}
                noItems={cfg.noItems}
                section={hospital.optionals?.[cfg.key] || { enabled: 'off', orderNumber: 1, items: [] }}
              />
            ))}
          </section>
        )}

        {activeTab === 'features' && (
          features === undefined ? (
            <PageSpinner />
          ) : (
            <FeatureManagementPanel hospitalId={hospital.slug} features={features} />
          )
        )}

        {activeTab === 'limits' && (
          limits === undefined ? (
            <PageSpinner />
          ) : (
            <LimitsManagementPanel hospitalId={hospital.slug} limits={limits} />
          )
        )}

        {activeTab === 'staff' && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-heading">Staff</h2>
              <button
                onClick={() => setShowStaffForm(true)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/30 active:scale-[0.98]"
              >
                <NavIcon name="staff" className="h-4 w-4" />
                Add Staff
              </button>
            </div>

            {/* Mobile: stacked cards instead of a horizontally-scrolling table. */}
            <div className="mt-3 space-y-3 md:hidden">
              {staff.slice((staffPage - 1) * STAFF_PAGE_SIZE, staffPage * STAFF_PAGE_SIZE).map((member) => (
                <div key={member.uid} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-bold text-violet-600 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
                        {(member.displayName || '?')[0].toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-heading">{member.displayName}</p>
                        <p className="truncate text-xs text-faint">{member.email}</p>
                      </div>
                    </div>
                    <StatusBadge status={member.status} kind="user" />
                  </div>
                  <span className="mt-3 inline-flex items-center rounded-lg bg-card-strong px-2.5 py-1 text-xs font-medium text-muted">
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                    <Link
                      to={`/superadmin/hospitals/${slug}/staff/${member.uid}`}
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      View profile
                    </Link>
                    <button
                      onClick={() => setConfirmAction({ type: 'resetPassword', member })}
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-card-strong hover:text-heading"
                    >
                      {resetSentFor === member.uid ? 'Sent' : 'Reset password'}
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: member.status === 'active' ? 'deactivate' : 'reactivate', member })}
                      className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        member.status === 'active'
                          ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400'
                          : 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                      }`}
                    >
                      {member.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              ))}
              {staff.length === 0 && (
                <div className="rounded-2xl border border-line bg-card px-5 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                      <NavIcon name="staff" className="h-6 w-6 text-faint" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-muted">No staff assigned yet</p>
                  </div>
                </div>
              )}
            </div>

            {staff.length > 0 && (
              <Pagination
                currentPage={staffPage}
                totalItems={staff.length}
                pageSize={STAFF_PAGE_SIZE}
                onPageChange={setStaffPage}
              />
            )}

            {/* Desktop: full table */}
            <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-line bg-card shadow-sm md:block">
              <table className="min-w-full divide-y divide-line text-sm">
                <thead>
                  <tr className="border-b border-line bg-card-strong/30">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wider text-faint uppercase">Name</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wider text-faint uppercase">Email</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wider text-faint uppercase">Role</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wider text-faint uppercase">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wider text-faint uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {staff.slice((staffPage - 1) * STAFF_PAGE_SIZE, staffPage * STAFF_PAGE_SIZE).map((member) => (
                    <tr key={member.uid} className="group transition-colors hover:bg-card-strong/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-bold text-violet-600 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
                            {(member.displayName || '?')[0].toUpperCase()}
                          </span>
                          <span className="font-medium text-heading">{member.displayName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{member.email}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-lg bg-card-strong px-2.5 py-1 text-xs font-medium text-muted">
                          {ROLE_LABELS[member.role] || member.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={member.status} kind="user" />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/superadmin/hospitals/${slug}/staff/${member.uid}`}
                            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
                          >
                            View profile
                          </Link>
                          <button
                            onClick={() => setConfirmAction({ type: 'resetPassword', member })}
                            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-card-strong hover:text-heading"
                          >
                            {resetSentFor === member.uid ? 'Sent' : 'Reset password'}
                          </button>
                          <button
                            onClick={() =>
                              setConfirmAction({ type: member.status === 'active' ? 'deactivate' : 'reactivate', member })
                            }
                            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              member.status === 'active'
                                ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400'
                                : 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                            }`}
                          >
                            {member.status === 'active' ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {staff.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-strong">
                            <NavIcon name="staff" className="h-6 w-6 text-faint" />
                          </div>
                          <p className="mt-3 text-sm font-medium text-muted">No staff assigned yet</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'activity' && <HospitalActivityLogPanel hospitalId={hospital.slug} />}
      </div>

      {showStaffForm && (
        <StaffFormModal
          hospitalId={slug}
          existingStaff={staff}
          limits={limits}
          onCancel={() => setShowStaffForm(false)}
          onCreated={(credentials) => {
            setShowStaffForm(false)
            setNewCredentials(credentials)
          }}
        />
      )}

      {newCredentials && (
        <CredentialsDialog
          email={newCredentials.email}
          password={newCredentials.password}
          onClose={() => setNewCredentials(null)}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'deactivate'
              ? 'Deactivate staff member?'
              : confirmAction.type === 'reactivate'
              ? 'Reactivate staff member?'
              : 'Reset password?'
          }
          message={
            confirmAction.type === 'deactivate'
              ? `${confirmAction.member.displayName} will lose access to the dashboard. You can reactivate them later.`
              : confirmAction.type === 'reactivate'
              ? `${confirmAction.member.displayName} will regain access to the dashboard.`
              : `A password reset email will be sent to ${confirmAction.member.email}.`
          }
          confirmLabel={
            confirmAction.type === 'deactivate'
              ? 'Deactivate'
              : confirmAction.type === 'reactivate'
              ? 'Reactivate'
              : 'Send reset email'
          }
          danger={confirmAction.type === 'deactivate'}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

export default HospitalDetailPage
