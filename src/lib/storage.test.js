import { describe, it, expect, beforeEach } from 'vitest';
import { canUseLocalPersistence, storageGet, storageSet } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('allows local persistence in this test environment (no production Firebase)', () => {
    expect(canUseLocalPersistence()).toBe(true);
    storageSet('hwc_test_key', 'hello');
    expect(storageGet('hwc_test_key')).toBe('hello');
  });
});
