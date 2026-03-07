/**
 * Firestore REST API fallback for Safari/WebKit where the SDK fails with "client is offline".
 * Uses standard fetch() which works reliably across browsers.
 */
import { auth } from './firebase';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function fromFirestoreValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue === true;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue?.values) return v.arrayValue.values.map(fromFirestoreValue);
  if (v.mapValue?.fields) {
    const obj = {};
    for (const [k, v2] of Object.entries(v.mapValue.fields)) obj[k] = fromFirestoreValue(v2);
    return obj;
  }
  return null;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: 'NULL_VALUE' };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, v2] of Object.entries(v)) fields[k] = toFirestoreValue(v2);
    return { mapValue: { fields } };
  }
  return { nullValue: 'NULL_VALUE' };
}

async function getToken() {
  const user = auth?.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function getUserDataRest(userId) {
  const token = await getToken();
  if (!token || !projectId) return null;
  const url = `${BASE}/user_data/${userId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(await res.text() || 'REST get failed');
    err.code = res.status === 403 ? 'permission-denied' : 'unavailable';
    throw err;
  }
  const doc = await res.json();
  if (!doc.fields) return null;
  const data = {};
  for (const [k, v] of Object.entries(doc.fields)) data[k] = fromFirestoreValue(v);
  return data;
}

export async function saveUserDataRest(userId, data) {
  const token = await getToken();
  if (!token || !projectId || !data) return;
  const url = `${BASE}/user_data/${userId}`;
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  const body = { fields };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = new Error(await res.text() || 'REST patch failed');
    err.code = res.status === 403 ? 'permission-denied' : 'unavailable';
    throw err;
  }
}

export function isRestAvailable() {
  return !!(projectId && auth?.currentUser);
}
