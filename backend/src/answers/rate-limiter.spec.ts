import { FixedWindowLimiter } from './rate-limiter'

describe('FixedWindowLimiter', () => {
  it('allows up to the limit then blocks', () => {
    const limiter = new FixedWindowLimiter(2, 60000)
    expect(limiter.tryConsume('a').ok).toBe(true)
    expect(limiter.tryConsume('a').ok).toBe(true)

    const blocked = limiter.tryConsume('a')
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets the window after ttl elapses', () => {
    const limiter = new FixedWindowLimiter(1, 50)
    expect(limiter.tryConsume('a').ok).toBe(true)
    expect(limiter.tryConsume('a').ok).toBe(false)
    expect(limiter.tryConsume('a', Date.now() + 60).ok).toBe(true)
  })

  it('tracks different keys independently', () => {
    const limiter = new FixedWindowLimiter(1, 60000)
    expect(limiter.tryConsume('a').ok).toBe(true)
    expect(limiter.tryConsume('b').ok).toBe(true)
    expect(limiter.tryConsume('a').ok).toBe(false)
  })
})