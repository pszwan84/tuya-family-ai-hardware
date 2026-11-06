import { z } from 'zod';

export const runtimeConfigSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
  dedupeWindowSec: z.number().int().min(10).max(3600).default(120),
  dedupeHammingThreshold: z.number().int().min(0).max(64).default(8),
  clusterWindowSec: z.number().int().min(30).max(7200).default(1800),
  retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
  defaultShareScope: z.enum(['members', 'family']).default('members'),
  notifyAggregateWindowMin: z.number().int().min(1).max(120).default(10),
  notifyDailyLimit: z.number().int().min(1).max(10).default(1),
  quietHours: z
    .object({ start: z.string(), end: z.string() })
    .nullable()
    .default(null),
  aiMode: z.enum(['mock', 'live']).default('mock'),
  cardMode: z.enum(['template', 'live']).default('template'),
  assetIngressMode: z.enum(['direct', 'cloud_relay']).default('direct'),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export const defaultRuntimeConfig: RuntimeConfig = runtimeConfigSchema.parse({});

export function mergeRuntimeConfig(partial: Partial<RuntimeConfig>): RuntimeConfig {
  return runtimeConfigSchema.parse({ ...defaultRuntimeConfig, ...partial });
}

export const FALLBACK_NARRATIVE_NOTE = '内容由 AI 整理，只描述画面里的事实。';
export const AI_ATTRIBUTION_LABEL = 'AI 整理';