import type { PrismaClient } from '@prisma/client';
import type { ImageProvider, VisionProvider } from '@fah/ai';
import type { RuntimeConfig } from '@fah/config';

export interface StoragePort {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  presign(key: string, ttlSec: number): Promise<string>;
}

export type PipelineDeps = {
  prisma: PrismaClient;
  vision: VisionProvider;
  image: ImageProvider;
  storage: StoragePort;
  config: RuntimeConfig;
  logger?: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void };
};