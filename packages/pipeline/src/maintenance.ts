import type { PipelineDeps } from './deps';

export type CleanupResult = { scanned: number; removed: number; failed: number };

export async function cleanupExpiredAssets(deps: PipelineDeps, now = new Date(), limit = 200): Promise<CleanupResult> {
  const { prisma, storage, logger } = deps;
  const assets = await prisma.asset.findMany({
    where: { deletedAt: null, expiresAt: { lte: now } },
    orderBy: { expiresAt: 'asc' },
    take: limit,
  });

  let removed = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      await storage.remove(asset.storageKey);
      await prisma.asset.update({
        where: { assetId: asset.assetId },
        data: { deletedAt: now, validity: asset.validity === 'unprocessed' ? 'invalid' : asset.validity },
      });
      removed += 1;
    } catch (error) {
      failed += 1;
      logger?.warn({ err: error, assetId: asset.assetId }, 'retention cleanup failed');
    }
  }

  await prisma.auditLog.create({
    data: {
      familyId: assets[0]?.familyId ?? 'system',
      actorId: 'system',
      action: 'asset.retention_cleanup',
      targetType: 'Asset',
      targetId: 'batch',
      after: { scanned: assets.length, removed, failed },
    },
  });

  return { scanned: assets.length, removed, failed };
}