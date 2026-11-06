import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { mergeRuntimeConfig, type RuntimeConfig } from '@fah/config';
import { createImageProvider, createVisionProvider } from '@fah/ai';
import { cleanupExpiredAssets, processAsset, type PipelineDeps } from '@fah/pipeline';
import pino from 'pino';
import { LocalStorage } from './storage';

const logger = pino({ base: { service: 'fah-worker' } });

function runtimeConfig(): RuntimeConfig {
  return mergeRuntimeConfig({
    aiMode: process.env.AI_MODE === 'live' ? 'live' : 'mock',
    cardMode: process.env.CARD_MODE === 'live' ? 'live' : 'template',
    retentionDays: (Number(process.env.RETENTION_DAYS ?? 30) as 7 | 30 | 90),
  });
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    process.env.NODE_ENV ??= 'development';
  }

  const prisma = new PrismaClient();
  const storage = new LocalStorage();
  const config = runtimeConfig();
  const deps: PipelineDeps = {
    prisma,
    storage,
    config,
    vision: createVisionProvider({
      mode: config.aiMode,
      vlmBaseUrl: process.env.AI_VLM_BASE_URL ?? '',
      vlmApiKey: process.env.AI_VLM_API_KEY ?? '',
      vlmModel: process.env.AI_VLM_MODEL ?? 'qwen-vl-max',
      cardMode: config.cardMode,
      imageBaseUrl: process.env.AI_IMAGE_BASE_URL ?? '',
      imageApiKey: process.env.AI_IMAGE_API_KEY ?? '',
    }),
    image: createImageProvider({
      mode: config.aiMode,
      vlmBaseUrl: '',
      vlmApiKey: '',
      vlmModel: '',
      cardMode: config.cardMode,
      imageBaseUrl: process.env.AI_IMAGE_BASE_URL ?? '',
      imageApiKey: process.env.AI_IMAGE_API_KEY ?? '',
    }),
    logger: {
      info: (obj, msg) => logger.info(obj as object, msg),
      warn: (obj, msg) => logger.warn(obj as object, msg),
    },
  };

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('REDIS_URL not set, worker idle (api runs inline pipeline)');
    return;
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker(
    'asset.ingest',
    async (job) => {
      const assetId = String(job.data?.assetId ?? '');
      if (!assetId) return null;
      const result = await processAsset(deps, assetId);
      logger.info({ assetId, result }, 'asset ingest finished');
      return result;
    },
    { connection, concurrency: 4 },
  );

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error }, 'job failed');
  });

  const maintenanceQueue = new Queue('maintenance.cleanup', { connection });
  await maintenanceQueue.add(
    'cleanup',
    {},
    { repeat: { pattern: '7 * * * *' }, removeOnComplete: 20, removeOnFail: 50 },
  );

  const maintenanceWorker = new Worker(
    'maintenance.cleanup',
    async () => {
      const result = await cleanupExpiredAssets(deps);
      logger.info({ result }, 'retention cleanup finished');
      return result;
    },
    { connection, concurrency: 1 },
  );

  maintenanceWorker.on('failed', (_job, error) => {
    logger.error({ err: error }, 'maintenance job failed');
  });

  logger.info('worker started');

  const shutdown = async () => {
    await worker.close();
    await maintenanceWorker.close();
    await maintenanceQueue.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ err: error }, 'worker crashed');
  process.exit(1);
});