/**
 * Storage abstraction. localStorage is always used as a backup so user data persists
 * even when Firestore has connectivity or config issues. Firestore remains primary
 * when configured; localStorage provides resilience.
 */
export const storageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const storageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
