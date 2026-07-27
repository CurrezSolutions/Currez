import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Firestore rules tests talk to the local emulator over HTTP — slower
    // than pure unit tests, especially the first call in a file (rules
    // upload) and any get()/exists()-heavy rule (hospitalDailyPatientLimit).
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
