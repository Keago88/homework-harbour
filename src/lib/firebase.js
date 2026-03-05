/**
 * Firebase initialization. Exports app, auth, db when configured.
 * Uses memory cache to avoid IndexedDB errors (private browsing, quota, etc).
 * Cloud sync works when online; no offline persistence.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
    db = getFirestore(app);
  }
} catch (e) {
  console.warn('Firebase unavailable, running in demo mode');
}

export { app, auth, db };
