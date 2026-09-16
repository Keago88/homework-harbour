/**
 * Subscription service – works with your backend API (Paygate + DB).
 * In demo mode (no API URL), uses storage so Pro / paywalls can be exercised
 * on a single device. Production with Firebase and no API stays locked.
 */
import { storageGet, storageSet, canUseLocalPersistence } from '../lib/storage';

const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUBSCRIPTION_API_URL
  ? import.meta.env.VITE_SUBSCRIPTION_API_URL.replace(/\/$/, '')
  : null;

const DEMO_SUB_KEY = 'homework_companion_subscription';

export const isSubscriptionApiConfigured = () => !!API_BASE;

function demoPlans() {
  try {
    const raw = storageGet(DEMO_SUB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDemoPlans(map) {
  storageSet(DEMO_SUB_KEY, JSON.stringify(map));
}

export async function getSubscriptionStatus(userId) {
  if (!userId) return { plan: 'free' };
  if (!API_BASE) {
    if (!canUseLocalPersistence()) return { plan: 'free' };
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
    if (!canUseLocalPersistence() || !userId) {
      return { ok: false, error: 'Payment integration coming soon. Connect a payment provider to enable Pro subscriptions.' };
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
    if (!canUseLocalPersistence() || !userId) {
      return { ok: false, error: 'Payment integration not configured. Contact support to cancel.' };
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
