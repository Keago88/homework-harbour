/**
 * Subscription service – works with your backend API (Paygate + DB).
 * When Paygate is not configured, Pro is stored on-device in
 * `homework_companion_subscription` so Chat / analytics can be demoed
 * without a payment redirect — including hosted builds that have Firebase.
 */
import { deviceStorageGet, deviceStorageSet } from '../lib/storage';

const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUBSCRIPTION_API_URL
  ? import.meta.env.VITE_SUBSCRIPTION_API_URL.replace(/\/$/, '')
  : null;

const DEMO_SUB_KEY = 'homework_companion_subscription';
export const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isSubscriptionApiConfigured = () => !!API_BASE;

export function parseTrialInstant(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function startTrialWindow(now = new Date()) {
  const started = new Date(now);
  const ends = new Date(started.getTime() + TRIAL_DAYS * DAY_MS);
  return {
    trialStartedAt: started.toISOString(),
    trialEndsAt: ends.toISOString(),
  };
}

/** First Firebase user_data write starts a 14-day trial. Legacy docs are not backfilled. */
export function nextAccountTrialFields(existing, now = new Date()) {
  const started = parseTrialInstant(existing?.trialStartedAt);
  const ends = parseTrialInstant(existing?.trialEndsAt);
  if (started && ends) return { trialStartedAt: started, trialEndsAt: ends };
  const hasDoc = existing && Object.keys(existing).length > 0;
  if (hasDoc) return {};
  return startTrialWindow(now);
}

export function isTrialActive(trialEndsAt, now = new Date()) {
  const ends = parseTrialInstant(trialEndsAt);
  if (!ends) return false;
  return new Date(now).getTime() < new Date(ends).getTime();
}

export function trialDaysLeft(trialEndsAt, now = new Date()) {
  if (!isTrialActive(trialEndsAt, now)) return 0;
  const ms = new Date(parseTrialInstant(trialEndsAt)).getTime() - new Date(now).getTime();
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

export function trialBannerCopy(trialEndsAt, now = new Date()) {
  const days = trialDaysLeft(trialEndsAt, now);
  if (days <= 0) return null;
  return `Pro trial — ${days} day${days === 1 ? '' : 's'} left`;
}

/** Full Pro (Chat, analytics, extras) — not Chat-only. Demo unlock is a separate plan === 'pro' path. */
export function hasFullProAccess({ plan, trialEndsAt, now = new Date() } = {}) {
  if (plan === 'pro') return true;
  return isTrialActive(trialEndsAt, now);
}

function demoPlans() {
  try {
    const raw = deviceStorageGet(DEMO_SUB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDemoPlans(map) {
  deviceStorageSet(DEMO_SUB_KEY, JSON.stringify(map));
}

export async function getSubscriptionStatus(userId) {
  if (!userId) return { plan: 'free' };
  if (!API_BASE) {
    const store = demoPlans();
    return { plan: store[userId] === 'pro' ? 'pro' : 'free' };
  }
  try {
    const res = await fetch(`${API_BASE}/subscription/status?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('Failed to fetch status');
    const data = await res.json();
    return { plan: data.plan || 'free' };
  } catch (err) {
    console.warn('Subscription status fetch failed:', err);
    return { plan: 'free' };
  }
}

export async function initiateProCheckout(userId, email) {
  if (!API_BASE) {
    if (!userId) {
      return { ok: false, error: 'Sign in to activate Pro on this device.' };
    }
    const store = demoPlans();
    store[userId] = 'pro';
    saveDemoPlans(store);
    return { ok: true, demo: true, email: email || null };
  }
  try {
    const res = await fetch(`${API_BASE}/subscription/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, plan: 'pro' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkout failed');
    return data;
  } catch (err) {
    console.error('Checkout failed:', err);
    return { ok: false, error: err.message };
  }
}

export async function verifyPayment(transactionId, userId) {
  if (!API_BASE) return { ok: false };
  try {
    const res = await fetch(`${API_BASE}/subscription/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    return data;
  } catch (err) {
    console.error('Verify failed:', err);
    return { ok: false, error: err.message };
  }
}

export async function cancelSubscription(userId) {
  if (!API_BASE) {
    if (!userId) {
      return { ok: false, error: 'Sign in to cancel Pro on this device.' };
    }
    const store = demoPlans();
    store[userId] = 'free';
    saveDemoPlans(store);
    return { ok: true, demo: true };
  }
  try {
    const res = await fetch(`${API_BASE}/subscription/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Cancellation failed');
    return { ok: true, ...data };
  } catch (err) {
    console.error('Cancel failed:', err);
    return { ok: false, error: err.message };
  }
}
