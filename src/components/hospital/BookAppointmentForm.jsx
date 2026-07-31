import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { subscribeHospital } from '../../firebase/hospitals'
import { subscribeActiveDoctors } from '../../firebase/users'
import { createPatient, getPatientsByPhone, MAX_PATIENTS_PER_PHONE } from '../../firebase/patients'
import { createAppointment, getDoctorBookedTimes } from '../../firebase/appointments'
import { weekdayKeyForDate, availableSlotsForDate } from '../../utils/doctorSchedule'
import { todayDateString } from '../../utils/dates'
import { validators } from '../../utils/validations'
import { useFormValidation } from '../../hooks/useFormValidation'
import { useLanguage } from '../../contexts/LanguageContext'
import NavIcon from '../common/NavIcon'
import TimeSlotPicker from '../common/TimeSlotPicker'
import AppointmentTokenCard from './AppointmentTokenCard'

const inputClass =
  'mt-1 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base text-heading placeholder:text-faint focus:border-line-strong focus:outline-none'
const labelClass = 'block text-sm font-medium text-body'

// Shared by the standalone /appointment page and the popup modal triggered
// from the landing page header/hero/footer — same form, same success state,
// just wrapped differently (full-page card vs. dialog).
// `onCheckStatus`, when provided (the modal case), swaps to the status
// modal in place instead of navigating to the standalone status page.
function BookAppointmentForm({ slug, onCheckStatus }) {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const initialDoctor = searchParams.get('doctor') || ''
  const [hospital, setHospital] = useState(undefined)
  const [doctors, setDoctors] = useState([])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [doctorId, setDoctorId] = useState(initialDoctor)
  const [date, setDate] = useState(todayDateString())
  const [time, setTime] = useState('')
  const [bookedTimes, setBookedTimes] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  // Existing patients already registered under the phone number being
  // typed, so a returning patient can pick themselves instead of the form
  // silently creating a duplicate patient record every visit (see
  // createPatient in src/firebase/patients.js). '' = undecided/no matches
  // yet, 'new' = explicitly registering a new patient, otherwise a patient id.
  const [existingPatients, setExistingPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const isNewPatient = selectedPatientId === 'new' || existingPatients.length === 0
  const atPatientCap = existingPatients.length >= MAX_PATIENTS_PER_PHONE

  const { errors, validate, clearFieldError } = useFormValidation({
    name: isNewPatient ? [validators.required('Name is required.')] : [],
    phone: [validators.required('Phone is required.'), validators.phone('Enter a valid phone number.')],
    date: [validators.required('Date is required.')],
  })

  useEffect(() => subscribeHospital(slug, setHospital), [slug])
  useEffect(() => subscribeActiveDoctors(slug, setDoctors), [slug])

  // Debounced so we don't fire a lookup on every keystroke while the digit
  // count happens to sit at/above 10 (e.g. typing a country code first).
  useEffect(() => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setExistingPatients([])
      setSelectedPatientId('')
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      getPatientsByPhone(slug, phone)
        .then((patients) => {
          if (cancelled) return
          setExistingPatients(patients)
          setSelectedPatientId(patients.length > 0 ? patients[0].id : '')
        })
        // Best-effort: if the lookup fails (offline, rules not yet
        // deployed, etc.) fall back to the plain "enter your name" flow
        // instead of leaving the form silently stuck.
        .catch((err) => {
          if (!cancelled) console.error('Patient phone lookup failed:', err)
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [slug, phone])

  // Time isn't required to submit — a patient can leave it as "any time"
  // and reception will pick an exact slot when they confirm at the desk.
  useEffect(() => {
    setTime('')
  }, [doctorId, date])

  // Real (if momentary) visibility into which times are already claimed —
  // reads the PII-free doctorSlots record instead of the appointments
  // collection itself, which this unauthenticated form has no access to.
  useEffect(() => {
    if (!doctorId || !date) {
      setBookedTimes([])
      return
    }
    let cancelled = false
    getDoctorBookedTimes(slug, doctorId, date).then((times) => {
      if (!cancelled) setBookedTimes(times)
    })
    return () => {
      cancelled = true
    }
  }, [slug, doctorId, date])

  const selectedDoctor = doctors.find((d) => d.uid === doctorId)
  const weekday = weekdayKeyForDate(date)
  const daySchedule = selectedDoctor?.schedule?.[weekday]
  const slots = selectedDoctor ? availableSlotsForDate(selectedDoctor.schedule, date, bookedTimes) : []

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate({ name, phone, date, time })) return
    setSubmitting(true)
    try {
      let patientId
      let patientName
      if (isNewPatient) {
        patientId = await createPatient(slug, { name, phone, email: '' }, 'public')
        patientName = name.trim()
      } else {
        patientId = selectedPatientId
        patientName = existingPatients.find((p) => p.id === selectedPatientId)?.name || name.trim()
      }

      const token = await createAppointment(
        {
          hospitalId: slug,
          patientId,
          patientName,
          patientPhone: phone.trim(),
          doctorId: doctorId || null,
          doctorName: selectedDoctor?.displayName || '',
          date,
          time,
          notes: '',
          status: 'pending',
          bookedBy: 'patient',
        },
        'public'
      )
      setResult({ token, date, doctorName: selectedDoctor?.displayName })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (hospital === undefined) return null
  if (!hospital) {
    return <p className="text-center text-muted">{t('booking.hospitalNotFound')}</p>
  }

  if (result) {
    return (
      <div className="text-center">
        <span
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--tenant-primary, #6366f1) 18%, transparent)', color: 'var(--tenant-primary, #6366f1)' }}
        >
          <NavIcon name="appointments" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-heading">{t('booking.requestedTitle')}</h1>
        <p className="mt-2 text-sm text-muted">
          {result.doctorName
            ? t('booking.requestedBodyWithDoctor', { date: result.date, doctor: result.doctorName })
            : t('booking.requestedBodyNoDoctor', { date: result.date })}
        </p>
        <AppointmentTokenCard token={result.token} hospitalName={hospital.title} doctorName={result.doctorName} date={result.date} />
        <p className="mt-4 text-xs text-faint">{t('booking.saveTokenHint')}</p>
        {onCheckStatus ? (
          <button
            onClick={onCheckStatus}
            className="mt-6 cursor-pointer text-sm font-medium text-body hover:text-heading"
          >
            {t('booking.checkStatusLink')}
          </button>
        ) : (
          <Link
            to={{ pathname: '/appointment-status', search: `?tenant=${slug}` }}
            className="mt-6 inline-block text-sm font-medium text-body hover:text-heading"
          >
            {t('booking.checkStatusLink')}
          </Link>
        )}
      </div>
    )
  }

  const callPhone = hospital.emergency?.enabled && hospital.emergency?.phone ? hospital.emergency.phone : hospital.footer?.phone

  return (
    <div>
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tenant-primary, #6366f1) 18%, transparent)', color: 'var(--tenant-primary, #6366f1)' }}
      >
        <NavIcon name="appointments" className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-heading">{t('booking.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('booking.subtitle', { hospital: hospital.title })}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelClass}>{t('booking.phoneNumber')}</label>
          <input
            type="tel"
            placeholder="+91"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); clearFieldError('phone') }}
            className={inputClass}
          />
          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
        </div>

        {existingPatients.length > 0 && (
          <div>
            <label className={labelClass}>Who is this booking for?</label>
            <div className="mt-1.5 space-y-1.5">
              {existingPatients.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    selectedPatientId === p.id ? 'border-line-strong bg-card-strong' : 'border-line bg-card'
                  }`}
                >
                  <input
                    type="radio"
                    name="existingPatient"
                    checked={selectedPatientId === p.id}
                    onChange={() => setSelectedPatientId(p.id)}
                  />
                  <span className="text-heading">{p.name}</span>
                </label>
              ))}
              <label
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  atPatientCap ? 'cursor-not-allowed border-line bg-card opacity-50' : 'cursor-pointer'
                } ${selectedPatientId === 'new' ? 'border-line-strong bg-card-strong' : 'border-line bg-card'}`}
              >
                <input
                  type="radio"
                  name="existingPatient"
                  checked={selectedPatientId === 'new'}
                  disabled={atPatientCap}
                  onChange={() => setSelectedPatientId('new')}
                />
                <span className="text-heading">+ Someone else / new patient</span>
              </label>
            </div>
            {atPatientCap && (
              <p className="mt-1.5 text-xs text-faint">
                This phone number already has {MAX_PATIENTS_PER_PHONE} patients registered — please select one above.
              </p>
            )}
          </div>
        )}

        {isNewPatient && (
          <div>
            <label className={labelClass}>{t('booking.yourName')}</label>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => { setName(e.target.value); clearFieldError('name') }}
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('booking.doctor')} (optional)</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">{t('booking.noPreference')}</option>
              {doctors.map((d) => (
                <option key={d.uid} value={d.uid}>
                  {d.displayName} {d.specialization ? `— ${d.specialization}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t('booking.preferredDate')}</label>
            <input
              type="date"
              min={todayDateString()}
              value={date}
              onChange={(e) => { setDate(e.target.value); clearFieldError('date') }}
              className={inputClass}
            />
            {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
          </div>
        </div>

        {selectedDoctor ? (
          <div>
            <label className={labelClass}>{t('booking.preferredTime')}</label>
            {daySchedule?.available && (
              <p className="mt-1 mb-2 text-xs text-faint">
                {t('booking.scheduleAvailable', {
                  doctor: selectedDoctor.displayName,
                  day: t(`day.${weekday}`),
                  start: daySchedule.start,
                  end: daySchedule.end,
                })}
              </p>
            )}
            <TimeSlotPicker
              slots={slots}
              value={time}
              onChange={setTime}
              allowAny
              anyLabel={t('booking.anyTime')}
              emptyHint={t('booking.scheduleUnavailable', { doctor: selectedDoctor.displayName, day: t(`day.${weekday}`) })}
              accentColor="var(--tenant-primary, #6366f1)"
            />
          </div>
        ) : (
          <p className="text-xs text-faint">{t('booking.noDoctorTimeHint')}</p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: 'var(--tenant-primary, #6366f1)', color: 'var(--tenant-primary, #6366f1)' }}
        >
          <NavIcon name="appointments" className="h-4 w-4" />
          {submitting ? t('booking.submitting') : t('booking.submit')}
        </button>

        {callPhone && (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted">
            <NavIcon name="phone" className="h-3.5 w-3.5" />
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
    </div>
  )
}

export default BookAppointmentForm
