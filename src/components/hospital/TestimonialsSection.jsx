import { useLanguage } from '../../contexts/LanguageContext'
import { initials } from '../../utils/initials'
import SectionEyebrow from './SectionEyebrow'
import Reveal from '../common/Reveal'
import { SITE_CONTAINER } from '../../utils/layout'

function TestimonialsSection({ data }) {
  const items = data?.items ?? []
  const { t } = useLanguage()
  if (items.length === 0) return null

  return (
    <section id="testimonials" className={`py-20 ${SITE_CONTAINER}`}>
      <Reveal>
        <SectionEyebrow>{t('hospital.navTestimonials')}</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold text-heading">{t('hospital.testimonials')}</h2>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((item, i) => {
          // First testimonial gets a larger, spotlighted treatment when
          // there's enough content to justify the asymmetry — with only
          // one or two items an oversized lone card would look like a bug.
          const featured = i === 0 && items.length >= 3
          // Clamp defensively at the render boundary — String.repeat throws
          // on a negative count, and a rating > 5 would make the "empty
          // stars" count negative too. Protects against bad data regardless
          // of how it got saved (this is the actual crash site).
          const rating = Math.min(5, Math.max(0, Math.round(Number(item.rating) || 5)))
          return (
            <Reveal
              key={item.name}
              delay={i * 80}
              className={`relative overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-line-strong hover:shadow-lg ${
                featured ? 'p-8 md:col-span-2 md:p-10' : 'p-7'
              }`}
            >
              <span
                className={`pointer-events-none absolute -top-3 right-4 leading-none opacity-10 ${featured ? 'text-9xl' : 'text-7xl'}`}
                style={{ color: 'var(--tenant-primary)' }}
                aria-hidden="true"
              >
                &rdquo;
              </span>
              <p className="relative text-sm tracking-wide" style={{ color: 'var(--tenant-primary)' }}>
                {'★'.repeat(rating)}
                <span className="text-line-strong">{'★'.repeat(5 - rating)}</span>
              </p>
              <p className={`relative mt-3 text-body ${featured ? 'text-xl font-medium text-heading md:text-2xl' : 'text-sm'}`}>
                &ldquo;{item.message}&rdquo;
              </p>
              <div className="relative mt-5 flex items-center gap-3">
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
                    featured ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs'
                  }`}
                  style={{
                    background: 'color-mix(in srgb, var(--tenant-primary) 15%, transparent)',
                    color: 'var(--tenant-primary)',
                  }}
                >
                  {initials(item.name)}
                </span>
                <p className={`font-medium text-heading ${featured ? 'text-base' : 'text-sm'}`}>{item.name}</p>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

export default TestimonialsSection
