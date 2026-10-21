export default () => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  screenToken: process.env.SCREEN_TOKEN ?? '',
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  throttle: {
    global: {
      limit: Number(process.env.GLOBAL_RATE_LIMIT ?? 120),
      ttlMs: Number(process.env.GLOBAL_RATE_TTL_MS ?? 60000),
    },
    answer: {
      limit: Number(process.env.ANSWER_RATE_LIMIT ?? 20),
      ttlMs: Number(process.env.ANSWER_RATE_TTL_MS ?? 60000),
    },
  },
  answerCooldownMs: Number(process.env.ANSWER_COOLDOWN_MS ?? 30000),
})