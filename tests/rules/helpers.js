// Shared setup for every firestore.rules test file. Each file gets its own
// `projectId` (pass a unique one per file) so Vitest can run test files in
// parallel without one file's testEnv.clearFirestore() wiping out another
// file's in-flight data — they're isolated "databases" within the same
// emulator process, which is what `npm test` (via `firebase emulators:exec`)
// starts once for the whole run.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules')

export async function createTestEnv(projectId) {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
}

// Bypasses security rules entirely — for seeding fixture data (a hospital,
// a staff user doc, ...) that the test then exercises real rules against.
export async function seedDocs(testEnv, entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const [path, data] of entries) {
      await db.doc(path).set(data)
    }
  })
}

// Defaults `email` so `request.auth.token.email` is never literally
// undefined — some rule paths (e.g. isSuperAdminEmail's `in` check,
// combined with a get() on a not-yet-existing doc, see the /invoices "get a
// not-yet-created invoice" test) throw rather than evaluate to false when
// the claim is missing entirely. A real signed-in staff member always has
// an email claim, so this is also just realistic fixture data.
export function dbAs(testEnv, uid, claims = {}) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@test.local`, ...claims }).firestore()
}

export function dbPublic(testEnv) {
  return testEnv.unauthenticatedContext().firestore()
}

// Common fixture roles, kept in one place so every test file's seeded users
// match the shape firestore.rules actually reads (role/hospitalId/status,
// plus whatever a given rule additionally checks).
export function userDoc({ role, hospitalId = null, status = 'active', ...rest }) {
  return { role, hospitalId, status, ...rest }
}
