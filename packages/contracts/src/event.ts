import { z } from 'zod';

export const eventTypeSchema = z.enum([
  'first_time',
  'small_change',
  'small_achievement',
  'small_joy',
  'shareable',
  'shared_memory',
]);

export const eventStatusSchema = z.enum(['draft', 'shared', 'revoked', 'ignored', 'deleted']);
export const riskLevelSchema = z.enum(['none', 'sensitive', 'high']);
export const confidenceLevelSchema = z.enum(['high', 'low']);
export const renderModeSchema = z.enum(['ai', 'template', 'text']);

export const factsSchema = z.object({
  who: z.string().min(1),
  action: z.string().min(1),
  object: z.string().min(1),
  scene: z.string().min(1),
  time: z.string().min(1),
});

export type Facts = z.infer<typeof factsSchema>;

export const shareValueSchema = z.object({
  freshness: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  understandability: z.number().min(0).max(1),
  intent: z.number().min(0).max(1),
  total: z.number().min(0).max(4),
});

export const cardSchema = z.object({
  cardId: z.string(),
  version: z.number().int().min(1),
  renderMode: renderModeSchema,
  imageUrl: z.string().url().nullable(),
  title: z.string(),
  whatHappened: z.string(),
  aiAttribution: z.literal(true),
  generation: z
    .object({ status: z.enum(['ok', 'degraded']), reason: z.string().optional() })
    .optional(),
});

export type Card = z.infer<typeof cardSchema>;

export const draftEventSchema = z.object({
  eventId: z.string(),
  occurredAt: z.string().datetime(),
  eventType: eventTypeSchema,
  title: z.string(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: confidenceLevelSchema,
  riskLevel: riskLevelSchema,
  recommendReason: z.string(),
  card: cardSchema,
  recipientPresets: z.array(
    z.object({ memberId: z.string(), displayName: z.string(), role: z.string() }),
  ),
  requiresRiskAck: z.boolean(),
});

export type DraftEvent = z.infer<typeof draftEventSchema>;

export const eventViewSchema = z.object({
  viewId: z.string(),
  recipientId: z.string(),
  roleSnapshot: z.string(),
  version: z.number().int().min(1),
  title: z.string(),
  whatHappened: z.string(),
  whyForYou: z.string(),
  roleNote: z.string(),
  imageUrl: z.string().nullable(),
  aiAttribution: z.literal(true),
});

export type EventViewPayload = z.infer<typeof eventViewSchema>;

export const eventDetailSchema = z.object({
  event: z.object({
    eventId: z.string(),
    occurredAt: z.string().datetime(),
    eventType: eventTypeSchema,
    facts: factsSchema,
    description: z.string(),
    confidence: z.number(),
    confidenceLevel: confidenceLevelSchema,
    risk: z.object({ level: riskLevelSchema, items: z.array(z.string()) }),
    status: eventStatusSchema,
    aiAttribution: z.literal(true),
    sourceAssetCount: z.number().int().min(0),
    sourceAssetsCleaned: z.boolean(),
  }),
  card: cardSchema,
  views: z.array(eventViewSchema),
  share: z
    .object({
      shareId: z.string(),
      scope: z.enum(['members', 'family']),
      recipients: z.array(z.string()),
      status: z.enum(['pending', 'confirmed', 'revoked']),
      confirmedAt: z.string().datetime().nullable(),
    })
    .nullable(),
});

export type EventDetail = z.infer<typeof eventDetailSchema>;

export const familyEventItemSchema = z.object({
  viewId: z.string(),
  eventId: z.string(),
  occurredAt: z.string().datetime(),
  owner: z.object({ memberId: z.string(), displayName: z.string(), role: z.string() }),
  title: z.string(),
  whatHappened: z.string(),
  whyForYou: z.string(),
  roleNote: z.string(),
  card: z.object({
    imageUrl: z.string().nullable(),
    renderMode: renderModeSchema,
    aiAttribution: z.literal(true),
  }),
  aiAttribution: z.literal(true),
});

export type FamilyEventItem = z.infer<typeof familyEventItemSchema>;

export const patchEventSchema = z.object({
  action: z.enum(['ignore', 'restore', 'correct']),
  patch: z
    .object({
      title: z.string().min(1).max(80).optional(),
      description: z.string().min(1).max(500).optional(),
    })
    .optional(),
});