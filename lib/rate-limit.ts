export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  auth: { maxRequests: 10, windowMs: 15 * 60 * 1000 } as RateLimitConfig,
  pairing: { maxRequests: 5, windowMs: 5 * 60 * 1000 } as RateLimitConfig,
  hardware: { maxRequests: 60, windowMs: 60 * 1000 } as RateLimitConfig,
  general: { maxRequests: 100, windowMs: 60 * 1000 } as RateLimitConfig,
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check if a request is within rate limits.
 * Increments the counter and returns whether the request is allowed.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Create a rate limit key from request IP and a prefix.
 */
export function rateLimitKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `${prefix}:${ip}`;
}

// Periodic cleanup of expired entries (every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, 60 * 1000);
