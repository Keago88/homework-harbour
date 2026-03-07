/**
 * Firebase initialization. Exports app, auth, db when configured.
 * Uses memory cache to avoid IndexedDB errors (private browsing, quota, etc).
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, enableNetwork } from 'firebase/firestore';

let app = null;
let auth = null;
let db = null;

try {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const firebaseConfig = apiKey && apiKey !== 'demo-api-key' ? {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  } : {};
  if (firebaseConfig?.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      console.log('[HWC] Firebase configured, project:', firebaseConfig.projectId);
    }
    try {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      });
    } catch {
      db = getFirestore(app);
    }
    enableNetwork(db).catch(() => {});
  } else if (typeof window !== 'undefined') {
    console.log('[HWC] Firebase not configured (missing VITE_FIREBASE_API_KEY or using demo-api-key)');
  }
} catch (e) {
  console.warn('[HWC] Firebase unavailable, running in demo mode:', e?.message);
}

export { app, auth, db };
