/// <reference types="multer" />
import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { QrInfoDto, QrUploadResponseDto } from './dto/qr-info.dto'

export const QR_MAX_BYTES = 5 * 1024 * 1024

const FILE_BASE = 'qr-participate'

type ImageKind = {
  ext: 'jpg' | 'png'
  contentType: 'image/jpeg' | 'image/png'
}

const IMAGE_KINDS: Record<'jpg' | 'png', ImageKind> = {
  jpg: { ext: 'jpg', contentType: 'image/jpeg' },
  png: { ext: 'png', contentType: 'image/png' },
}

/** 通过文件头判断真实图片格式，不信任客户端 mimetype */
function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return IMAGE_KINDS.jpg
  }
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buffer.length >= pngMagic.length && pngMagic.every((byte, index) => buffer[index] === byte)) {
    return IMAGE_KINDS.png
  }
  return null
}

@Injectable()
export class QrService {
  private get uploadDir(): string {
    const configured = process.env.QR_UPLOAD_DIR?.trim()
    return configured || join(process.cwd(), 'uploads')
  }

  private filePath(ext: 'jpg' | 'png'): string {
    return join(this.uploadDir, `${FILE_BASE}.${ext}`)
  }

  /** 保存二维码：写临时文件 → 覆盖目标格式 → 删除另一种格式 */
  async save(file?: Express.Multer.File): Promise<QrUploadResponseDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传二维码图片')
    }
    if (file.size > QR_MAX_BYTES || file.buffer.length > QR_MAX_BYTES) {
      throw new PayloadTooLargeException('二维码图片不能超过 5 MB')
    }

    const kind = detectImageKind(file.buffer)
    if (!kind) {
      throw new BadRequestException('仅支持 JPEG / PNG 图片')
    }

    const dir = this.uploadDir
    await this.ensureDir()
    const finalPath = this.filePath(kind.ext)
    const tempPath = join(dir, `.${FILE_BASE}-${randomBytes(6).toString('hex')}.tmp`)

    try {
      await writeFile(tempPath, file.buffer)
      if (existsSync(finalPath)) {
        await rm(finalPath, { force: true })
      }
      await rename(tempPath, finalPath)
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined)
    }

    for (const other of Object.values(IMAGE_KINDS)) {
      if (other.ext !== kind.ext) {
        await rm(this.filePath(other.ext), { force: true }).catch(() => undefined)
      }
    }

    const info = await this.describe(kind)
    return { success: true, ...info }
  }

  /** 当前二维码元数据；没有上传时 url = null */
  async getInfo(): Promise<QrInfoDto> {
    const latest = await this.findLatest()
    if (!latest) return { url: null }
    return this.describe(latest)
  }

  /** 当前二维码文件路径；没有上传时 404 */
  async getImage(): Promise<{ filePath: string; contentType: string }> {
    const latest = await this.findLatest()
    if (!latest) {
      throw new NotFoundException('二维码尚未上传')
    }
    return {
      filePath: this.filePath(latest.ext),
      contentType: latest.contentType,
    }
  }

  private async describe(kind: ImageKind): Promise<{
    url: string
    contentType: string
    size: number
    updatedAt: string
  }> {
    const stats = await stat(this.filePath(kind.ext))
    return {
      url: `/api/settings/qr/image?v=${Math.floor(stats.mtimeMs)}`,
      contentType: kind.contentType,
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    }
  }

  private async findLatest(): Promise<ImageKind | null> {
    let latest: { kind: ImageKind; mtimeMs: number } | null = null
    for (const kind of Object.values(IMAGE_KINDS)) {
      try {
        const stats = await stat(this.filePath(kind.ext))
        if (!latest || stats.mtimeMs > latest.mtimeMs) {
          latest = { kind, mtimeMs: stats.mtimeMs }
        }
      } catch {
        // 文件不存在，继续检查另一种格式
      }
    }
    return latest?.kind ?? null
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true })
  }
}
