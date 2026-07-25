import { Link } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import { isAvailableToday, availableDaysShortLabel } from '../../utils/doctorSchedule'
import { initials } from '../../utils/initials'
import SectionEyebrow from './SectionEyebrow'
import Reveal from '../common/Reveal'
import { SITE_CONTAINER } from '../../utils/layout'

function DoctorsSection({ doctors, slug }) {
  const { t } = useLanguage()
  if (!doctors || doctors.length === 0) return null

  return (
    <section id="doctors" className={`py-20 ${SITE_CONTAINER}`}>
      <Reveal>
        <SectionEyebrow>{t('hospital.navDoctors')}</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold text-heading">{t('hospital.ourDoctors')}</h2>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {doctors.map((doctor, i) => {
          const availableToday = isAvailableToday(doctor.schedule)
          const daysLabel = availableDaysShortLabel(doctor.schedule)
          return (
            <Reveal
              key={doctor.uid}
              delay={i * 60}
            >
              <Link
                to={`/doctor/${doctor.uid}?tenant=${slug}`}
                className="group block rounded-2xl border border-line bg-card p-7 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-line-strong hover:shadow-lg"
              >
                {doctor.photoUrl ? (
                  <img
                    src={doctor.photoUrl}
                    alt={doctor.displayName}
                    className="mx-auto h-16 w-16 rounded-full object-cover shadow-sm transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 60%, black))',
                    }}
                  >
                    {initials(doctor.displayName)}
                  </span>
                )}
                <h3 className="mt-4 font-semibold text-heading">{doctor.displayName}</h3>
                {doctor.specialization && <p className="mt-1 text-sm text-body">{doctor.specialization}</p>}
                <span
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    availableToday ? '' : 'bg-card-strong text-muted'
                  }`}
                  style={
                    availableToday
                      ? { border: '1px solid var(--tenant-primary)', color: 'var(--tenant-primary)' }
                      : undefined
                  }
                >
                  {availableToday && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style={{ backgroundColor: 'var(--tenant-primary)' }}
                      />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--tenant-primary)' }} />
                    </span>
                  )}
                  {availableToday ? 'Available today' : daysLabel || 'By appointment'}
                </span>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

export default DoctorsSection
