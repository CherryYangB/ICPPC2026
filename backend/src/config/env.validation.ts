export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const port = Number(config.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${String(config.PORT)}`)
  }

  const cooldown = Number(config.ANSWER_COOLDOWN_MS ?? 30000)
  if (!Number.isInteger(cooldown) || cooldown < 0) {
    throw new Error(`Invalid ANSWER_COOLDOWN_MS value: ${String(config.ANSWER_COOLDOWN_MS)}`)
  }

  const checkinCooldown = Number(config.CHECKIN_COOLDOWN_MS ?? 10000)
  if (!Number.isInteger(checkinCooldown) || checkinCooldown < 0) {
    throw new Error(`Invalid CHECKIN_COOLDOWN_MS value: ${String(config.CHECKIN_COOLDOWN_MS)}`)
  }

  const onlineWindowMinutes = Number(config.ONLINE_WINDOW_MINUTES ?? 10)
  if (!Number.isInteger(onlineWindowMinutes) || onlineWindowMinutes <= 0) {
    throw new Error(`Invalid ONLINE_WINDOW_MINUTES value: ${String(config.ONLINE_WINDOW_MINUTES)}`)
  }

  const jwtSecret = typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET.trim() : ''
  if (jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET 缺失或长度不足 32 位。请在 backend/.env 配置 JWT_SECRET（建议使用 openssl rand -hex 32 生成）。',
    )
  }

  return config
}