import { useState } from 'react'
import { createStaffAuthAccount } from '../../firebase/secondaryAuth'
import { createUserDoc } from '../../firebase/users'
import { logActivity } from '../../firebase/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { CREATABLE_STAFF_ROLES, ROLES, ROLE_LABELS } from '../../utils/roles'
import { validators } from '../../utils/validations'
import { useFormValidation } from '../../hooks/useFormValidation'
import { generatePassword } from '../../utils/generatePassword'
import { DEFAULT_SCHEDULE } from '../../utils/doctorSchedule'
import Modal from '../common/Modal'
import NavIcon from '../common/NavIcon'

const inputClass =
  'mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-heading placeholder:text-faint focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/10'
const labelClass = 'block text-sm font-medium text-body'

// Reused by both the superadmin (any creatable role) and hospital-admin
// (doctors/receptionists only, via `allowedRoles`) staff-creation flows.
function StaffFormModal({ hospitalId, allowedRoles = CREATABLE_STAFF_ROLES, onCreated, onCancel }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState(allowedRoles[0])
  const [specialization, setSpecialization] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { errors, validate, clearFieldError } = useFormValidation({
    displayName: [validators.required('Display name is required.')],
    email: [validators.required('Email is required.'), validators.email('Enter a valid email address.')],
    password: [validators.required('Password is required.'), validators.minLength(10, 'Password must be at least 10 characters.')],
    specialization: role === ROLES.DOCTOR ? [validators.required('Specialization is required for doctors.')] : [],
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate({ displayName, email, password, specialization })) return
    setSubmitting(true)
    try {
      const trimmedEmail = email.trim()
      const uid = await createStaffAuthAccount(trimmedEmail, password)
      await createUserDoc(uid, {
        email: trimmedEmail,
        displayName: displayName.trim() || trimmedEmail,
        role,
        hospitalId,
        createdBy: user.uid,
        ...(role === ROLES.DOCTOR
          ? { specialization: specialization.trim(), schedule: DEFAULT_SCHEDULE }
          : {}),
      })
      logActivity({
        hospitalId,
        action: 'staff.created',
        actorUid: user.uid,
        actorEmail: user.email,
        targetType: 'user',
        targetId: uid,
        targetLabel: `${displayName.trim() || trimmedEmail} (${ROLE_LABELS[role]})`,
      })
      onCreated({ email: trimmedEmail, password })
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'That email is already in use.' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} className="max-w-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20">
          <NavIcon name="staff" className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-heading">Add staff member</h2>
          <p className="text-xs text-faint">Creates a sign-in account and role for this hospital.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className={labelClass}>Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); clearFieldError('displayName') }}
            className={inputClass}
            placeholder="Dr. Jane Smith"
          />
          {errors.displayName && <p className="mt-1 text-xs text-red-500">{errors.displayName}</p>}
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFieldError('email') }}
            className={inputClass}
            placeholder="name@hospital.in"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
        </div>

        <div>
          <label className={labelClass}>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {role === ROLES.DOCTOR && (
          <div>
            <label className={labelClass}>Specialization</label>
            <input
              type="text"
              placeholder="e.g. Cardiologist"
              value={specialization}
              onChange={(e) => { setSpecialization(e.target.value); clearFieldError('specialization') }}
              className={inputClass}
            />
            {errors.specialization && <p className="mt-1 text-xs text-red-500">{errors.specialization}</p>}
            <p className="mt-1.5 text-xs text-faint">
              A default Mon–Fri, 9am–5pm schedule is created — edit it after adding this doctor.
            </p>
          </div>
        )}

        <div>
          <label className={labelClass}>Initial password</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError('password') }}
              className={`${inputClass} mt-0 font-mono`}
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="shrink-0 cursor-pointer rounded-xl border border-line px-3 text-sm font-medium text-body transition-colors hover:bg-card-strong hover:text-heading"
            >
              Generate
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-body transition-colors hover:bg-card-strong hover:text-heading disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default StaffFormModal
