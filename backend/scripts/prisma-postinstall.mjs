// 依赖安装后兜底生成 Prisma Client。
// 背景：npm >= 11 默认拦截「依赖包」的 install/postinstall 脚本，@prisma/client 自带的
// `prisma generate` 会被跳过（node_modules/.prisma/client 只剩 stub，编译报 TS2305/TS2694，
// 运行时抛 "@prisma/client did not initialize yet"）。根项目自身的脚本不受该拦截影响，
// 所以在这里显式补跑一次，保证 npm 版本切换、安装中断后依然能自愈。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const log = (msg) => console.log(`[postinstall] ${msg}`)
const warn = (msg) => console.warn(`[postinstall][warn] ${msg}`)

const schemaPath = join(backendRoot, 'prisma', 'schema.prisma')
const lockPath = join(backendRoot, 'node_modules', '@prisma', 'engines', 'download-lock')
/** 引擎下载锁超过该时长视为上次安装被中断遗留 */
const STALE_LOCK_MS = 10 * 60 * 1000

if (!existsSync(schemaPath)) {
  warn(`未找到 ${schemaPath}，跳过 prisma generate`)
  process.exit(0)
}

let prismaCli
try {
  prismaCli = require.resolve('prisma/build/index.js')
} catch {
  warn('未安装 prisma CLI（可能使用了 --omit=dev / --production），跳过 prisma generate')
  warn('构建或播种前请执行：npm run prisma:generate')
  process.exit(0)
}

// 上次引擎下载被中断会残留 download-lock（内容为毫秒时间戳 / PID），过期则清理，避免 generate 卡住
if (existsSync(lockPath)) {
  try {
    const ageMs = Date.now() - statSync(lockPath).mtimeMs
    const content = Number(readFileSync(lockPath, 'utf8').trim())
    const lockedAgoMs = Number.isFinite(content) && content > 0 ? Date.now() - content : ageMs
    if (lockedAgoMs > STALE_LOCK_MS) {
      rmSync(lockPath, { force: true })
      warn('已清理过期的 @prisma/engines/download-lock（上次引擎下载被中断）')
    }
  } catch {
    // 清理失败不影响主流程，交给 prisma 自己处理
  }
}

log('生成 Prisma Client...')
try {
  execFileSync(process.execPath, [prismaCli, 'generate'], { cwd: backendRoot, stdio: 'inherit' })
  log('Prisma Client 生成完成')
} catch {
  console.error('[postinstall][error] prisma generate 失败，请手动执行 npx prisma generate 排查')
  process.exit(1)
}
