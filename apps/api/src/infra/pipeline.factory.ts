import { Injectable } from '@nestjs/common';
import type { PipelineDeps, StoragePort } from '@fah/pipeline';
import { createVisionProvider, createImageProvider } from '@fah/ai';
import { ConfigService } from './config.service';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';
import { logger } from '../common/logger';

@Injectable()
export class PipelineFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  create(): PipelineDeps {
    return {
      prisma: this.prisma,
      storage: this.storage as StoragePort,
      config: this.config.getRuntime(),
      vision: createVisionProvider(this.config.ai),
      image: createImageProvider(this.config.ai),
      logger: {
        info: (obj: unknown, msg?: string) => logger.info(obj as object, msg),
        warn: (obj: unknown, msg?: string) => logger.warn(obj as object, msg),
      },
    };
  }
}