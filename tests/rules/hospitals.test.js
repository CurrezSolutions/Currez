import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, dbPublic, userDoc } from './helpers.js'

describe('firestore.rules: hospitals (module: platform / tenants)', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-hospitals')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('lets an unauthenticated visitor read a hospital doc (public tenant landing page)', async () => {
    await seedDocs(testEnv, [['hospitals/apollo', { title: 'Apollo', status: 'active' }]])
    const db = dbPublic(testEnv)
    await assertSucceeds(getDoc(doc(db, 'hospitals/apollo')))
  })

  it('blocks a non-superadmin authenticated user from creating a hospital', async () => {
    await seedDocs(testEnv, [['users/doctor-1', userDoc({ role: 'DOCTOR', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'doctor-1', { email: 'doc@apollo.com' })
    await assertFails(setDoc(doc(db, 'hospitals/newone'), { title: 'New One', status: 'trial' }))
  })

  it('blocks a hospital admin from creating a hospital (superadmin-only)', async () => {
    await seedDocs(testEnv, [['users/admin-1', userDoc({ role: 'HOSPITAL_ADMIN', hospitalId: 'apollo' })]])
    const db = dbAs(testEnv, 'admin-1', { email: 'admin@apollo.com' })
    await assertFails(setDoc(doc(db, 'hospitals/newone'), { title: 'New One', status: 'trial' }))
  })

  it('lets a superadmin (via Firestore role doc) create, update and delete a hospital', async () => {
    await seedDocs(testEnv, [['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })]])
    const db = dbAs(testEnv, 'super-1', { email: 'super@currez.in' })

    await assertSucceeds(setDoc(doc(db, 'hospitals/newone'), { title: 'New One', status: 'trial' }))
    await assertSucceeds(updateDoc(doc(db, 'hospitals/newone'), { status: 'active' }))
    await assertSucceeds(deleteDoc(doc(db, 'hospitals/newone')))
  })
})
