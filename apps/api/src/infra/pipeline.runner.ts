import { Injectable, type OnModuleInit } from '@nestjs/common';
import { processAsset } from '@fah/pipeline';
import { logger } from '../common/logger';
import { PipelineFactory } from './pipeline.factory';
import { QueueService } from './queue.service';

@Injectable()
export class PipelineRunner implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly factory: PipelineFactory,
  ) {}

  onModuleInit(): void {
    this.queue.register('asset.ingest', async (payload) => {
      const assetId = String(payload.assetId ?? '');
      if (!assetId) return;
      const result = await processAsset(this.factory.create(), assetId);
      logger.info({ assetId, result }, 'ingest job finished');
    });
  }

  async enqueue(assetId: string): Promise<void> {
    await this.queue.enqueue('asset.ingest', { assetId });
  }

  async runNow(assetId: string) {
    return processAsset(this.factory.create(), assetId);
  }
}