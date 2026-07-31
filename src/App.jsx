import { lazy, Suspense, useMemo } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { getTenantSlug } from './utils/subdomain'
import { PageSpinner } from './components/common/Spinner'
// Public, SEO-relevant pages stay eager — they need to paint immediately
// for both visitors and crawlers, with no extra chunk round-trip.
import CompanyLandingPage from './pages/CompanyLandingPage'
import HospitalLandingPage from './pages/HospitalLandingPage'
import PublicAppointmentPage from './pages/PublicAppointmentPage'
import AppointmentStatusPage from './pages/AppointmentStatusPage'
import DoctorProfilePage from './pages/DoctorProfilePage'
import { AuthProvider } from './contexts/AuthContext'
import { FeatureProvider } from './contexts/FeatureContext'
import { HospitalDataProvider } from './contexts/HospitalDataContext'
import RequireFeature from './components/hospitalAdmin/RequireFeature'
import RequireSuperAdmin from './components/superadmin/RequireSuperAdmin'
import RequireHospitalStaff from './components/hospitalAdmin/RequireHospitalStaff'
import RequireRole from './components/hospitalAdmin/RequireRole'
import RequirePermission from './components/hospitalAdmin/RequirePermission'
import { ROLES } from './utils/roles'

// Everything below is behind a login (superadmin or hospital staff) — never
// crawled, never needed on first paint for a public visitor, so it's split
// into its own chunk(s) that only download once someone actually navigates
// there instead of bloating the bundle every public page has to load.
const SuperAdminLayout = lazy(() => import('./components/superadmin/SuperAdminLayout'))
const SuperAdminLoginPage = lazy(() => import('./pages/superadmin/SuperAdminLoginPage'))
const DashboardPage = lazy(() => import('./pages/superadmin/DashboardPage'))
const HospitalsListPage = lazy(() => import('./pages/superadmin/HospitalsListPage'))
const HospitalFormPage = lazy(() => import('./pages/superadmin/HospitalFormPage'))
const HospitalDetailPage = lazy(() => import('./pages/superadmin/HospitalDetailPage'))
const StaffProfilePage = lazy(() => import('./pages/superadmin/StaffProfilePage'))
const HospitalPortalLayout = lazy(() => import('./components/hospitalAdmin/HospitalPortalLayout'))
const HospitalLoginPage = lazy(() => import('./pages/hospitalAdmin/HospitalLoginPage'))
const OverviewPage = lazy(() => import('./pages/hospitalAdmin/OverviewPage'))
const AppointmentsPage = lazy(() => import('./pages/hospitalAdmin/AppointmentsPage'))
const PatientsPage = lazy(() => import('./pages/hospitalAdmin/PatientsPage'))
const StaffPage = lazy(() => import('./pages/hospitalAdmin/StaffPage'))
const DoctorsPage = lazy(() => import('./pages/hospitalAdmin/DoctorsPage'))
const MySchedulePage = lazy(() => import('./pages/hospitalAdmin/MySchedulePage'))
const DoctorProfileEditor = lazy(() => import('./pages/hospitalAdmin/DoctorProfileEditor'))
const PatientLookupPage = lazy(() => import('./pages/hospitalAdmin/PatientLookupPage'))
const BillingPage = lazy(() => import('./pages/hospitalAdmin/BillingPage'))
const PrescriptionsPage = lazy(() => import('./pages/hospitalAdmin/PrescriptionsPage'))
const ChatbotPage = lazy(() => import('./pages/hospitalAdmin/ChatbotPage'))
const BedManagementPage = lazy(() => import('./pages/hospitalAdmin/BedManagementPage'))
const ActivityLogPage = lazy(() => import('./pages/hospitalAdmin/ActivityLogPage'))
const AnalyticsPage = lazy(() => import('./pages/hospitalAdmin/AnalyticsPage'))
const SuperAdminAnalyticsPage = lazy(() => import('./pages/superadmin/SuperAdminAnalyticsPage'))

function App() {
  const tenantSlug = useMemo(() => getTenantSlug(), [])
  const location = useLocation()

  return (
    <Suspense fallback={<PageSpinner />}>
    <Routes>
      <Route
        path="/"
        element={tenantSlug ? <HospitalLandingPage slug={tenantSlug} /> : <CompanyLandingPage />}
      />

      {/* /superadmin only exists on the root/company domain — under a
          tenant subdomain it falls through to the catch-all below. */}
      {!tenantSlug && (
        <Route
          path="/superadmin"
          element={
            <AuthProvider>
              <Outlet />
            </AuthProvider>
          }
        >
          <Route index element={<SuperAdminLoginPage />} />
          <Route element={<RequireSuperAdmin />}>
              <Route element={<SuperAdminLayout />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="analytics" element={<SuperAdminAnalyticsPage />} />
              <Route path="hospitals" element={<HospitalsListPage />} />
              <Route path="hospitals/new" element={<HospitalFormPage mode="create" />} />
              <Route path="hospitals/:slug" element={<HospitalDetailPage />} />
              <Route path="hospitals/:slug/staff/:uid" element={<StaffProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Route>
      )}

      {/* Public, no-login booking + status pages — only on a hospital's own subdomain. */}
      {tenantSlug && (
        <>
          <Route path="/appointment" element={<PublicAppointmentPage slug={tenantSlug} />} />
          <Route path="/appointment-status" element={<AppointmentStatusPage slug={tenantSlug} />} />
          <Route path="/doctor/:doctorId" element={<DoctorProfilePage />} />
        </>
      )}

      {/* /login and /dashboard only exist on a hospital's own subdomain —
          each tenant's staff sign in and manage only their own hospital. */}
      {tenantSlug && (
        <Route
          element={
            <AuthProvider>
              <Outlet />
            </AuthProvider>
          }
        >
          <Route path="/login" element={<HospitalLoginPage tenantSlug={tenantSlug} />} />
          <Route path="/dashboard" element={<Outlet />}>
            <Route element={<RequireHospitalStaff tenantSlug={tenantSlug} />}>
              {/* Feature flags for this hospital only resolve once we know
                  who's logged in, so FeatureProvider mounts here — after
                  RequireHospitalStaff, wrapping everything else below. */}
              <Route element={<FeatureProvider><Outlet /></FeatureProvider>}>
                <Route element={<HospitalDataProvider tenantSlug={tenantSlug}><Outlet /></HospitalDataProvider>}>
                  <Route element={<HospitalPortalLayout tenantSlug={tenantSlug} />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<OverviewPage tenantSlug={tenantSlug} />} />

                    {/* Every staff role, narrowed further by each staff
                        member's own Super-Admin-assigned permission level */}
                    <Route element={<RequirePermission moduleKey="appointments" />}>
                      <Route path="appointments" element={<AppointmentsPage tenantSlug={tenantSlug} />} />
                    </Route>

                    {/* Hospital admin + receptionist only */}
                    <Route element={<RequireRole allowedRoles={[ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST]} />}>
                      <Route element={<RequirePermission moduleKey="patients" />}>
                        <Route path="patients" element={<PatientsPage tenantSlug={tenantSlug} />} />
                      </Route>
                    </Route>

                    {/* Hospital admin only */}
                    <Route element={<RequireRole allowedRoles={[ROLES.HOSPITAL_ADMIN]} />}>
                      <Route path="staff" element={<StaffPage tenantSlug={tenantSlug} />} />
                      {/* Off by default — only if the Super Admin has turned
                          the Activity Log module on for this hospital */}
                      <Route element={<RequireFeature featureKey="activityLog" />}>
                        <Route path="activity-log" element={<ActivityLogPage tenantSlug={tenantSlug} />} />
                      </Route>
                    </Route>

                    {/* Receptionist only — read-only doctor schedules */}
                    <Route element={<RequireRole allowedRoles={[ROLES.RECEPTIONIST]} />}>
                      <Route element={<RequirePermission moduleKey="doctors" />}>
                        <Route path="doctors" element={<DoctorsPage tenantSlug={tenantSlug} />} />
                      </Route>
                    </Route>

                    {/* Doctor only — self-service schedule and profile */}
                    <Route element={<RequireRole allowedRoles={[ROLES.DOCTOR]} />}>
                      <Route path="schedule" element={<MySchedulePage />} />
                      <Route path="profile" element={<DoctorProfileEditor />} />
                      <Route path="patient-lookup" element={<PatientLookupPage />} />
                    </Route>

                    {/* Hospital admin + receptionist, and only if the Super
                        Admin has enabled the chatbot module for this hospital */}
                    <Route element={<RequireRole allowedRoles={[ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST]} />}>
                      <Route element={<RequireFeature featureKey="chatbot" />}>
                        <Route element={<RequirePermission moduleKey="chatbot" />}>
                          <Route path="chatbot" element={<ChatbotPage />} />
                        </Route>
                      </Route>
                    </Route>

                    {/* Hospital admin + receptionist, and only if the Super
                        Admin has enabled Billing for this hospital */}
                    <Route element={<RequireRole allowedRoles={[ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST]} />}>
                      <Route element={<RequireFeature featureKey="billing" />}>
                        <Route element={<RequirePermission moduleKey="billing" />}>
                          <Route path="billing" element={<BillingPage tenantSlug={tenantSlug} />} />
                        </Route>
                      </Route>
                    </Route>

                    {/* Hospital admin, receptionist and doctor, and only if
                        the Super Admin has enabled Prescriptions for this hospital */}
                    <Route element={<RequireRole allowedRoles={[ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR]} />}>
                      <Route element={<RequireFeature featureKey="prescriptions" />}>
                        <Route element={<RequirePermission moduleKey="prescriptions" />}>
                          <Route path="prescriptions" element={<PrescriptionsPage tenantSlug={tenantSlug} />} />
                        </Route>
                      </Route>
                    </Route>

                    {/* Hospital admin + receptionist, and only if the Super
                        Admin has enabled Bed Management for this hospital */}
                    <Route element={<RequireRole allowedRoles={[ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST]} />}>
                      <Route element={<RequireFeature featureKey="bedManagement" />}>
                        <Route element={<RequirePermission moduleKey="bedManagement" />}>
                          <Route path="beds" element={<BedManagementPage tenantSlug={tenantSlug} />} />
                        </Route>
                      </Route>
                    </Route>

                    {/* Hospital admin only, and only if the Super Admin
                        has enabled Analytics for this hospital */}
                    <Route element={<RequireRole allowedRoles={[ROLES.HOSPITAL_ADMIN]} />}>
                      <Route element={<RequireFeature featureKey="analytics" />}>
                        <Route path="analytics" element={<AnalyticsPage />} />
                      </Route>
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      )}

      <Route path="*" element={<Navigate to={{ pathname: '/', search: location.search }} replace />} />
    </Routes>
    </Suspense>
  )
}

export default App
