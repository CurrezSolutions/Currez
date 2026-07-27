import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './config'
import { LIMITS_REGISTRY } from '../config/limitsRegistry'

// Doc ID == hospitalId, same shape/convention as hospitalFeatures.js.
export const HOSPITAL_LIMITS_COLLECTION = 'hospitalLimits'

// Fills in every registry key with its default so callers never have to
// special-case a hospital that predates a given limit (same
// forward-compatible-defaults approach as hospitalFeatures.js/
// normalizeHospital). A stored value of `null` is preserved as-is — it means
// "Unlimited" for that key, not "unset".
export function normalizeLimits(limits = {}) {
  const defaults = Object.fromEntries(LIMITS_REGISTRY.map((limit) => [limit.key, limit.default]))
  return { ...defaults, ...limits }
}

export function subscribeToHospitalLimits(hospitalId, callback) {
  return onSnapshot(doc(db, HOSPITAL_LIMITS_COLLECTION, hospitalId), (snapshot) => {
    callback(normalizeLimits(snapshot.exists() ? snapshot.data().limits : undefined))
  })
}

export async function getHospitalLimits(hospitalId) {
  const snapshot = await getDoc(doc(db, HOSPITAL_LIMITS_COLLECTION, hospitalId))
  return normalizeLimits(snapshot.exists() ? snapshot.data().limits : undefined)
}

// `value` is a positive integer, or `null` for Unlimited.
export async function setHospitalLimit(hospitalId, limitKey, value, updatedBy) {
  const ref = doc(db, HOSPITAL_LIMITS_COLLECTION, hospitalId)
  const snapshot = await getDoc(ref)

  if (snapshot.exists()) {
    await updateDoc(ref, {
      [`limits.${limitKey}`]: value,
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy ?? null,
    })
  } else {
    await setDoc(ref, {
      hospitalId,
      limits: { [limitKey]: value },
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy ?? null,
    })
  }
}
