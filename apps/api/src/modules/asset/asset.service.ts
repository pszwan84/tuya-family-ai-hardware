import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/api-error';
import { PipelineRunner } from '../../infra/pipeline.runner';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly runner: PipelineRunner,
  ) {}

  private async owned(assetId: string, ownerId: string, familyId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { assetId } });
    if (!asset) throw new ApiError('NOT_FOUND');
    if (asset.familyId !== familyId) throw new ApiError('NOT_FOUND');
    if (asset.ownerId !== ownerId) throw new ApiError('MATERIAL_ACCESS_DENIED');
    return asset;
  }

  async signedUrl(assetId: string, ownerId: string, familyId: string) {
    const asset = await this.owned(assetId, ownerId, familyId);
    if (asset.deletedAt) throw new ApiError('NOT_FOUND');
    const url = await this.storage.presign(asset.storageKey, 300);
    return { url, expiresAt: new Date(Date.now() + 300000).toISOString() };
  }

  async readSigned(key: string, exp: number, sig: string) {
    if (!this.storage.verifySignature(key, exp, sig)) throw new ApiError('FORBIDDEN');
    const data = await this.storage.get(key);
    const contentType = key.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
    return { data, contentType };
  }

  async reprocess(assetId: string, ownerId: string, familyId: string) {
    const asset = await this.owned(assetId, ownerId, familyId);
    if (asset.validity === 'valid' || asset.validity === 'duplicate') throw new ApiError('INVALID_STATE_TRANSITION');
    await this.prisma.asset.update({
      where: { assetId },
      data: { validity: 'unprocessed', invalidReason: null },
    });
    const result = await this.runner.runNow(assetId);
    return { jobId: `inline:${assetId}`, result };
  }
}