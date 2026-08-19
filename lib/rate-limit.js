'use strict';

class RateLimiter {
  constructor() { this.buckets = new Map(); }

  consume(key, limit, windowMs, now = Date.now()) {
    const previous = this.buckets.get(key) || [];
    const active = previous.filter((timestamp) => now - timestamp < windowMs);
    if (active.length >= limit) {
      const retryAfterMs = Math.max(1, windowMs - (now - active[0]));
      this.buckets.set(key, active);
      return { allowed: false, remaining: 0, retryAfterMs };
    }
    active.push(now);
    this.buckets.set(key, active);
    if (this.buckets.size > 10_000) {
      for (const [bucketKey, timestamps] of this.buckets) {
        if (!timestamps.some((timestamp) => now - timestamp < windowMs)) this.buckets.delete(bucketKey);
      }
    }
    return { allowed: true, remaining: Math.max(0, limit - active.length), retryAfterMs: 0 };
  }
}

module.exports = { RateLimiter };
