import { z } from 'zod';

export const shareScopeSchema = z.enum(['members', 'family']);

export const shareRequestSchema = z
  .object({
    scope: shareScopeSchema,
    recipientIds: z.array(z.string().min(1)).max(20),
    riskAckToken: z.string().optional(),
    defaultNote: z.string().max(200).optional(),
  })
  .refine((value) => value.scope !== 'members' || value.recipientIds.length >= 1, {
    message: '按成员分享时至少选择一位接收人',
    path: ['recipientIds'],
  });

export type ShareRequest = z.infer<typeof shareRequestSchema>;

export const sharePreviewItemSchema = z.object({
  memberId: z.string(),
  role: z.string(),
  title: z.string(),
  whatHappened: z.string(),
  whyForYou: z.string(),
  roleNote: z.string(),
  imageUrl: z.string().nullable(),
  aiAttribution: z.literal(true),
});

export const sharePreviewRequestSchema = z.object({
  recipientIds: z.array(z.string().min(1)).min(1).max(20),
  scope: shareScopeSchema,
});

export const sharePreviewResponseSchema = z.object({
  previews: z.array(sharePreviewItemSchema),
  risk: z
    .object({
      level: z.enum(['none', 'sensitive', 'high']),
      items: z.array(z.string()),
      requiresAck: z.boolean(),
      riskAckToken: z.string().optional(),
    })
    .optional(),
});

export const shareResponseSchema = z.object({
  shareId: z.string(),
  status: z.literal('shared'),
  effectiveAt: z.string().datetime(),
  views: z.array(z.object({ memberId: z.string(), viewId: z.string(), role: z.string() })),
});

export const revokeResponseSchema = z.object({
  shareIds: z.array(z.string()),
  status: z.literal('revoked'),
  revokedAt: z.string().datetime(),
});

export const notificationItemSchema = z.object({
  id: z.string(),
  type: z.literal('family_digest'),
  count: z.number().int().min(1),
  entry: z.object({ familyId: z.string(), memberId: z.string(), href: z.string() }),
});

export const settingsSchema = z.object({
  defaultScope: shareScopeSchema,
  retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  notifyFrequency: z.enum(['daily', 'realtime']),
  quietHours: z
    .object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })
    .nullable(),
});

export const familyOverviewSchema = z.object({
  newEventCount: z.number().int().min(0),
  activeMembers: z.array(z.object({ memberId: z.string(), displayName: z.string(), role: z.string() })),
  changes: z.array(z.string()),
});