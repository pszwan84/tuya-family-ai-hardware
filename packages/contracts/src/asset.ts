import { z } from 'zod';

export const assetTypeSchema = z.enum(['photo', 'video']);
export const assetTriggerSchema = z.enum(['manual', 'scheduled']);
export const qualityFlagSchema = z.enum(['dark', 'blur', 'occluded', 'overexposed']);

export const uploadMetadataSchema = z
  .object({
    clientAssetId: z.string().min(1).max(128),
    assetType: assetTypeSchema,
    capturedStartAt: z.string().datetime(),
    capturedEndAt: z.string().datetime(),
    trigger: assetTriggerSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    qualityFlags: z.array(qualityFlagSchema).max(8).optional(),
    fwVersion: z.string().min(1).max(64),
    privacySwitch: z.enum(['open', 'covered']).optional(),
  })
  .refine((value) => new Date(value.capturedEndAt).getTime() >= new Date(value.capturedStartAt).getTime(), {
    message: '采集结束时间不得早于开始时间',
    path: ['capturedEndAt'],
  });

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;

export const assetAcceptResultSchema = z.object({
  assetId: z.string(),
  status: z.enum(['accepted', 'exists']),
  deduped: z.boolean(),
  nextAction: z.literal('none'),
});

export type AssetAcceptResult = z.infer<typeof assetAcceptResultSchema>;

export const assetUrlResponseSchema = z.object({
  url: z.string(),
  expiresAt: z.string().datetime(),
});

export const assetItemSchema = z.object({
  assetId: z.string(),
  type: assetTypeSchema,
  capturedStartAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  trigger: assetTriggerSchema,
  validity: z.enum(['unprocessed', 'valid', 'invalid', 'duplicate']),
  invalidReason: z.string().nullable(),
  qualityFlags: z.array(qualityFlagSchema),
  deletedAt: z.string().datetime().nullable(),
});

export type AssetItem = z.infer<typeof assetItemSchema>;