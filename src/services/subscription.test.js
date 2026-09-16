import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSubscriptionStatus,
  initiateProCheckout,
  cancelSubscription,
  isSubscriptionApiConfigured,
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
