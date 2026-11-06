import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { uploadMetadataSchema } from '@fah/contracts';
import { ApiError } from '../../common/api-error';
import type { DeviceClaims } from '../../common/auth';
import { ConfigService } from '../../infra/config.service';
import { PipelineRunner } from '../../infra/pipeline.runner';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';

@Injectable()
export class DeviceIngressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly runner: PipelineRunner,
  ) {}

  async accept(deviceId: string, claims: DeviceClaims, file: Buffer | undefined, metadataRaw: string | undefined) {
    if (claims.sub !== deviceId) throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');
    if (!file || file.length === 0) {
      throw new ApiError('INVALID_METADATA', '缺少素材文件', [{ field: 'file', message: '必填' }]);
    }
    if (!metadataRaw) {
      throw new ApiError('INVALID_METADATA', '缺少 metadata 字段', [{ field: 'metadata', message: '必填' }]);
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataRaw);
    } catch {
      throw new ApiError('INVALID_METADATA', 'metadata 不是合法 JSON', [{ field: 'metadata', message: 'JSON 解析失败' }]);
    }

    const parsed = uploadMetadataSchema.safeParse(metadataJson);
    if (!parsed.success) {
      throw new ApiError(
        'INVALID_METADATA',
        '素材元数据不合法',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      );
    }
    const metadata = parsed.data;

    const device = await this.prisma.device.findUnique({ where: { deviceId } });
    if (!device || device.familyId !== claims.familyId) throw new ApiError('DEVICE_CREDENTIAL_MISMATCH');

    const drift = new Date(metadata.capturedEndAt).getTime() - Date.now();
    if (drift > this.config.assetClockSkewSec * 1000) throw new ApiError('TIME_DRIFT_EXCEEDED');

    const contentHash = createHash('sha256').update(file).digest('hex');
    if (contentHash !== metadata.sha256.toLowerCase()) {
      throw new ApiError('INVALID_METADATA', '内容哈希与元数据不一致', [
        { field: 'sha256', message: '与上传文件内容不匹配' },
      ]);
    }

    const existing = await this.prisma.asset.findUnique({
      where: { deviceId_clientAssetId: { deviceId, clientAssetId: metadata.clientAssetId } },
    });
    if (existing) {
      if (existing.contentHash !== contentHash) throw new ApiError('ASSET_CONTENT_CONFLICT');
      return { assetId: existing.assetId, status: 'exists', deduped: true, nextAction: 'none' };
    }

    const assetId = `as_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const storageKey = `raw/${device.familyId}/${assetId}`;
    await this.storage.put(storageKey, file, 'application/octet-stream');

    await this.prisma.asset.create({
      data: {
        assetId,
        familyId: device.familyId,
        ownerId: device.ownerId,
        deviceId,
        clientAssetId: metadata.clientAssetId,
        type: metadata.assetType,
        capturedStartAt: new Date(metadata.capturedStartAt),
        capturedEndAt: new Date(metadata.capturedEndAt),
        receivedAt: new Date(),
        trigger: metadata.trigger,
        contentHash,
        storageKey,
        qualityFlags: metadata.qualityFlags ?? [],
        validity: 'unprocessed',
        expiresAt: new Date(Date.now() + this.config.getRuntime().retentionDays * 86400000),
      },
    });

    await this.runner.enqueue(assetId);
    return { assetId, status: 'accepted', deduped: false, nextAction: 'none' };
  }
}