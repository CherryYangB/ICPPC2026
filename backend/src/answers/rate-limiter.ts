export interface ConsumeResult {
  ok: boolean
  retryAfterSeconds: number
}

export class FixedWindowLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly limit: number,
    private readonly ttlMs: number,
  ) {}

  tryConsume(key: string, now = Date.now()): ConsumeResult {
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.ttlMs }
      this.buckets.set(key, bucket)
    }

    if (bucket.count >= this.limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      }
    }

    bucket.count += 1
    return { ok: true, retryAfterSeconds: 0 }
  }
}