import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

export default async function globalSetup(): Promise<void> {
  const env = { ...process.env, DATABASE_URL: 'file:./test.db' }

  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    rmSync(join(process.cwd(), 'prisma', `test.db${suffix}`), { force: true })
  }

  execSync('npx prisma db push --skip-generate --force-reset --accept-data-loss', {
    env,
    stdio: 'inherit',
  })
  execSync('npx tsx prisma/seed.ts', {
    env,
    stdio: 'inherit',
  })
}