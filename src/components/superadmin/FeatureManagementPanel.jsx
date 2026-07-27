import { useState } from 'react'
import { FEATURE_REGISTRY } from '../../config/featureRegistry'
import { setHospitalFeatureEnabled, isFeatureEnabled } from '../../firebase/hospitalFeatures'
import { logActivity } from '../../firebase/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import NavIcon from '../common/NavIcon'

// Renders one toggle row per FEATURE_REGISTRY entry — a new module needs no
// changes here, it just shows up the moment it's added to the registry.
function FeatureManagementPanel({ hospitalId, features }) {
  const { user } = useAuth()
  const [pendingKey, setPendingKey] = useState(null)
  const [error, setError] = useState('')

  async function toggle(feature, nextEnabled) {
    setPendingKey(feature.key)
    setError('')
    try {
      await setHospitalFeatureEnabled(hospitalId, feature.key, nextEnabled, user?.email)
      logActivity({
        hospitalId,
        action: 'hospital.feature_toggled',
        actorUid: user?.uid,
        actorEmail: user?.email,
        targetType: 'feature',
        targetId: feature.key,
        targetLabel: feature.label,
        details: nextEnabled ? 'Turned on' : 'Turned off',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <section>
      <p className="text-sm text-muted">
        Controls which modules appear in {hospitalId}'s staff dashboard. Core modules are always on;
        optional modules stay off until switched on here.
      </p>

      <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {FEATURE_REGISTRY.map((feature) => {
          const enabled = isFeatureEnabled(features, feature.key)
          const disabled = feature.isCore || pendingKey === feature.key
          return (
            <div key={feature.key} className="flex items-center gap-4 px-5 py-3.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                  enabled
                    ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300'
                    : 'bg-card-strong text-faint ring-line'
                }`}
              >
                <NavIcon name={feature.icon} className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-heading">{feature.label}</div>
                {feature.description && (
                  <div className="mt-0.5 text-xs text-faint">{feature.description}</div>
                )}
              </div>

              {feature.isCore ? (
                <span className="shrink-0 rounded-full bg-card-strong px-2.5 py-1 text-[11px] font-semibold text-faint">
                  Always on
                </span>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={disabled}
                  onClick={() => toggle(feature, !enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    enabled ? 'bg-emerald-500' : 'bg-card-strong'
                  }`}
                >
                  <span
                    className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                      enabled ? 'translate-x-5.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </section>
  )
}

export default FeatureManagementPanel
