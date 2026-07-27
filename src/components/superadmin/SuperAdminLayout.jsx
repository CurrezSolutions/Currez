import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../../firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import NavIcon from "../common/NavIcon";
import ThemeToggle from "../common/ThemeToggle";
import MobileNavDrawer from "../common/MobileNavDrawer";

const NAV_ITEMS = [
  { to: "/superadmin/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/superadmin/analytics", label: "Analytics", icon: "analytics" },
  { to: "/superadmin/hospitals", label: "Hospitals", icon: "hospitals" },
];

function SuperAdminLayout() {
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const brand = (
    <div className="flex items-center gap-3">
      <img src="/currez-mark.png" alt="Currez" className="h-9 w-9 shrink-0 rounded-xl object-contain ring-1 ring-inset ring-indigo-500/20" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-heading">Currez</span>
        <span className="block text-[10px] font-semibold tracking-widest text-faint uppercase">
          Super Admin
        </span>
      </div>
    </div>
  );

  const userFooter = (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 ring-1 ring-indigo-500/20 ring-inset dark:text-indigo-300">
        {(user?.email || '?')[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-heading">{user?.email}</p>
        <p className="truncate text-[11px] text-faint">Super Admin • v2.0.0</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page text-heading md:flex">
      {/* Desktop sidebar only — below `md` this is replaced entirely by
          MobileNavDrawer (see the header hamburger below). */}
      <aside className="relative hidden flex-col overflow-hidden border-r border-line bg-surface md:flex md:w-64 md:shrink-0">
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)" }}
        />

        <div className="relative px-5 pt-6 pb-2">{brand}</div>

        <nav className="relative mt-2 flex flex-1 flex-col gap-1 px-2.5 pb-6">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-500/15 text-indigo-600 shadow-sm shadow-indigo-500/5 ring-1 ring-indigo-500/25 ring-inset dark:text-indigo-300"
                    : "text-muted hover:bg-card-strong hover:text-heading"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                      isActive ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300" : "text-faint group-hover:text-muted"
                    }`}
                  >
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
        navItems={NAV_ITEMS}
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
            <span className="truncate text-sm text-muted sm:hidden">{user?.email}</span>
            <span className="hidden truncate text-sm text-muted sm:inline">Managing all onboarded hospitals</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <button
              onClick={() => signOutUser()}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-red-500/10 hover:text-red-600 sm:px-3 dark:hover:text-red-400"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default SuperAdminLayout;
