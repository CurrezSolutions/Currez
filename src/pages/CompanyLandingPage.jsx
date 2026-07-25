import { useState } from "react";
import Reveal from "../components/common/Reveal";
import ThemeToggle from "../components/common/ThemeToggle";
import TokenChit from "../components/company/TokenChit";
import LeadCaptureModal from "../components/company/LeadCaptureModal";
import { useSeoMeta } from "../hooks/useSeoMeta";

const SEO_DESCRIPTION =
  "Currez gives every hospital its own branded booking site, patient self-service booking, and role-based dashboards for admins, doctors and receptionists — live in minutes.";

const LEAD_MODALS = {
  demo: {
    title: "Book a demo",
    subtitle: "See Currez running for a hospital like yours — pick a time and we'll set it up.",
    intent: "Book a Demo",
  },
  onboard: {
    title: "Get your hospital onboarded",
    subtitle: "Tell us a bit about your hospital and we'll get your branded booking site live.",
    intent: "Get Your Hospital Onboarded",
  },
  sales: {
    title: "Talk to sales",
    subtitle: "Hospital groups & chains — let's figure out a plan that fits. We'll reach out shortly.",
    intent: "Talk to Sales — Custom Plan",
  },
  contact: {
    title: "Get in touch",
    subtitle: "Questions, feedback, anything at all — leave your details and we'll get back to you soon.",
    intent: "General Contact",
  },
}

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#dashboard", label: "Dashboard" },
  { href: "#demo", label: "Watch Demo" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

const STATS = [
  { label: "Hospitals Onboarded", value: "120+" },
  { label: "Doctors Connected", value: "3,400+" },
  { label: "Appointments Booked Daily", value: "18,000+" },
  { label: "Support & Monitoring", value: "24/7" },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Branded hospital sites",
    body: "Each hospital gets its own subdomain with its logo, services, doctors and testimonials — live in minutes.",
  },
  {
    n: "02",
    title: "Patient self-booking",
    body: "Patients book directly from the hospital’s page, no login required, and get an instant token to track their visit.",
  },
  {
    n: "03",
    title: "Front-desk confirmation",
    body: "Reception confirms each booking on arrival and records how the visit fee was paid — cash or the hospital's own QR.",
  },
  {
    n: "04",
    title: "Role-based dashboards",
    body: "Hospital admins, doctors and receptionists each get a focused dashboard scoped to exactly what they need.",
  },
];

// 3-Tier Subscription Plans for Hospitals & Clinics in Maharashtra
const PRICING_TIERS = [
  {
    name: "Essential (Clinic)",
    price: "₹1,499",
    originalPrice: "₹1,999",
    period: "/mo",
    badge: "25% OFF",
    tagline: "For standalone OPD clinics, specialist doctors & polyclinics.",
    features: [
      "Up to 3 Doctors & 2 Staff Seats",
      "Avg 60 Patients/day (1,800/mo cap)",
      "OPD Queue & Real-Time Token Tracker",
      "E-Prescription Builder & PDF Printouts",
      "Branded Booking Page & Doctor Profile",
      "500 Free Email Notifications / mo",
      "Extra Module Add-On @ ₹599/mo",
    ],
    cta: "Start Essential",
    highlighted: false,
  },
  {
    name: "Growth (Nursing Home)",
    price: "₹4,499",
    originalPrice: "₹5,999",
    period: "/mo",
    badge: "Most Popular — 25% OFF",
    tagline: "For 10–50 Bed nursing homes & specialty hospitals.",
    features: [
      "Up to 12 Doctors, 8 Staff & 3 Admins",
      "Up to 50 IPD Beds & Ward Allocation",
      "Avg 200 Patients/day (6,000/mo cap)",
      "Itemized Billing & Invoicing",
      "Lab & Diagnostics Reports Upload",
      "Operational & Financial Analytics",
      "2,500 Free Email Notifications / mo",
      "Extra Module Add-On @ ₹599/mo",
    ],
    cta: "Choose Growth",
    highlighted: true,
  },
  {
    name: "Enterprise (Multispecialty)",
    price: "₹11,199",
    originalPrice: "₹14,999",
    period: "/mo",
    badge: "25% OFF",
    tagline: "For 50+ Bed tertiary hospitals & hospital chains.",
    features: [
      "UNLIMITED Doctors, Staff & Admins",
      "UNLIMITED IPD Beds & Wards",
      "UNLIMITED Daily Patients & Records",
      "ALL Modules Included (Beds, Billing, Labs)",
      "Custom Subdomain / Hospital Domain",
      "10,000 Free Email Notifications / mo",
      "Dedicated Success Manager & 24/7 Support",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

// Centers section content and keeps generous side margins on wide screens —
// the full-bleed colored bands (stats/CTA) stay on the outer <section>.
const CONTAINER = "mx-auto max-w-7xl px-6 sm:px-10 lg:px-16 xl:px-24";

function CompanyLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  useSeoMeta({
    title: "Currez — Hospital Appointment & Practice Management Platform",
    description: SEO_DESCRIPTION,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Currez",
      url: "https://www.currez.in",
      logo: "https://www.currez.in/currez-mark.png",
      description: SEO_DESCRIPTION,
    },
  });

  return (
    <div className="min-h-screen bg-page font-plex text-heading">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-page/85 backdrop-blur">
        <div className={`flex items-center justify-between py-4 ${CONTAINER}`}>
          <span className="flex items-center gap-2.5">
            <img src="/currez-mark.png" alt="Currez" className="h-8 w-8 rounded-md object-contain" />
            <span className="font-plex-mono text-base font-semibold tracking-[0.08em] text-heading">
              CURREZ
            </span>
          </span>

          <nav className="hidden items-center gap-8 text-xs md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-medium uppercase tracking-wide text-body transition-colors hover:text-heading"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://www.instagram.com/currez.in/"
              target="_blank"
              rel="noopener noreferrer"
              title="Follow us on Instagram"
              className="hidden p-1.5 rounded-lg text-body hover:text-pink-500 transition-colors sm:block"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a
              href="https://www.youtube.com/@CurrezHms"
              target="_blank"
              rel="noopener noreferrer"
              title="Subscribe on YouTube"
              className="hidden p-1.5 rounded-lg text-body hover:text-red-500 transition-colors sm:block"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <ThemeToggle />
            <button
              onClick={() => setActiveModal("demo")}
              className="hidden cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 sm:inline-block"
            >
              Book a demo
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              className="cursor-pointer rounded-lg p-2 text-body transition-colors hover:bg-card-strong md:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                {menuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="animate-fade-in-up border-t border-line px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-4 text-sm text-body">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="hover:text-heading"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => { setMenuOpen(false); setActiveModal("demo"); }}
                className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-center font-semibold text-ink"
              >
                Book a demo
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className={`grid gap-14 pb-20 pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pb-28 md:pt-24 ${CONTAINER}`}>
        <div>
          <p className="animate-fade-in-up font-plex-mono text-xs uppercase tracking-[0.25em] text-accent">
            Hospital operations, digitized
          </p>
          <h1
            className="mt-4 max-w-xl animate-fade-in-up font-display text-4xl font-semibold leading-[1.05] md:text-6xl"
            style={{ animationDelay: "90ms" }}
          >
            Every hospital appointment,
            <br />
            handled <span className="italic text-accent">in one place</span>.
          </h1>
          <p
            className="mt-6 max-w-md animate-fade-in-up text-base text-body md:text-lg"
            style={{ animationDelay: "180ms" }}
          >
            Currez gives each hospital its own branded booking site, patient
            self-service booking, and role-based dashboards for admins, doctors
            and receptionists — live in minutes.
          </p>
          <div
            className="mt-8 flex animate-fade-in-up flex-wrap items-center gap-6"
            style={{ animationDelay: "280ms" }}
          >
            <button
              onClick={() => setActiveModal("onboard")}
              className="cursor-pointer rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/20"
            >
              Get Your Hospital Onboarded
            </button>
            <a
              href="#features"
              className="text-sm font-medium text-body transition-colors hover:text-heading"
            >
              See features &rarr;
            </a>
          </div>
        </div>

        <Reveal delay={200}>
          <TokenChit />
        </Reveal>
      </section>

      {/* Stats / ledger band */}
      <Reveal as="section" className="bg-ink py-12">
        <div
          className={`grid grid-cols-2 divide-y divide-white/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0 ${CONTAINER}`}
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="px-2 py-5 text-center sm:py-0">
              <p className="font-plex-mono text-2xl font-semibold text-accent-glow md:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-[11px] uppercase tracking-wide text-white/60 md:text-xs">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* How it works */}
      <section id="features" className={`py-24 ${CONTAINER}`}>
        <Reveal>
          <p className="font-plex-mono text-xs uppercase tracking-[0.25em] text-accent">
            How Currez works
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
            Booking to confirmation, in four steps.
          </h2>
        </Reveal>
        <div className="mt-10 divide-y divide-line border-t border-line">
          {HOW_IT_WORKS.map((step, i) => (
            <Reveal
              key={step.n}
              delay={i * 80}
              className="grid grid-cols-[3.5rem_1fr] items-start gap-4 py-7 sm:grid-cols-[5rem_1fr] sm:gap-6"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-md border border-paper-line bg-paper font-plex-mono text-xs font-semibold text-ink ${
                  i % 2 === 0 ? "-rotate-2" : "rotate-2"
                }`}
              >
                {step.n}
              </span>
              <div>
                <h3 className="font-semibold text-heading">{step.title}</h3>
                <p className="mt-1.5 max-w-xl text-sm text-body">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Command center / dashboard preview */}
      <section id="dashboard" className={`py-24 ${CONTAINER}`}>
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <p className="font-plex-mono text-xs uppercase tracking-[0.25em] text-accent">
              Command center
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold">
              Every department, one dashboard.
            </h2>
            <p className="mt-4 max-w-md text-body">
              Hospital admins see appointments, patients and staff at a glance.
              Doctors see only their own schedule and confirmed visits.
              Receptionists book, confirm and search — nothing more, nothing
              less.
            </p>
          </Reveal>

          <Reveal
            delay={120}
            className="rounded-2xl border border-line bg-card p-6"
          >
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Today's Appointments", value: "24" },
                { label: "Doctors", value: "9" },
                { label: "Patients", value: "312" },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-xl border border-line bg-page p-3 transition-colors hover:border-line-strong"
                >
                  <p className="font-plex-mono text-lg font-bold text-heading">{tile.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-faint">{tile.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[
                {
                  name: "Priya Sharma",
                  meta: "Dr. Mehta · 10:30 AM",
                  status: "Confirmed",
                },
                {
                  name: "Arjun Nair",
                  meta: "Dr. Iyer · 11:00 AM",
                  status: "Pending",
                },
                {
                  name: "Kavya Reddy",
                  meta: "Dr. Mehta · 11:15 AM",
                  status: "Confirmed",
                },
              ].map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-line-strong"
                >
                  <div>
                    <p className="text-heading">{row.name}</p>
                    <p className="font-plex-mono text-xs text-faint">{row.meta}</p>
                  </div>
                  <span
                    className={`rounded-sm px-2 py-0.5 font-plex-mono text-[10px] font-semibold uppercase tracking-wide ${
                      row.status === "Confirmed"
                        ? "bg-stamp-soft text-stamp"
                        : "bg-rust-soft text-rust"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Demo Video Section */}
      <section id="demo" className={`py-24 ${CONTAINER}`}>
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-plex-mono text-xs uppercase tracking-[0.25em] text-accent">
              Product Walkthrough Video
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
              Watch Currez in Action
            </h2>
            <p className="mt-4 text-sm text-body sm:text-base">
              See how our multi-tenant hospital operating system streamlines OPD appointment queues, doctor schedule availability, and front-desk patient intake.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-10">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-accent/10">
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full rounded-2xl"
                src="https://www.youtube.com/embed/4Y2aYwdqTPY?si=khES7NvGQMl6J5HN"
                title="Currez Hospital Management System Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-surface px-6 py-4 text-xs">
              <a
                href="https://www.youtube.com/@CurrezHms"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-semibold text-accent hover:underline"
              >
                <svg className="h-4 w-4 fill-current text-red-500" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Subscribe on YouTube (@CurrezHms) &rarr;
              </a>
              <a
                href="https://www.instagram.com/currez.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-semibold text-body hover:text-pink-500 transition-colors"
              >
                <svg className="h-4 w-4 fill-current text-pink-500" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Follow @currez.in &rarr;
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Pricing */}
      <section id="pricing" className={`py-24 ${CONTAINER}`}>
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-plex-mono text-xs uppercase tracking-[0.25em] text-accent">
                Pricing & Subscription Plans
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
                Simple, transparent plans for every hospital size
              </h2>
            </div>
            <div className="rounded-full bg-accent/10 px-4 py-1.5 font-plex-mono text-xs font-semibold text-accent border border-accent/20">
              🔥 Special Launch Offer: 25% OFF
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier, i) => (
            <Reveal
              key={tier.name}
              delay={i * 100}
              className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 ${
                tier.highlighted
                  ? "border-accent bg-surface text-heading shadow-xl shadow-accent/10 ring-1 ring-accent/40 hover:-translate-y-1"
                  : "border-line bg-surface text-heading hover:-translate-y-1 hover:border-accent/40"
              }`}
            >
              <div>
                {tier.badge && (
                  <span
                    className={`absolute -top-3 right-6 rounded-md px-2.5 py-1 font-plex-mono text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm ${
                      tier.highlighted ? "bg-accent" : "bg-stamp"
                    }`}
                  >
                    {tier.badge}
                  </span>
                )}
                <p className="font-plex-mono text-xs font-semibold uppercase tracking-wide text-accent">
                  {tier.name}
                </p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold sm:text-4xl text-heading">
                    {tier.price}
                  </span>
                  <span className="font-plex text-sm text-body">
                    {tier.period}
                  </span>
                  {tier.originalPrice && (
                    <span className="font-plex text-sm text-muted line-through">
                      {tier.originalPrice}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-body">{tier.tagline}</p>
                <div className="my-5 h-px bg-line" />
                <ul className="space-y-2.5 text-sm text-body">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-accent font-bold">&#10003;</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setActiveModal("sales")}
                className={`mt-8 block w-full cursor-pointer rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                  tier.highlighted
                    ? "bg-accent text-ink hover:opacity-90 hover:-translate-y-0.5 shadow-md"
                    : "border border-line-strong bg-card-strong text-heading hover:bg-card hover:border-accent hover:-translate-y-0.5"
                }`}
              >
                {tier.cta}
              </button>
            </Reveal>
          ))}
        </div>

        {/* Add-on Banner */}
        <Reveal delay={300} className="mt-8">
          <div className="rounded-xl border border-accent/30 bg-card-strong p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-sm">
            <div>
              <p className="font-semibold text-sm text-heading">
                💡 Need Modular Customization?
              </p>
              <p className="text-xs text-body mt-0.5">
                Add Bed Management, Itemized Billing, E-Prescriptions or Lab Reports to any plan for flat <span className="font-semibold text-accent">₹599 / month</span> per module.
              </p>
            </div>
            <button
              onClick={() => setActiveModal("sales")}
              className="shrink-0 rounded-lg border border-accent/60 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent hover:text-ink transition-all duration-200 cursor-pointer"
            >
              Explore Add-Ons
            </button>
          </div>
        </Reveal>
      </section>

      {/* Testimonial */}
      <Reveal as="section" className="border-t border-line py-24">
        <div className={`${CONTAINER} flex justify-center`}>
          <div className="relative max-w-2xl -rotate-1 rounded-2xl border border-paper-line bg-paper px-8 py-10 text-center text-ink shadow-xl shadow-black/10 sm:px-12">
            <span className="absolute -top-7 left-8 font-display text-7xl text-accent/60" aria-hidden="true">
              &ldquo;
            </span>
            <p className="font-display text-xl font-medium leading-snug md:text-2xl">
              Patients book themselves and reception just confirms and goes —
              our front desk workload dropped almost overnight.
            </p>
            <p className="mt-5 font-plex-mono text-xs uppercase tracking-wide text-ink/50">
              — Hospital Operations Team, Currez partner hospital
            </p>
          </div>
        </div>
      </Reveal>

      {/* Final CTA */}
      <Reveal
        as="section"
        id="contact"
        className="bg-ink py-24 text-center text-white"
      >
        <div className={CONTAINER}>
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            Ready to move your hospital onto Currez?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-white/70">
            Reach out and we'll get your hospital's branded booking site live in
            minutes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-white/80 font-plex">
            <span>📧 <a href="mailto:support@currez.in" className="hover:text-accent-glow underline">support@currez.in</a></span>
            <span>📧 <a href="mailto:medideskpro@gmail.com" className="hover:text-accent-glow underline">medideskpro@gmail.com</a></span>
            <span>📞 <a href="tel:+919284378620" className="hover:text-accent-glow">+91 9284378620</a> / <a href="tel:+918806676181" className="hover:text-accent-glow">+91 8806676181</a></span>
          </div>
          <button
            onClick={() => setActiveModal("onboard")}
            className="mt-8 inline-block cursor-pointer rounded-lg bg-accent-glow px-6 py-3 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-glow/30"
          >
            Get Your Hospital Onboarded
          </button>
        </div>
      </Reveal>

      {/* Contact us — persistent, reachable from anywhere on the page */}
      <button
        onClick={() => setActiveModal("contact")}
        className="fixed bottom-6 right-6 z-40 flex cursor-pointer items-center gap-2.5 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5"
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-glow opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-glow" />
        </span>
        Contact Us
      </button>

      {activeModal && (
        <LeadCaptureModal
          title={LEAD_MODALS[activeModal].title}
          subtitle={LEAD_MODALS[activeModal].subtitle}
          intent={LEAD_MODALS[activeModal].intent}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Footer */}
      <footer
        className={`flex flex-col items-center justify-between gap-4 border-t border-line py-8 font-plex-mono text-[11px] text-faint sm:flex-row ${CONTAINER}`}
      >
        <div>
          <p>© {new Date().getFullYear()} Currez Technologies. All rights reserved.</p>
          <p className="mt-1 text-muted">
            Support: <a href="mailto:support@currez.in" className="hover:text-heading underline">support@currez.in</a> | Sales: <a href="mailto:medideskpro@gmail.com" className="hover:text-heading underline">medideskpro@gmail.com</a>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 uppercase tracking-wide">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-body"
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default CompanyLandingPage;
