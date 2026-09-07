export interface RateLimitPolicy {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const requestCounts = new Map<string, RateLimitEntry>();

/** Applies a process-local fixed-window limit to an authenticated endpoint. */
export function checkRateLimit(
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitResult {
  const existing = requestCounts.get(key);
  const windowExpired = !existing || now - existing.windowStartedAt >= policy.windowMs;
  const entry = windowExpired
    ? { count: 0, windowStartedAt: now }
    : existing;

  if (entry.count >= policy.maxRequests) {
    const remainingMs = Math.max(0, policy.windowMs - (now - entry.windowStartedAt));
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
  }

  entry.count += 1;
  requestCounts.set(key, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clears local rate-limit state for deterministic tests. */
export function clearRateLimits(): void {
  requestCounts.clear();
}
