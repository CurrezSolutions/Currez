import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { signOutUser } from '../../firebase/auth'
import { useAuth } from '../../contexts/AuthContext'
import { useFeatures } from '../../contexts/FeatureContext'
import { useHospitalData } from '../../contexts/HospitalDataContext'
import { FEATURE_REGISTRY } from '../../config/featureRegistry'
import { ROLE_LABELS } from '../../utils/roles'
import { canViewModule } from '../../utils/permissions'
import StatusBadge from '../superadmin/StatusBadge'
import NavIcon from '../common/NavIcon'
import ThemeToggle from '../common/ThemeToggle'
import { PageSpinner } from '../common/Spinner'
import MobileNavDrawer from '../common/MobileNavDrawer'

function HospitalPortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role, userDoc } = useAuth()
  const { isFeatureEnabled } = useFeatures()
  const { hospital, ready } = useHospitalData()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const navItems = FEATURE_REGISTRY.filter(
    (feature) =>
      feature.allowedRoles.includes(role) &&
      isFeatureEnabled(feature.key) &&
      canViewModule(userDoc, feature.key)
  ).map((feature) => ({
    to: { pathname: feature.path, search: location.search },
    label: feature.label,
    icon: feature.icon,
  }))

  const brand = (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/20">
        <NavIcon name="hospitals" className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-heading">
          {hospital?.title || 'Hospital Dashboard'}
        </span>
        <div className="mt-0.5 flex items-center gap-2">
          {hospital?.status && <StatusBadge status={hospital.status} />}
          <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">
            {ROLE_LABELS[role]}
          </span>
        </div>
      </div>
    </div>
  )

  const userFooter = (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
        {(user?.email || '?')[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-heading">{user?.displayName || user?.email}</p>
        <p className="truncate text-[11px] text-faint">{ROLE_LABELS[role]} • v2.0.0</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-page text-heading md:flex">
      {/* Desktop sidebar only — below `md` this is replaced entirely by
          MobileNavDrawer (see the header hamburger below), rather than
          squeezing into a wrapping horizontal bar of nav items. */}
      <aside className="relative hidden flex-col overflow-hidden border-r border-line bg-surface md:flex md:w-64 md:shrink-0">
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }}
        />

        <div className="relative px-5 pt-6 pb-2">{brand}</div>

        <nav className="relative mt-2 flex flex-1 flex-col gap-1 px-2.5 pb-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to.pathname}
              to={item.to}
              className={({ isActive }) =>
                `group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-600 shadow-sm shadow-indigo-500/5 ring-1 ring-inset ring-indigo-500/25 dark:text-indigo-300'
                    : 'text-muted hover:bg-card-strong hover:text-heading'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'text-faint group-hover:text-muted'
                  }`}>
                    <NavIcon name={item.icon} className="h-4 w-4" />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative border-t border-line px-5 py-4">{userFooter}</div>
      </aside>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        brand={brand}
        navItems={navItems}
        footer={userFooter}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line/80 bg-surface/80 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-body transition-colors hover:bg-card-strong md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link
              to={{ pathname: '/', search: location.search }}
              className="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-card-strong hover:text-heading sm:px-3"
            >
              <NavIcon name="eye" className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">View public site</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <span className="hidden text-sm text-muted lg:inline">{user?.email}</span>
            <button
              onClick={() => signOutUser().then(() => navigate('/', { search: location.search }))}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-red-500/10 hover:text-red-600 sm:px-3 dark:hover:text-red-400"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 md:p-8">
          {ready ? <Outlet /> : <PageSpinner />}
        </main>
      </div>
    </div>
  )
}

export default HospitalPortalLayout
