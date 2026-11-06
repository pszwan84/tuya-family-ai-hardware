import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StoragePort } from '@fah/pipeline';
import { ConfigService } from './config.service';

@Injectable()
export class StorageService implements StoragePort {
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), 'data', 'storage'));
  }

  private pathOf(key: string): string {
    const safeKey = key.replaceAll('..', '');
    return join(this.root, safeKey);
  }

  async put(key: string, data: Buffer, _contentType?: string): Promise<void> {
    const target = this.pathOf(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    void _contentType;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key));
    } catch {
      return;
    }
  }

  private sign(key: string, expiresAt: number): string {
    return createHmac('sha256', this.config.storageSecret).update(`${key}:${expiresAt}`).digest('hex');
  }

  async presign(key: string, ttlSec: number): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
    const signature = this.sign(key, expiresAt);
    return `${this.config.publicBaseUrl}/assets/content?key=${encodeURIComponent(key)}&exp=${expiresAt}&sig=${signature}`;
  }

  verifySignature(key: string, exp: number, signature: string): boolean {
    if (exp * 1000 < Date.now()) return false;
    const expected = Buffer.from(this.sign(key, exp));
    const provided = Buffer.from(signature);
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }
}