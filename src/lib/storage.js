/**
 * Storage abstraction. In production, localStorage is disabled when Firestore is configured
 * so data goes through Firebase. When Firestore is NOT configured (missing env vars),
 * we fall back to localStorage so user data persists until Firebase is set up.
 */
import { db } from './firebase';

const isProduction = import.meta.env.PROD;
const firestoreAvailable = !!db;

export const storageGet = (key) => {
  if (isProduction && firestoreAvailable) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const storageSet = (key, value) => {
  if (isProduction && firestoreAvailable) return;
  try {
    localStorage.setItem(key, value);
  } catch {}
};
