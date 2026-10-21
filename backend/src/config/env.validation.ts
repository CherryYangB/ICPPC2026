export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const port = Number(config.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${String(config.PORT)}`)
  }

  const cooldown = Number(config.ANSWER_COOLDOWN_MS ?? 30000)
  if (!Number.isInteger(cooldown) || cooldown < 0) {
    throw new Error(`Invalid ANSWER_COOLDOWN_MS value: ${String(config.ANSWER_COOLDOWN_MS)}`)
  }

  return config
}