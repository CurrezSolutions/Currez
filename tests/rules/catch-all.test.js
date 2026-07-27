import { beforeAll, afterAll, afterEach, describe, it } from 'vitest'
import { assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { createTestEnv, seedDocs, dbAs, userDoc } from './helpers.js'

// The final `match /{document=**} { allow read, write: if false; }` catch-all
// — any collection not explicitly matched above must stay fully closed, even
// to a superadmin. Guards against a typo'd collection name in a rule (e.g.
// `hospitaLimits`) silently falling through to "open" instead of "denied".
describe('firestore.rules: default-deny catch-all', () => {
  let testEnv

  beforeAll(async () => {
    testEnv = await createTestEnv('rules-catch-all')
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('denies read/write on any collection with no explicit rule, even for a superadmin', async () => {
    await seedDocs(testEnv, [['users/super-1', userDoc({ role: 'SUPERADMIN', hospitalId: null })]])
    const db = dbAs(testEnv, 'super-1', {})
    await assertFails(getDoc(doc(db, 'someUnlistedCollection/doc-1')))
    await assertFails(setDoc(doc(db, 'someUnlistedCollection/doc-1'), { anything: true }))
  })
})
