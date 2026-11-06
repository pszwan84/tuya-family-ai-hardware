import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../common/logger';

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly handlers = new Map<string, JobHandler>();
  private readonly queues = new Map<string, Queue>();
  private readonly connection: IORedis | null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    const inline = (process.env.QUEUE_FALLBACK ?? 'inline') === 'inline';
    this.connection = redisUrl && !inline ? new IORedis(redisUrl, { maxRetriesPerRequest: null }) : null;
  }

  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  async enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
    const handler = this.handlers.get(name);
    if (!this.connection) {
      if (!handler) {
        logger.warn({ name }, 'no handler registered for inline job');
        return;
      }
      setImmediate(() => {
        handler(payload).catch((error) => logger.error({ err: error, name }, 'inline job failed'));
      });
      return;
    }

    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
    }
    await queue.add(name, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    if (this.connection) await this.connection.quit();
  }
}