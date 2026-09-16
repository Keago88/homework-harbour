/**
 * Storage abstraction.
 *
 * Production builds with Firebase configured do not persist to localStorage —
 * data must go through Firestore. When Firebase is not configured (local demo
 * or a hosted build missing env secrets), localStorage stays available so
 * sign-in, roles, and homework still function on a single device.
 */
const firebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-api-key'
);

export const isFirebaseConfigured = () => firebaseConfigured;

export const canUseLocalPersistence = () => !import.meta.env.PROD || !firebaseConfigured;

export const storageGet = (key) => {
  if (!canUseLocalPersistence()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const storageSet = (key, value) => {
  if (!canUseLocalPersistence()) return;
  try {
    localStorage.setItem(key, value);
  } catch {}
};

/** Always-on device storage for demo-only keys (e.g. Pro unlock when Paygate is not configured). */
export const deviceStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const deviceStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
