import { describe, it, expect, beforeEach } from 'vitest';
import { canUseLocalPersistence, storageGet, storageSet, deviceStorageGet, deviceStorageSet } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('allows local persistence in this test environment (no production Firebase)', () => {
    expect(canUseLocalPersistence()).toBe(true);
    storageSet('hwc_test_key', 'hello');
    expect(storageGet('hwc_test_key')).toBe('hello');
  });

  it('deviceStorage always writes demo keys', () => {
    deviceStorageSet('homework_companion_subscription', JSON.stringify({ 'a@x.com': 'pro' }));
    expect(deviceStorageGet('homework_companion_subscription')).toContain('a@x.com');
  });
});
