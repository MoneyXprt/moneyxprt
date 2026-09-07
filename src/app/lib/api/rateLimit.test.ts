import { afterEach, describe, expect, it } from 'vitest';
import { checkRateLimit, clearRateLimits } from './rateLimit';

describe('checkRateLimit', () => {
  afterEach(clearRateLimits);

  it('rejects requests after the limit until the window expires', () => {
    const policy = { maxRequests: 2, windowMs: 10_000 };

    expect(checkRateLimit('user:narrative', policy, 1_000).allowed).toBe(true);
    expect(checkRateLimit('user:narrative', policy, 2_000).allowed).toBe(true);
    expect(checkRateLimit('user:narrative', policy, 3_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 8,
    });
    expect(checkRateLimit('user:narrative', policy, 11_000).allowed).toBe(true);
  });

  it('keeps limits isolated by key', () => {
    const policy = { maxRequests: 1, windowMs: 10_000 };

    expect(checkRateLimit('user:a', policy, 1_000).allowed).toBe(true);
    expect(checkRateLimit('user:b', policy, 1_000).allowed).toBe(true);
  });
});
