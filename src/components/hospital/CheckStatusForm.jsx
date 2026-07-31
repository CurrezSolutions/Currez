import { useEffect, useMemo, useState } from 'react'
import { getAppointmentByToken, getAppointmentsByPhone } from '../../firebase/appointments'
import { subscribeHospital } from '../../firebase/hospitals'
import { useLanguage } from '../../contexts/LanguageContext'
import { validators } from '../../utils/validations'
import { useFormValidation } from '../../hooks/useFormValidation'
import NavIcon from '../common/NavIcon'

const inputClass =
  'mt-1 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base text-heading placeholder:text-faint focus:border-line-strong focus:outline-none'
const labelClass = 'block text-sm font-medium text-body'

const STATUS_COPY_KEYS = {
  pending: ['status.pendingLabel', 'status.pendingHint'],
  scheduled: ['status.scheduledLabel', 'status.scheduledHint'],
  completed: ['status.completedLabel', 'status.completedHint'],
  cancelled: ['status.cancelledLabel', 'status.cancelledHint'],
}

// Same status→color mapping used on the staff side (hospitalAdmin
// AppointmentsPage) so a patient's status badge means the same thing,
// visually, as what reception sees.
const STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400',
  scheduled: 'bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-400',
  completed: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400',
  cancelled: 'bg-card-strong text-muted ring-line',
}
const STATUS_BAR = {
  pending: 'bg-amber-500',
  scheduled: 'bg-sky-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-line-strong',
}

// Shared by the standalone /appointment-status page and the popup modal
// triggered from the landing page header/footer.
function CheckStatusForm({ slug }) {
  const { t } = useLanguage()
  const [hospital, setHospital] = useState(undefined)
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [results, setResults] = useState(undefined)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // 'current' (pending/scheduled — what a patient actually needs to act on
  // or track) is the default tab, since a phone number with a long booking
  // history would otherwise bury the one appointment that still matters
  // under every past visit. 'past' (completed/cancelled) is opt-in.
  const [tab, setTab] = useState('current')
  const { errors, validate, clearFieldError } = useFormValidation({
    phone: [validators.phone('Enter a valid phone number.')],
  })

  const current = useMemo(
    () =>
      (results || [])
        .filter((r) => r.status === 'pending' || r.status === 'scheduled')
        .sort((a, b) => `${a.date}T${a.time || ''}`.localeCompare(`${b.date}T${b.time || ''}`)),
    [results]
  )
  const past = useMemo(
    () =>
      (results || [])
        .filter((r) => r.status === 'completed' || r.status === 'cancelled')
        .sort((a, b) => `${b.date}T${b.time || ''}`.localeCompare(`${a.date}T${a.time || ''}`)),
    [results]
  )
  const visible = tab === 'current' ? current : past

  useEffect(() => subscribeHospital(slug, setHospital), [slug])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResults(undefined)
    setTab('current')

    const trimmedToken = token.trim()
    const trimmedPhone = phone.trim()
    if (!trimmedToken && !trimmedPhone) {
      setError(t('status.missingBoth'))
      return
    }

    if (!validate({ phone })) return

    setSubmitting(true)
    try {
      let found = []
      if (trimmedToken) {
        const appointment = await getAppointmentByToken(trimmedToken, trimmedPhone)
        if (appointment && appointment.hospitalId === slug) found = [appointment]
      } else {
        found = await getAppointmentsByPhone(slug, trimmedPhone)
      }

      if (found.length === 0) {
        setError(t('status.notFound'))
      } else {
        setResults(found)
      }
    } catch {
      setError(t('status.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const callPhone = hospital?.emergency?.enabled && hospital?.emergency?.phone ? hospital.emergency.phone : hospital?.footer?.phone

  return (
    <div>
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tenant-primary, #6366f1) 18%, transparent)', color: 'var(--tenant-primary, #6366f1)' }}
      >
        <NavIcon name="clipboard" className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-heading">{t('status.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('status.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelClass}>{t('status.phoneNumber')}</label>
          <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); clearFieldError('phone') }} className={inputClass} />
          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
        </div>
        <div>
          <label className={labelClass}>{t('status.token')}</label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="e.g. K7M3Q2X"
            className={`${inputClass} font-mono uppercase`}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: 'var(--tenant-primary, #6366f1)', color: 'var(--tenant-primary, #6366f1)' }}
        >
          <NavIcon name="clipboard" className="h-4 w-4" />
          {submitting ? t('status.submitting') : t('status.submit')}
        </button>

        {callPhone && (
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-muted">
            <NavIcon name="phone" className="h-3.5 w-3.5 shrink-0" />
            {t('booking.callUs')}{' '}
            <a
              href={`tel:${callPhone.replace(/\s+/g, '')}`}
              className="font-medium underline"
              style={{ color: 'var(--tenant-primary, #6366f1)' }}
            >
              {callPhone}
            </a>
          </p>
        )}
      </form>

      {/* Collapsed by default whenever there's more than one match — a
          patient scanning several past/upcoming visits needs a quick list
          to scan, not every field of every visit expanded at once. */}
      {results && (
        <div className="mt-6">
          {results.length > 1 && (
            <div className="flex gap-1.5 rounded-lg bg-card-strong p-1">
              {[
                ['current', t('status.tabCurrent'), current.length],
                ['past', t('status.tabPast'), past.length],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    tab === key ? 'bg-card text-heading shadow-sm' : 'text-muted hover:text-heading'
                  }`}
                >
                  {label} <span className="text-xs text-faint">({count})</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-3">
            {visible.map((result) => (
              <StatusResultCard key={result.id} result={result} t={t} defaultOpen={results.length === 1} />
            ))}
            {visible.length === 0 && (
              <p className="rounded-lg border border-line bg-card-strong px-4 py-6 text-center text-sm text-muted">
                {tab === 'current' ? t('status.noCurrentAppointments') : t('status.noPastAppointments')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusResultCard({ result, t, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const [labelKey, hintKey] = STATUS_COPY_KEYS[result.status] || []
  const label = labelKey ? t(labelKey) : result.status
  const hint = hintKey ? t(hintKey) : ''
  const hasClinicalNotes = result.status === 'completed' && (result.prescription?.length > 0 || result.tests?.length > 0)

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-card-strong text-sm">
      <span className={`absolute inset-y-0 left-0 w-1 ${STATUS_BAR[result.status] || STATUS_BAR.scheduled}`} aria-hidden="true" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 pl-5 text-left"
      >
        <span className="min-w-0">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
              STATUS_STYLES[result.status] || STATUS_STYLES.scheduled
            }`}
          >
            {label}
          </span>
          <span className="mt-1.5 block truncate text-heading">
            {result.doctorName ? `${result.doctorName} · ` : ''}
            {result.date}
          </span>
        </span>
        <NavIcon
          name="chevronDown"
          className={`h-4 w-4 shrink-0 text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-4 pt-3 pb-4 pl-5">
          {hint && <p className="text-muted">{hint}</p>}
          <dl className="space-y-1">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('status.doctor')}</dt>
              <dd className="truncate text-heading">{result.doctorName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('status.date')}</dt>
              <dd className="text-heading">{result.date}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('status.time')}</dt>
              <dd className="text-heading">{result.time || '—'}</dd>
            </div>
          </dl>

          {hasClinicalNotes && (
            <div className="space-y-2 border-t border-line pt-3">
              {result.prescription?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t('status.prescription')}</p>
                  <ul className="mt-1 space-y-0.5 text-heading">
                    {result.prescription.map((row, i) => (
                      <li key={i}>
                        {row.medicine}
                        {row.dosage && ` — ${row.dosage}`}
                        {row.duration && ` (${row.duration})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.tests?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t('status.testsAdvised')}</p>
                  <ul className="mt-1 space-y-0.5 text-heading">
                    {result.tests.map((row, i) => (
                      <li key={i}>
                        {row.name}
                        {row.notes && ` — ${row.notes}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CheckStatusForm
