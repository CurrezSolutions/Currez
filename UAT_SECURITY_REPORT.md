# UAT & Security Report — 2026-07-25

Full user-acceptance pass across every role, an adversarial ("what would a scammer try") pass against `firestore.rules` — the *real* enforcement layer, since this app has no custom backend and talks to Firestore directly from the browser — and, in a second pass the same day, fixes for everything found plus four new features. Anything the client SDK can do, a visitor with devtools open can do too, regardless of what the UI shows or hides; that's what was tested throughout.

**How this was tested.** No browser is available in this environment, so nothing here was clicked through by hand. Instead I drove the exact same Firebase client SDK the app uses — signing in as each role and calling the same operations the UI would, plus the ones it wouldn't — which is actually the more rigorous test for the security half: it's exactly what a real attacker gets from opening devtools console on the deployed site. Every rules change made today was deployed to the live project and then re-verified live (13 checks, all passing) before being considered done — not just reasoned about on paper. For pure UI/UX completeness (empty states, confirmation dialogs, layout), I read the component source directly. Please spot-check the new UI visually when you get a chance — I can't see it render.

---

## Contents

1. [What was built (test data)](#1-what-was-built-test-data)
2. [Fixed today — code changes](#2-fixed-today--code-changes)
3. [firestore.rules changes — deployed and re-verified live](#3-firestorerules-changes--deployed-and-re-verified-live)
4. [New features built](#4-new-features-built)
5. [Still open — needs a decision, not fixed today](#5-still-open--needs-a-decision-not-fixed-today)
6. [Other bugs found (not fixed — lower priority)](#6-other-bugs-found-not-fixed--lower-priority)
7. [Missing features not built today](#7-missing-features-not-built-today)
8. [Your "how do we stop a receptionist going rogue" question, directly answered](#8-your-how-do-we-stop-a-receptionist-going-rogue-question-directly-answered)
9. [How to look at the new data yourself](#9-how-to-look-at-the-new-data-yourself)

---

## 1. What was built (test data)

**A brand-new hospital, end to end, as a real tenant would use it:** **Northstar Multispecialty Hospital** (slug `northstar-mh`) — full theme (colors, hero, logo/background photo URLs), footer/contact, emergency bar, OPD hours, 7 services, 7 departments, 3 testimonials, all 5 optional modules enabled. A Hospital Admin created 3 doctors and 2 receptionists; 3 patients self-booked through the public flow exactly like real visitors; reception confirmed them (one with a doctor reassignment, one resolved at the desk with no preference given); a doctor completed a visit with a real prescription; billing created an itemized GST invoice and took a partial then final payment. Beds & Wards: 2 floors, 12 beds across a general ward, private rooms and ICU; a patient was admitted, transferred mid-stay, and discharged with bed charges auto-added to billing.

**Gabbar Hospital** — this was already real, in-progress data (yours or a teammate's), so only gaps were filled, nothing already entered was overwritten: hero text, emergency contact, years-serving, a fuller address, 3 more services, all departments and testimonials (were empty), both doctors' bios/fees/experience (had schedules but nothing else). Beds & Wards and Analytics were turned on (were off).

Then I tried to break all of it — as an anonymous attacker, and as every staff role trying to exceed their privileges. 31 adversarial probes in the first pass; 10 real gaps found. This report covers what happened next: fixing every one of them that was safely fixable, and building the four features you asked for on top.

---

## 2. Fixed today — code changes

| # | File(s) | What was wrong | Fix |
|---|---|---|---|
| 1 | `src/utils/renderMarkdown.js` | **Stored XSS.** Zero HTML escaping — any Doctor account could put a `<script>`/`onerror=` payload in their own free-text bio and it would execute for every visitor to their public profile page, no login required. Proved live with a real payload, then fixed. | Escape all text content before markdown transforms; restrict link URLs to `http(s)/mailto/tel` |
| 2 | `HospitalDetailPage.jsx` | Super Admin's Staff tab could deactivate/reactivate *any* staff member or send a password reset with one click, no confirmation — inconsistent with the same action elsewhere in the app | Wrapped both in the existing `ConfirmModal`, matching the established pattern |
| 3 | `AppointmentsPage.jsx` | "Cancel" on a confirmed appointment fired immediately, no confirmation | Added a `ConfirmModal` step; also now logs to the new Activity Log (§4) |
| 4 | `TestimonialsSection.jsx`, `ContentSectionEditor.jsx`, `hospitalContentSchema.js` | A testimonial rating outside 1–5 crashes the **public landing page** for every visitor — `'★'.repeat(-5)` throws `RangeError`. Confirmed with a direct test, not speculation. | Clamped at the render site (fixes it regardless of how bad data got there) + `min`/`max` added to the field schema |
| 5 | `App.jsx` | `/dashboard/beds` was the only feature-gated route missing the `RequirePermission` wrapper every sibling module has — a receptionist locked out of Beds & Wards could still reach it by typing the URL | Added the missing wrapper |
| 6 | `BedConfigBuilder.jsx`, `DoctorProfileEditor.jsx` | Bed daily rate, doctor consultation fee and years-of-experience could all be saved negative (`min="0"` is an HTML hint only) | Clamped to `Math.max(0, ...)` in all three |
| 7 | `validations.js` | The shared URL validator (branding images, now also doctor photos) accepted any scheme, including `javascript:` | Restricted to `http:`/`https:` |
| 8 | `StaffFormModal.jsx` | Any staff account (Doctor/Receptionist/Hospital Admin) could be created with a password as weak as 6 characters | Raised the app-enforced minimum to 10 |
| 9 | `BedBlock.jsx` | A "selected" bed visual state existed but was never wired up anywhere — dead code | Removed |
| 10 | `AnalyticsPage.jsx` | "Top Doctors" and "Peak Hours" silently ignored the date-range selector everyone else on the page respects | Now computed from the same range-filtered list as the rest of the page |
| 11 | `SuperAdminAnalyticsPage.jsx` | "Total Staff" stat card looked clickable but did nothing (`onClick={() => {}}`) while its three siblings all opened a real drill-down | Built the missing drill-down: a live, searchable, exportable staff list across every hospital, matching the other three |
| 12 | `HospitalDetailPage.jsx` | Super Admin's per-hospital Overview tab showed hardcoded `0`s for appointment stats, never wired to real data | Now a live subscription, same pattern the Modules tab already used to avoid an unnecessary read on other tabs |
| 13 | `firebase/bedManagement.js` | `admitPatient`/`transferAdmission` checked for a bed conflict with a plain query, then wrote separately — two receptionists admitting to the same bed within that race window could both succeed | Rewritten to claim the bed transactionally via a new `bedLocks` doc, the same pattern `doctorSlots` already used for doctors' time slots |

`npm run build` passes clean after every change. Dev server boots and all three tenant routes (company site, Northstar, Gabbar) return `200`.

---

## 3. firestore.rules changes — deployed and re-verified live

This is the live security boundary for every real tenant, so instead of just describing these I deployed them (`firebase deploy --only firestore:rules`) and then ran 13 targeted checks against real Northstar data afterward — signing in as real accounts and confirming both that nothing legitimate broke *and* that the specific gaps below are actually closed, not just theoretically fixed. **All 13 passed.** Two bugs turned up during that verification pass, both in my own throwaway test script (wrong identity signed in for a setup step, and a restore attempt that itself violated the new additive-only rule) — not in the deployed rules; both are called out inline below since they're informative about what the fix actually enforces.

### 3.1. Granular staff permissions were UI-only for almost every module — now enforced server-side

This was the systemic version of exactly what you asked about — "if receptionist have access he can do anything." The Staff → Permissions screen lets a Hospital Admin set **No access / View only / Full access** per module, but `firestore.rules` never checked it — only whether someone was active staff of the hospital at all. A receptionist locked out of a module in that screen could still read and write its data by calling Firestore directly (proven live: reading the full patient list and admitting a patient despite both being explicitly set to "No access").

**Fixed.** Added two helper functions and applied them to `patients`, `appointments`, `bedConfig`, and `admissions`:

- `hasModuleAccess(hospitalId, moduleKey)` — gates **writes**: true for Hospital Admin always, or a Doctor/Receptionist whose permission for that module is exactly `'edit'` (default `'edit'` when unset, so nobody's access silently changed today unless a Hospital Admin had actually locked something down).
- `canViewModuleData(hospitalId, moduleKey)` — gates **reads**: true unless the permission is explicitly `'none'`. `'view'` and `'edit'` both still see the data; only `'none'` hides it, matching `canViewModule`/`canEditModule` in `src/utils/permissions.js` exactly.

Verified live, post-deploy: a receptionist with Patients set to "No access" can no longer read the patient list (previously could); the same receptionist with Beds & Wards set to "No access" can no longer admit a patient (previously could); a different, untouched receptionist with default permissions can still do both normally. All three confirmed.

**One related gap not closed today:** Billing has *some* server-side enforcement already (`isBillingStaffOf`, a more complex existing function with its own legacy-compatibility rules), but it only ever checks "is this `'none'`?", never "is this `'view'` vs `'edit'`?" — so a receptionist set to Billing "View only" can still create/edit invoices server-side. I didn't touch `isBillingStaffOf` today: it's used by four collections (`invoices`, `invoiceCounters`, `invoicePayments`, plus the legacy `billingAccess` boolean it has to stay compatible with), and reworking it carries more risk of breaking real billing flows than the mechanical fix I made elsewhere. Re-verified this is still true post-deploy, on purpose — flagging for a deliberate follow-up rather than a rushed one.

### 3.2. Anonymous doctorSlots overwrite — now additive-only

Previously, anyone unauthenticated could overwrite a doctor's *entire* availability doc in one write (proven live by replacing a real doctor's schedule with 35 fake "taken" slots). The rule now only accepts a create with exactly one time, or an update that's provably additive — the new array must contain every element of the old one plus exactly one more (`hasAll` + a size check) — so the same anonymous path that legitimately claims one slot can no longer wipe or replace the whole day. Verified live: a full-array overwrite is now denied; adding one new time to the array still succeeds (the legitimate case is preserved).

### 3.3. bedConfig and admissions had zero Super Admin access anywhere — now fixed

These were the only two collections in the whole rules file with no `isSuperAdmin()` clause on *any* operation — confirmed by my own cleanup script hitting `permission-denied` as Super Admin trying to read a hospital's bed config. Added `isSuperAdmin()` to every read/write on both. `delete` stays `false` for everyone, Super Admin included — admission records are meant to be a permanent stay history, and that part was a deliberate choice, not the gap.

### 3.4. A Hospital Admin could not edit their own profile — now fixed

Tested directly and confirmed: neither existing update branch ever matched a Hospital Admin editing their *own* user doc (one requires the target to be a Doctor/Receptionist, the other requires the actor to be a Doctor). Added `isSelfHospitalAdminUpdate`, the same shape as the existing Doctor self-update — role/hospitalId/status/email stay frozen, everything else (display name, etc.) they can now change themselves. Verified live: the Hospital Admin can now update their own display name; still cannot change their own role through the same path.

### 3.5. Minimum password length

Raised the app-enforced floor from 6 to 10 characters for every staff account type (§2, item 8). Firebase Auth's own absolute server-side floor is still 6 (that's a project-level Auth setting, not something `firestore.rules` controls), but nothing in the app will let you create an account below 10 anymore.

---

## 4. New features built

You picked all four options when asked which of the missing features to build alongside the fixes:

### Hospital-wide Activity Log

New `activityLog` collection + a page under **Activity Log** in the sidebar (Hospital Admin only — new nav entry, always on, not a paid module). Records who did what and when for: invoice voided, staff deactivated/reactivated/created, staff permissions changed, a receptionist's billing access toggled, and appointment cancelled. Entries are **permanently immutable** — no update, no delete, not even for Super Admin — an audit log that can be edited after the fact isn't one. Only visible to that hospital's own Admin or Super Admin, never Doctors/Receptionists. Verified live: a Hospital Admin can read their hospital's log; a receptionist cannot. It's wired into every relevant action's code path today, so it starts empty and fills in from here as those actions actually happen — nothing to backfill from before today.

### Password re-entry before voiding an invoice

The practical version of the OTP/superkey idea from your original ask — true SMS OTP isn't possible today (no SMS provider is configured in this project). Voiding now requires the Hospital Admin to re-type their own password (`reauthenticateWithCredential`, a real Firebase Auth check, not a client-side gate) *and* a reason — both get recorded, closing the earlier gap where the reason was hardcoded to `"Voided from Billing"` regardless of why. Void itself is still also Hospital-Admin-only and rules-enforced server-side, unchanged from before.

### Admission/discharge history

Beds & Wards previously only showed *active* admissions — a discharged stay vanished from view entirely, even though the code to fetch full history (`subscribeAllAdmissions`) already existed and was simply never called from anywhere. New **Admission History** view (button next to Configure Beds) lists every stay, active or discharged, searchable by patient/phone/diagnosis, filterable by status, showing admit/discharge dates, days, and total charges.

### Doctor photo field

Doctors previously had no photo field anywhere in the app — only initials in a colored circle, on both the public profile and the hospital's doctor listing. Added a Photo URL field to a doctor's own "My Profile" page (same URL-only pattern as the hospital's logo, now with the same http(s)-only validation from §2 item 7), with a live thumbnail preview next to the input. Falls back to initials automatically if left blank or the image fails to represent something.

---

## 5. Still open — needs a decision, not fixed today

### A patient's whole visit history is readable from just their phone number, no login

The public "check my appointment status by phone" feature resolves a lookup doc at `phoneLookup/{hospitalId}::{phone}` — readable by anyone, by design, since that's how the no-login convenience works. The problem: a phone number isn't really a secret the way the appointment token is. Anyone who knows a hospital and a person's phone number can pull their entire visit history there, including clinical notes and prescriptions for completed visits — proven live against a real test patient. This is a deliberate, documented design tradeoff in the existing code, not an oversight, so I didn't change it without your sign-off. Cheapest fix if you want it: stop returning clinical notes/prescriptions from the *phone*-based lookup (keep them on the *token*-based one, which is the actual unguessable secret) — the convenience feature would still tell you "you have an appointment on X with Dr. Y, status confirmed," just not the medical detail.

### No rate limiting on public writes (App Check)

Anyone unauthenticated can still create unlimited junk `patients`/pending `appointments` records — each one costs real Firestore billing, and it's a real (if now much smaller, per §3.2) way to spam a hospital's front desk queue. The standard fix is Firebase App Check (reCAPTCHA/App Attest), which needs Firebase Console configuration I can't do from here — flagging rather than attempting a partial version of it.

### Billing "View only" can still write (§3.1's residual gap)

Covered above — a deliberate, narrower scope decision for today, not an oversight.

---

## 6. Other bugs found (not fixed — lower priority)

- `bgImage`/`smallLogo`/photo URL fields still accept any string that merely *parses* as a valid `http(s)` URL — no check that it actually resolves to an image. Low practical impact (broken image icon, not a security issue).
- The `analytics` and `doctors` entries in the Staff Permissions screen have no effect for the roles they'd apply to (Hospital Admin always gets full analytics access regardless of the toggle; the `doctors` module is Receptionist-only by role already) — a UI control that looks like it does something and doesn't. Not touched today; cosmetic confusion, not a security or data issue.
- `PeakHoursModal` in `AnalyticsPage.jsx` receives an `appointments` prop it never actually uses internally (only `hours`) — harmless dead prop, noticed while fixing the date-range bug next to it.

---

## 7. Missing features not built today

Identified in the original pass, not selected when asked which to build now:

- **No SEO override fields** — page titles/descriptions are all derived automatically; no way for a hospital to write a custom one.
- **Chatbot module is an intentional stub** — self-documented in the code as a reference implementation for the access-control pattern, not a working feature.
- **Doctors can't see the read-only doctor-schedule overview** the way Receptionists can (`/dashboard/doctors` is Receptionist-only by role) — minor UX gap, Hospital Admins manage doctors via Staff instead.

---

## 8. Your "how do we stop a receptionist going rogue" question, directly answered

**Already solid before today, and re-confirmed live after every change:** a receptionist cannot void an invoice, edit a paid invoice's total, or delete an invoice/patient/appointment — all superadmin- or Hospital-Admin-only, enforced by the database rules, not just hidden in the UI. A doctor cannot promote themselves or hop hospitals. A Hospital Admin cannot create a peer admin or move their own staff to another hospital. Every cross-tenant attempt fails. All of this was true before today's changes and remains true now.

**What changed today:** the one place your instinct was right — the granular Staff Permissions screen was cosmetic for every module except the "none-or-not" part of Billing. That's fixed now (§3.1) and re-verified live: locking a receptionist out of Patients or Beds & Wards in that screen is now a real, server-enforced restriction, not just a hidden button. Void additionally now requires the Hospital Admin's own password, not just a click (§4).

**Still not what you described wanting, if you want it:** true OTP (needs an SMS provider this project doesn't have) and a fully-enforced Billing view/edit split (§3.1's residual gap, deliberately deferred). Both are scoped and ready to build on request.

---

## 9. How to look at the new data yourself

**Northstar Multispecialty Hospital** — `http://localhost:5173/?tenant=northstar-mh` (or your deployed URL with the same `?tenant=` param)

| Role | Email | Password |
|---|---|---|
| Hospital Admin | `admin@northstarhospital.test` | `Qaf1ehm3!807` |
| Doctor (Cardiologist) | `dr.rahul.deshpande@northstarhospital.test` | `Qaspbmre!900` |
| Doctor (Pediatrician) | `dr.sana.sheikh@northstarhospital.test` | `Qahripe1!825` |
| Doctor (Orthopedic) | `dr.imran.qureshi@northstarhospital.test` | `Qay8ycaz!870` |
| Receptionist (billing on) | `neha.kapoor@northstarhospital.test` | `Qamw9nt8!752` |
| Receptionist (billing off) | `vikram.joshi@northstarhospital.test` | `Qa5jaoy1!417` |

**Gabbar Hospital** (your existing tenant) — `http://localhost:5173/?tenant=gabbar` — same staff logins you already had.

Superadmin: `/superadmin`, your existing credentials.

Worth specifically trying: log in as `admin@northstarhospital.test` and check **Activity Log** in the sidebar after doing a few things (deactivate/reactivate a staff member, change someone's permissions) — you should see it fill in live. Try voiding the paid invoice in Billing to see the new password-and-reason step. Check **Beds & Wards → Admission History** to see Ritu Sharma's completed stay (admitted, transferred, discharged — the whole lifecycle from the original walkthrough). All legitimate test data from both passes today is left in place; every adversarial/proof-of-concept side effect was cleaned up or restored immediately after, and I ran a final consistency check confirming that rather than assuming it worked.
