import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSubscriptionStatus,
  initiateProCheckout,
  cancelSubscription,
  isSubscriptionApiConfigured,
  startTrialWindow,
  nextAccountTrialFields,
  isTrialActive,
  trialDaysLeft,
  trialBannerCopy,
  hasFullProAccess,
  plansMembershipCopy,
  TRIAL_DAYS,
} from './subscription';

describe('subscription demo store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is not wired to a live payment API in this environment', () => {
    expect(isSubscriptionApiConfigured()).toBe(false);
  });

  it('starts free and can activate/cancel Pro locally', async () => {
    const userId = 'student@test.com';
    expect(await getSubscriptionStatus(userId)).toEqual({ plan: 'free' });

    const checkout = await initiateProCheckout(userId, userId);
    expect(checkout.ok).toBe(true);
    expect(checkout.demo).toBe(true);
    expect(await getSubscriptionStatus(userId)).toEqual({ plan: 'pro' });
    expect(JSON.parse(localStorage.getItem('homework_companion_subscription'))[userId]).toBe('pro');

    const cancel = await cancelSubscription(userId);
    expect(cancel.ok).toBe(true);
    expect(await getSubscriptionStatus(userId)).toEqual({ plan: 'free' });
  });

  it('keeps plans isolated per user id', async () => {
    await initiateProCheckout('a@x.com', 'a@x.com');
    expect(await getSubscriptionStatus('a@x.com')).toEqual({ plan: 'pro' });
    expect(await getSubscriptionStatus('b@x.com')).toEqual({ plan: 'free' });
  });
});

describe('14-day Pro trial', () => {
  const t0 = new Date('2026-09-18T08:00:00.000Z');

  it('starts a 14-day window on first account write', () => {
    const trial = nextAccountTrialFields({}, t0);
    expect(trial.trialStartedAt).toBe(t0.toISOString());
    expect(new Date(trial.trialEndsAt).getTime() - t0.getTime()).toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000);
  });

  it('does not backfill trial onto an existing user doc', () => {
    expect(nextAccountTrialFields({ email: 'old@school.edu', role: 'Student' }, t0)).toEqual({});
  });

  it('keeps an existing trial window', () => {
    const existing = startTrialWindow(t0);
    const next = nextAccountTrialFields({ email: 'a@b.com', ...existing }, new Date('2026-09-20T08:00:00.000Z'));
    expect(next).toEqual(existing);
  });

  it('unlocks full Pro while the trial is active', () => {
    const { trialEndsAt } = startTrialWindow(t0);
    expect(hasFullProAccess({ plan: 'free', trialEndsAt, now: t0 })).toBe(true);
    expect(isTrialActive(trialEndsAt, t0)).toBe(true);
    expect(trialDaysLeft(trialEndsAt, t0)).toBe(14);
    expect(trialBannerCopy(trialEndsAt, t0)).toBe('Pro trial — 14 days left');
  });

  it('expires after 14 days unless plan is pro', () => {
    const { trialEndsAt } = startTrialWindow(t0);
    const after = new Date(t0.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    expect(hasFullProAccess({ plan: 'free', trialEndsAt, now: after })).toBe(false);
    expect(trialBannerCopy(trialEndsAt, after)).toBeNull();
    expect(hasFullProAccess({ plan: 'pro', trialEndsAt, now: after })).toBe(true);
  });

  it('uses singular day copy near the end of the trial', () => {
    const { trialEndsAt } = startTrialWindow(t0);
    const almost = new Date(new Date(trialEndsAt).getTime() - 3 * 60 * 60 * 1000);
    expect(trialBannerCopy(trialEndsAt, almost)).toBe('Pro trial — 1 day left');
  });

  it('Plans copy: trial-active is not generic Pro ACTIVE', () => {
    const { trialEndsAt } = startTrialWindow(t0);
    expect(plansMembershipCopy({ plan: 'free', trialEndsAt, now: t0 })).toEqual({
      kind: 'trial',
      title: 'Pro trial — 14 days left',
      subtitle: 'Full Pro is on — Chat, analytics, and extras.',
      badge: null,
    });
  });

  it('Plans copy: paid-pro is Pro Access ACTIVE', () => {
    const { trialEndsAt } = startTrialWindow(t0);
    expect(plansMembershipCopy({ plan: 'pro', trialEndsAt, now: t0 })).toEqual({
      kind: 'pro',
      title: 'Pro Access',
      subtitle: 'Unlimited features active',
      badge: 'Active',
    });
  });

  it('Plans copy: expired trial is Free + upgrade', () => {
    const { trialEndsAt } = startTrialWindow(t0);
    const after = new Date(t0.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    expect(plansMembershipCopy({ plan: 'free', trialEndsAt, now: after })).toEqual({
      kind: 'expired',
      title: 'Free',
      subtitle: 'Your 14-day Pro trial ended. Upgrade to keep Chat and extras.',
      badge: null,
    });
  });

  it('demo unlock still grants Pro on-device when Paygate is unset', async () => {
    const userId = 'trial-then-demo@school.edu';
    expect(hasFullProAccess({ plan: 'free', trialEndsAt: null })).toBe(false);
    const checkout = await initiateProCheckout(userId, userId);
    expect(checkout.demo).toBe(true);
    const { plan } = await getSubscriptionStatus(userId);
    expect(hasFullProAccess({ plan, trialEndsAt: null })).toBe(true);
  });
});
