import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { subscribeDoctor } from '../firebase/users'
import { subscribeHospital } from '../firebase/hospitals'
import { useTheme } from '../contexts/ThemeContext'
import { useSeoMeta } from '../hooks/useSeoMeta'
import { initials } from '../utils/initials'
import { isAvailableToday, availableDaysShortLabel, DAY_LABELS, DAYS_OF_WEEK, formatTimeLabel } from '../utils/doctorSchedule'
import { renderMarkdown } from '../utils/renderMarkdown'
import Spinner from '../components/common/Spinner'
import NavIcon from '../components/common/NavIcon'
import Reveal from '../components/common/Reveal'

const TABS = ['about', 'credentials', 'schedule']

function DoctorProfilePage() {
  const { doctorId } = useParams()
  const [searchParams] = useSearchParams()
  const slug = searchParams.get('tenant')
  const { theme } = useTheme()
  const [doctor, setDoctor] = useState(undefined)
  const [hospital, setHospital] = useState(undefined)
  const [activeTab, setActiveTab] = useState('about')

  useEffect(() => {
    if (!doctorId) return
    return subscribeDoctor(doctorId, setDoctor)
  }, [doctorId])

  useEffect(() => {
    if (!doctor?.hospitalId) return
    return subscribeHospital(doctor.hospitalId, setHospital)
  }, [doctor?.hospitalId])

  useSeoMeta({
    title:
      doctor?.displayName && hospital?.title ? `Dr. ${doctor.displayName} — ${hospital.title}` : undefined,
    description:
      doctor?.displayName &&
      `Book an appointment with Dr. ${doctor.displayName}${doctor.specialization ? `, ${doctor.specialization}` : ''}${
        hospital?.title ? ` at ${hospital.title}` : ''
      }.`,
    structuredData:
      doctor?.displayName && hospital?.title
        ? {
            '@context': 'https://schema.org',
            '@type': 'Physician',
            name: `Dr. ${doctor.displayName}`,
            ...(doctor.specialization && { medicalSpecialty: doctor.specialization }),
            url: window.location.href,
            worksFor: {
              '@type': 'Hospital',
              name: hospital.title,
            },
          }
        : undefined,
  })

  if (doctor === undefined || hospital === undefined) return <Spinner />
  if (!doctor || doctor.role !== 'DOCTOR' || doctor.status !== 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-heading">
        <div className="text-center">
          <p className="text-lg font-medium text-heading">Doctor not found</p>
          <Link
            to={slug ? { pathname: '/', search: `?tenant=${slug}` } : '/'}
            className="mt-3 inline-block text-sm text-muted hover:text-heading"
          >
            &larr; Back to hospital
          </Link>
        </div>
      </div>
    )
  }

  const daysLabel = availableDaysShortLabel(doctor.schedule)
  const availableToday = isAvailableToday(doctor.schedule)
  const primary = hospital.branding?.primaryColor || '#6366f1'
  const secondary = hospital.branding?.secondColor || '#0f172a'

  const languages = doctor.languages || []
  const credentials = doctor.credentials || []
  const aboutHtml = renderMarkdown(doctor.about)

  // stats that appear in the hero strip
  const stats = [
    doctor.yearsOfExperience != null && {
      value: `${doctor.yearsOfExperience}+`,
      label: 'Years Experience',
      icon: 'star',
    },
    doctor.consultationFee != null && {
      value: `\u20B9${doctor.consultationFee}`,
      label: 'Consultation Fee',
      icon: 'appointments',
    },
    languages.length > 0 && {
      value: languages.length,
      label: languages.length === 1 ? 'Language' : 'Languages',
      icon: 'chat',
    },
    doctor.schedule && {
      value: DAYS_OF_WEEK.filter((d) => doctor.schedule[d]?.available).length,
      label: 'Days / Week',
      icon: 'schedule',
    },
  ].filter(Boolean)

  return (
    <div
      className="tenant-site min-h-screen"
      style={{
        '--tenant-primary': primary,
        '--tenant-secondary': secondary,
        backgroundColor: theme === 'dark' ? 'var(--tenant-secondary)' : undefined,
      }}
    >
      {/* ── Hero Banner ──────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-6 pt-10 pb-20 md:px-12"
        style={{ backgroundColor: secondary }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 80% 10%, color-mix(in srgb, ${primary} 30%, transparent), transparent), linear-gradient(180deg, transparent, rgba(0,0,0,0.35))`,
          }}
        />

        {/* back link */}
        <div className="relative z-10 mb-10">
          <Link
            to={slug ? { pathname: '/', search: `?tenant=${slug}` } : '/'}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <NavIcon name="arrowLeft" className="h-4 w-4" />
            {hospital.title}
          </Link>
        </div>

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 sm:flex-row sm:items-start">
          {/* avatar */}
          <div className="shrink-0">
            {doctor.photoUrl ? (
              <img
                src={doctor.photoUrl}
                alt={doctor.displayName}
                className="h-28 w-28 rounded-2xl object-cover shadow-xl ring-1 ring-white/20"
              />
            ) : (
              <span
                className="flex h-28 w-28 items-center justify-center rounded-2xl text-3xl font-extrabold text-white shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 55%, black))`,
                }}
              >
                {initials(doctor.displayName)}
              </span>
            )}
          </div>

          {/* info */}
          <div className="flex-1 text-center sm:text-left">
            {/* availability badge */}
            <span
              className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                availableToday ? 'text-white' : 'bg-white/10 text-white/60'
              }`}
              style={availableToday ? { backgroundColor: primary } : undefined}
            >
              {availableToday && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-white" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              )}
              {availableToday ? 'Available Today' : daysLabel || 'By Appointment'}
            </span>

            <h1 className="text-3xl font-extrabold text-white md:text-4xl">Dr. {doctor.displayName}</h1>
            {doctor.specialization && (
              <p className="mt-2 text-base font-medium text-white/70 md:text-lg">{doctor.specialization}</p>
            )}
            {doctor.department && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/50 sm:justify-start">
                <NavIcon name="hospitals" className="h-3.5 w-3.5" />
                {doctor.department}
              </p>
            )}

            {/* quick stats inside hero */}
            {stats.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                {stats.map((s) => (
                  <span
                    key={s.label}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur"
                  >
                    <NavIcon name={s.icon} className="h-3.5 w-3.5" />
                    <span>{s.value}</span>
                    <span className="text-white/50">{s.label}</span>
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <Link
                to={slug ? { pathname: '/appointment', search: `?tenant=${slug}&doctor=${doctor.uid}` } : '/'}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ color: primary }}
              >
                <NavIcon name="appointments" className="h-4 w-4" />
                Book Appointment
              </Link>
              {hospital.footer?.phone && (
                <a
                  href={`tel:${hospital.footer.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:border-white/50"
                >
                  <NavIcon name="phone" className="h-3.5 w-3.5" />
                  Call Now
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Content Tabs ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-6 -mt-6">
        <Reveal>
          <div className="rounded-2xl border border-line bg-card shadow-sm">
            {/* tab bar */}
            <div className="flex border-b border-line">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 cursor-pointer px-4 py-3.5 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 text-heading'
                      : 'text-muted hover:text-body hover:bg-card-strong'
                  }`}
                  style={activeTab === tab ? { borderColor: primary, color: primary } : undefined}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* tab panels */}
            <div className="p-6 md:p-8">
              {/* ── About ─────────────────────────── */}
              {activeTab === 'about' && (
                <div className="animate-fade-in-up">
                  {aboutHtml ? (
                    <div
                      className="prose-sm max-w-none text-sm leading-relaxed text-body"
                      style={{
                        // theme-aware prose
                        '--tw-prose-headings': 'var(--color-heading)',
                        '--tw-prose-bold': 'var(--color-heading)',
                        '--tw-prose-links': primary,
                      }}
                      dangerouslySetInnerHTML={{ __html: aboutHtml }}
                    />
                  ) : (
                    <p className="text-sm text-faint">No information provided yet.</p>
                  )}

                  {/* Languages */}
                  {languages.length > 0 && (
                    <div className="mt-8 border-t border-line pt-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Languages</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {languages.map((lang) => (
                          <span
                            key={lang}
                            className="rounded-full px-3 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${primary} 12%, transparent)`,
                              color: primary,
                            }}
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Credentials ────────────────────── */}
              {activeTab === 'credentials' && (
                <div className="animate-fade-in-up">
                  {credentials.length > 0 ? (
                    <div className="relative ml-3 border-l-2 border-line pl-6">
                      {credentials.map((cred, i) => (
                        <div key={i} className="relative mb-8 last:mb-0">
                          {/* dot on timeline */}
                          <span
                            className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white"
                            style={{ backgroundColor: primary }}
                          >
                            {i + 1}
                          </span>
                          <p className="text-sm font-semibold text-heading">{cred.degree}</p>
                          {cred.institution && (
                            <p className="mt-0.5 text-sm text-body">{cred.institution}</p>
                          )}
                          {cred.year && (
                            <span className="mt-1 inline-block rounded-full bg-card-strong px-2.5 py-0.5 text-xs font-medium text-muted">
                              {cred.year}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-faint">No credentials added yet.</p>
                  )}
                </div>
              )}

              {/* ── Schedule ───────────────────────── */}
              {activeTab === 'schedule' && (
                <div className="animate-fade-in-up">
                  {doctor.schedule ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {DAYS_OF_WEEK.map((day) => {
                          const dayData = doctor.schedule[day]
                          const isOn = dayData?.available
                          const isToday = new Date().getDay() === ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day)
                          return (
                            <div
                              key={day}
                              className={`relative rounded-xl border p-3 text-center transition-all ${
                                isOn
                                  ? isToday
                                    ? 'border-line-strong bg-card-strong shadow-sm'
                                    : 'border-line bg-card'
                                  : 'border-line bg-card opacity-50'
                              }`}
                            >
                              {isToday && isOn && (
                                <span
                                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                                  style={{ backgroundColor: primary }}
                                >
                                  TODAY
                                </span>
                              )}
                              <span className="block text-xs font-semibold capitalize text-heading">{DAY_LABELS[day]}</span>
                              {isOn ? (
                                <span className="mt-1 block text-xs text-muted">
                                  {formatTimeLabel(dayData.start)} — {formatTimeLabel(dayData.end)}
                                </span>
                              ) : (
                                <span className="mt-1 block text-xs text-faint">Off</span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {doctor.schedule.slotMinutes && (
                        <p className="mt-4 text-center text-xs text-faint">
                          Appointment slots: {doctor.schedule.slotMinutes} minutes each
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-faint">Schedule not set yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-6 py-12 text-center">
        <div
          className="rounded-2xl p-8"
          style={{
            background: `linear-gradient(135deg, ${secondary}, color-mix(in srgb, ${primary} 25%, ${secondary}))`,
          }}
        >
          <h3 className="text-lg font-bold text-white">Need consultation with Dr. {doctor.displayName}?</h3>
          <p className="mt-1 text-sm text-white/60">
            Book an appointment today and get the care you deserve.
          </p>
          <Link
            to={slug ? { pathname: '/appointment', search: `?tenant=${slug}&doctor=${doctor.uid}` } : '/'}
            className="mt-5 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: primary }}
          >
            <NavIcon name="appointments" className="h-4 w-4" />
            Book Appointment
          </Link>
        </div>
      </div>
    </div>
  )
}

export default DoctorProfilePage
