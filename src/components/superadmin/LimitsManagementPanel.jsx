import { useState } from 'react'
import { LIMITS_REGISTRY, formatLimitValue } from '../../config/limitsRegistry'
import { setHospitalLimit } from '../../firebase/hospitalLimits'
import { logActivity } from '../../firebase/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import NavIcon from '../common/NavIcon'

// One row per LIMITS_REGISTRY entry, each independently editable: a free-form
// number (full customization — any value, not just the presets), quick-pick
// preset chips for common plan tiers, and an Unlimited toggle. Mirrors
// FeatureManagementPanel's "registry renders itself" approach — add a limit
// to the registry and it shows up here with no other change needed.
function LimitsManagementPanel({ hospitalId, limits }) {
  const { user } = useAuth()

  return (
    <section>
      <p className="text-sm text-muted">
        Sets {hospitalId}'s plan limits — staff seats, daily patient volume, and monthly email
        notifications. Staff can see these limits and their current usage from their own dashboard,
        but only Super Admin can change them.
      </p>

      <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {LIMITS_REGISTRY.map((limit) => (
          <LimitRow
            key={limit.key}
            limit={limit}
            value={limits?.[limit.key] ?? limit.default}
            hospitalId={hospitalId}
            actorUid={user?.uid}
            updatedBy={user?.email}
          />
        ))}
      </div>
    </section>
  )
}

function LimitRow({ limit, value, hospitalId, actorUid, updatedBy }) {
  const isUnlimited = value === null
  const [draftValue, setDraftValue] = useState(isUnlimited ? '' : String(value))
  const [draftUnlimited, setDraftUnlimited] = useState(isUnlimited)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dirty = draftUnlimited !== isUnlimited || (!draftUnlimited && String(value) !== draftValue)

  async function save(nextValue) {
    setSaving(true)
    setError('')
    try {
      await setHospitalLimit(hospitalId, limit.key, nextValue, updatedBy)
      logActivity({
        hospitalId,
        action: 'hospital.limit_changed',
        actorUid,
        actorEmail: updatedBy,
        targetType: 'limit',
        targetId: limit.key,
        targetLabel: limit.label,
        details: `${formatLimitValue(value, limit.unit)} → ${formatLimitValue(nextValue, limit.unit)}`,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handlePreset(preset) {
    setDraftUnlimited(false)
    setDraftValue(String(preset))
    save(preset)
  }

  function handleUnlimitedToggle() {
    const next = !draftUnlimited
    setDraftUnlimited(next)
    if (next) save(null)
  }

  function handleSaveCustom() {
    const parsed = Number(draftValue)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Enter a whole number of 0 or more.')
      return
    }
    save(parsed)
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
          <NavIcon name={limit.icon} className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <div className="font-medium text-heading">{limit.label}</div>
          <div className="mt-0.5 text-xs text-faint">{limit.description}</div>
          <div className="mt-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
            Current: {formatLimitValue(value, limit.unit)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <div className="flex flex-wrap items-center gap-1.5">
          {limit.presets.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={saving}
              onClick={() => handlePreset(preset)}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                !draftUnlimited && Number(draftValue) === preset
                  ? 'bg-indigo-600 text-white'
                  : 'bg-card-strong text-muted hover:text-heading'
              }`}
            >
              {preset.toLocaleString()}
            </button>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={handleUnlimitedToggle}
            className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              draftUnlimited ? 'bg-emerald-500 text-white' : 'bg-card-strong text-muted hover:text-heading'
            }`}
          >
            Unlimited
          </button>
        </div>

        {!draftUnlimited && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={draftValue}
              disabled={saving}
              onChange={(e) => setDraftValue(e.target.value)}
              className="w-24 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-heading focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={handleSaveCustom}
              className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

export default LimitsManagementPanel
