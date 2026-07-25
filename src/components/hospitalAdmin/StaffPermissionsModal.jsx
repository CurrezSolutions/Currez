import { useState } from 'react'
import Modal from '../common/Modal'
import { setUserModulePermission } from '../../firebase/users'
import { logActivity } from '../../firebase/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { PERMISSION_MODULES, PERMISSION_LEVELS, PERMISSION_LEVEL_LABELS, getModulePermission } from '../../utils/permissions'
import { ROLE_LABELS } from '../../utils/roles'
import StatusBadge from '../superadmin/StatusBadge'

function StaffPermissionsModal({ member, onClose }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState(() => {
    const initial = {}
    for (const mod of PERMISSION_MODULES) {
      initial[mod.key] = getModulePermission(member, mod.key)
    }
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleToggle(moduleKey, level) {
    setPermissions((prev) => ({ ...prev, [moduleKey]: level }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const changed = PERMISSION_MODULES.filter((mod) => permissions[mod.key] !== getModulePermission(member, mod.key))
      const promises = PERMISSION_MODULES.map((mod) =>
        setUserModulePermission(member.uid, mod.key, permissions[mod.key])
      )
      await Promise.all(promises)
      if (changed.length > 0) {
        logActivity({
          hospitalId: member.hospitalId,
          action: 'staff.permissions_changed',
          actorUid: user.uid,
          actorEmail: user.email,
          targetType: 'user',
          targetId: member.uid,
          targetLabel: member.displayName || member.email,
          details: changed.map((mod) => `${mod.label}: ${permissions[mod.key]}`).join(', '),
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message || 'Failed to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-sm font-bold text-violet-600">
          {(member.displayName || '?')[0].toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-bold text-heading">{member.displayName}</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{ROLE_LABELS[member.role]}</span>
            <span className="text-faint">·</span>
            <StatusBadge status={member.status} kind="user" />
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        Control which modules this staff member can access. "Full access" allows viewing and editing.
        "View only" restricts to read-only. "No access" hides the module entirely.
      </p>

      <div className="flex flex-col gap-2">
        {PERMISSION_MODULES.map((mod) => {
          const current = permissions[mod.key]
          return (
            <div key={mod.key} className="flex items-center justify-between rounded-xl border border-line/60 bg-card px-4 py-3">
              <span className="text-sm font-medium text-heading">{mod.label}</span>
              <div className="flex gap-1">
                {Object.values(PERMISSION_LEVELS).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleToggle(mod.key, level)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      current === level
                        ? level === PERMISSION_LEVELS.EDIT
                          ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300'
                          : level === PERMISSION_LEVELS.VIEW
                          ? 'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300'
                          : 'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-500/30 dark:text-red-300'
                        : 'text-muted hover:bg-card-strong hover:text-heading'
                    }`}
                  >
                    {PERMISSION_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-card-strong hover:text-heading"
        >
          Close
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Permissions'}
        </button>
      </div>
    </Modal>
  )
}

export default StaffPermissionsModal
