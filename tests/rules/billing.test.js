import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

// Covers /invoices, /invoiceCounters and /invoicePayments (module: Billing,
// src/firebase/billing.js) — feature-gated (only usable once Super Admin
// turns 'billing' on for a hospital), and the three-way invoice-update
// contract (add a charge / record a payment / void) described in
// firestore.rules' own comment above the /invoices match block.
describe('firestore.rules: billing (module: Billing)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-billing')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  async function seedBillingEnabledHospital() {
    await seedDocs(testEnv, [['hospitalFeatures/apollo', { hospitalId: 'apollo', features: { billing: true } }]])
  }

  function invoiceData(overrides = {}) {
    return {
      hospitalId: 'apollo',
      appointmentId: 'APT-TEST-0001',
      status: 'due',
      lineItems: [{ label: 'Consultation', amount: 500 }],
      subtotal: 500,
      discount: 0,
      total: 500,
      ...overrides,
    }
  }

  it('lets a Hospital Admin create a consistent invoice once Billing is enabled', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'admin-1', {})
    await assertSucceeds(setDoc(doc(db, 'invoices/APT-TEST-0001'), invoiceData()))
  })

  it('rejects an invoice whose total does not equal subtotal minus discount', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'admin-1', {})
    await assertFails(setDoc(doc(db, 'invoices/APT-TEST-0001'), invoiceData({ total: 999 })))
  })

  it('blocks invoice creation entirely if the hospital has not enabled Billing', async () => {
    await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'admin-1', {})
    await assertFails(setDoc(doc(db, 'invoices/APT-TEST-0001'), invoiceData()))
  })

  it('blocks a receptionist whose billingAccess has been turned off', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo', billingAccess: false })],
    ])
    const db = dbAs(testEnv, 'recep-1', {})
    await assertFails(setDoc(doc(db, 'invoices/APT-TEST-0001'), invoiceData()))
  })

  it('lets a receptionist with default (unset) billing access create an invoice', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'recep-1', {})
    await assertSucceeds(setDoc(doc(db, 'invoices/APT-TEST-0001'), invoiceData()))
  })

  it('rejects an invoice doc id that does not match its own appointmentId', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'admin-1', {})
    await assertFails(setDoc(doc(db, 'invoices/some-other-id'), invoiceData()))
  })

  it('lets billing staff add a charge to a due invoice (lineItems/subtotal only ever grow)', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [
      ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
      ['invoices/APT-TEST-0001', invoiceData()],
    ])
    const db = dbAs(testEnv, 'admin-1', {})
    await assertSucceeds(
      updateDoc(doc(db, 'invoices/APT-TEST-0001'), {
        lineItems: [{ label: 'Consultation', amount: 500 }, { label: 'Lab test', amount: 200 }],
        subtotal: 700,
        total: 700,
      })
    )
  })

  it('lets a partial payment stay "due" and a full payment flip to "paid", but rejects overpayment', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [
      ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
      ['invoices/APT-TEST-0001', invoiceData()],
    ])
    const db = dbAs(testEnv, 'admin-1', {})

    await assertSucceeds(updateDoc(doc(db, 'invoices/APT-TEST-0001'), { amountPaid: 200, status: 'due' }))
    await assertFails(updateDoc(doc(db, 'invoices/APT-TEST-0001'), { amountPaid: 9999, status: 'paid' }))
    await assertSucceeds(updateDoc(doc(db, 'invoices/APT-TEST-0001'), { amountPaid: 500, status: 'paid' }))
  })

  it('lets a Hospital Admin void a due invoice, but blocks a receptionist from voiding', async () => {
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [
      ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
      ['users/recep-1', userDoc({ role: 'RECEPTIONIST', hospitalId: 'apollo' })],
      ['invoices/APT-TEST-0001', invoiceData()],
    ])
    const recepDb = dbAs(testEnv, 'recep-1', {})
    await assertFails(updateDoc(doc(recepDb, 'invoices/APT-TEST-0001'), { status: 'void' }))

    const adminDb = dbAs(testEnv, 'admin-1', {})
    await assertSucceeds(updateDoc(doc(adminDb, 'invoices/APT-TEST-0001'), { status: 'void' }))
  })

  it('REGRESSION-DOCS: a get on a not-yet-created invoice id is denied, not a hard crash — this is why createInvoice never pre-checks existence', async () => {
    // Per src/firebase/billing.js's own comment on createInvoice: Firestore
    // rules can't authorize a `get` on a possibly-nonexistent doc by that
    // doc's own data (resource is null before it exists), so this is
    // expected to be denied — a "classic Firestore rules trap". createInvoice
    // deliberately never does this pre-check itself; it relies on
    // create-vs-update dispatch instead. This test exists so that if this
    // rule is ever rewritten to make it succeed instead, someone notices
    // the assumption behind that comment has changed.
    await seedBillingEnabledHospital()
    await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'admin-1', {})
    await assertFails(getDoc(doc(db, 'invoices/does-not-exist-yet')))
  })

  describe('invoiceCounters', () => {
    it('lets billing staff start a hospital\'s counter at 1 and increment by exactly 1', async () => {
      await seedBillingEnabledHospital()
      await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'admin-1', {})
      await assertSucceeds(setDoc(doc(db, 'invoiceCounters/apollo'), { count: 1 }))
      await assertSucceeds(updateDoc(doc(db, 'invoiceCounters/apollo'), { count: 2 }))
      await assertFails(updateDoc(doc(db, 'invoiceCounters/apollo'), { count: 10 }))
    })
  })

  describe('invoicePayments', () => {
    it('lets billing staff log a positive payment amount, but not a zero/negative one', async () => {
      await seedBillingEnabledHospital()
      await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
      const db = dbAs(testEnv, 'admin-1', {})
      await assertSucceeds(
        setDoc(doc(db, 'invoicePayments/pay-1'), { hospitalId: 'apollo', invoiceId: 'APT-TEST-0001', amount: 200 })
      )
      await assertFails(
        setDoc(doc(db, 'invoicePayments/pay-2'), { hospitalId: 'apollo', invoiceId: 'APT-TEST-0001', amount: 0 })
      )
    })

    it('blocks even a Hospital Admin from editing or deleting a logged payment', async () => {
      await seedBillingEnabledHospital()
      await seedDocs(testEnv, [
        ['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })],
        ['invoicePayments/pay-1', { hospitalId: 'apollo', invoiceId: 'APT-TEST-0001', amount: 200 }],
      ])
      const db = dbAs(testEnv, 'admin-1', {})
      await assertFails(updateDoc(doc(db, 'invoicePayments/pay-1'), { amount: 300 }))
    })
  })
})
