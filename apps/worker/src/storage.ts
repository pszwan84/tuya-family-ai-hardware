import { createHmac } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StoragePort } from '@fah/pipeline';

export class LocalStorage implements StoragePort {
  private readonly root = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), 'data', 'storage'));

  private pathOf(key: string): string {
    return join(this.root, key.replaceAll('..', ''));
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.pathOf(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
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

  async presign(key: string, ttlSec: number): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
    const signature = createHmac('sha256', process.env.STORAGE_SECRET ?? process.env.JWT_SECRET ?? 'fah-demo-secret-change-me')
      .update(`${key}:${expiresAt}`)
      .digest('hex');
    const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api/v1`;
    return `${base}/assets/content?key=${encodeURIComponent(key)}&exp=${expiresAt}&sig=${signature}`;
  }
}