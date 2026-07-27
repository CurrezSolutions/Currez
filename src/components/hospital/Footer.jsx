import { useLanguage } from '../../contexts/LanguageContext'
import NavIcon from '../common/NavIcon'
import { SITE_CONTAINER } from '../../utils/layout'

function Footer({ config, onStatusClick }) {
  const { title, branding, footer, optionals } = config
  const { t } = useLanguage()

  const links = [
    optionals?.services?.enabled === 'on' && { href: '#services', label: t('hospital.navServices') },
    optionals?.departments?.enabled === 'on' && { href: '#departments', label: t('hospital.navDepartments') },
    optionals?.doctors?.enabled === 'on' && { href: '#doctors', label: t('hospital.navDoctors') },
    { href: '#contact', label: t('hospital.navContact') },
  ].filter(Boolean)

  const hasContact = footer?.address || footer?.phone || footer?.email

  return (
    <footer className="border-t border-line">
      <div className={`grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_1fr] ${SITE_CONTAINER}`}>
        <div>
          <div className="flex items-center gap-2.5">
            {branding?.logos?.smallLogo ? (
              <img
                src={branding.logos.smallLogo}
                alt={`${title} logo`}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-line"
              />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: 'var(--tenant-primary)' }}
              >
                {(title || '?')[0]}
              </span>
            )}
            <span className="text-base font-semibold text-heading">{title}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{t('hospital.footerTagline')}</p>
        </div>

        {links.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-widest text-faint uppercase">{t('hospital.quickLinks')}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-body">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-heading">
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  onClick={onStatusClick}
                  className="cursor-pointer text-left transition-colors hover:text-heading"
                >
                  {t('hospital.checkAppointmentStatus')}
                </button>
              </li>
            </ul>
          </div>
        )}

        {hasContact && (
          <div>
            <p className="text-xs font-semibold tracking-widest text-faint uppercase">{t('hospital.contact')}</p>
            <div className="mt-4 space-y-2.5 text-sm text-body">
              {footer?.address && (
                <p className="flex items-start gap-2">
                  <NavIcon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                  {footer.address}
                </p>
              )}
              {footer?.phone && (
                <p className="flex items-center gap-2">
                  <NavIcon name="phone" className="h-4 w-4 shrink-0 text-faint" />
                  <a href={`tel:${footer.phone.replace(/\s+/g, '')}`} className="hover:text-heading">
                    {footer.phone}
                  </a>
                </p>
              )}
              {footer?.email && (
                <p className="flex items-center gap-2">
                  <NavIcon name="mail" className="h-4 w-4 shrink-0 text-faint" />
                  <a href={`mailto:${footer.email}`} className="hover:text-heading">
                    {footer.email}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <p className={`py-5 text-center text-xs text-faint ${SITE_CONTAINER}`}>
          © {new Date().getFullYear()} {title}. {t('hospital.allRightsReserved')} • Powered by Currez v2.0.0
        </p>
      </div>
    </footer>
  )
}

export default Footer
