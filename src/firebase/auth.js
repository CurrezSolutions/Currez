import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from './config'

// Shared by both the superadmin and hospital-admin login pages — role is
// resolved afterwards by AuthContext, not by which login form was used.
export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

// Used both for a staff member's own "Forgot password?" link and for an
// admin/superadmin triggering a reset on someone else's behalf (Staff page)
// — Firebase Auth sends the email either way without requiring the target
// account to be signed in.
export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email)
}

export function signOutUser() {
  return signOut(auth)
}

// Re-proves the currently signed-in user's identity with their password —
// used as a second factor of friction before an irreversible action (see
// the password step in InvoiceDetailModal's void flow). Firebase Auth
// throws auth/wrong-password (or auth/invalid-credential on newer SDK
// versions) if it doesn't match; callers surface that as-is.
export function reauthenticate(password) {
  const credential = EmailAuthProvider.credential(auth.currentUser.email, password)
  return reauthenticateWithCredential(auth.currentUser, credential)
}

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}
