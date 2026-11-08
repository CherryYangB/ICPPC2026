// Runs in the Jest worker process before test modules are imported.
import { join } from 'node:path'

process.env.DATABASE_URL = 'file:./test.db'
process.env.NODE_ENV = 'test'
process.env.CORS_ORIGINS = 'http://localhost:5173'
process.env.SWAGGER_ENABLED = 'false'
process.env.ANSWER_COOLDOWN_MS = '1000'
process.env.ANSWER_RATE_LIMIT = '100'
process.env.ANSWER_RATE_TTL_MS = '60000'
process.env.GLOBAL_RATE_LIMIT = '1000'
process.env.GLOBAL_RATE_TTL_MS = '60000'
process.env.CHECKIN_COOLDOWN_MS = '60000'
// 认证：固定测试密钥；登录限流放大，避免多个用例互相触发 429
process.env.JWT_SECRET = 'icppc2026-e2e-jwt-secret-at-least-32-characters'
process.env.JWT_EXPIRES_IN = '1h'
process.env.LOGIN_RATE_LIMIT = '1000'
process.env.LOGIN_RATE_TTL_MS = '60000'
// 二维码上传测试使用独立目录，避免覆盖本地真实二维码
process.env.QR_UPLOAD_DIR = join(process.cwd(), 'uploads-test')
