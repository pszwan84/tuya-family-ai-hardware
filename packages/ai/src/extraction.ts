import { z } from 'zod';

export const qualityReasonSchema = z.enum(['dark', 'blur', 'occluded', 'overexposed', 'empty']);
export const riskSignalSchema = z.enum([
  'exact_location',
  'medical',
  'family_conflict',
  'third_party',
  'screen_document',
  'low_confidence',
  'continuous_tracking',
]);

export const extractionSchema = z.object({
  eventType: z.enum([
    'first_time',
    'small_change',
    'small_achievement',
    'small_joy',
    'shareable',
    'shared_memory',
  ]),
  facts: z.object({
    who: z.string().min(1).max(40),
    action: z.string().min(1).max(60),
    object: z.string().min(1).max(60),
    scene: z.string().min(1).max(40),
    time: z.string().min(1).max(40),
  }),
  description: z.string().min(1).max(400),
  confidence: z.number().min(0).max(1),
  typeConfidence: z.number().min(0).max(1),
  unrecognized: z.boolean().default(false),
  riskSignals: z.array(riskSignalSchema).max(8).default([]),
  quality: z.object({
    valid: z.boolean(),
    reasons: z.array(qualityReasonSchema).max(6),
  }),
  evidence: z.object({
    who: z.boolean(),
    action: z.boolean(),
    object: z.boolean(),
    scene: z.boolean(),
  }),
});

export type Extraction = z.infer<typeof extractionSchema>;

export type VisionRequest = {
  image: Buffer;
  contentType: string;
  assetId: string;
  capturedAt: string;
  qualityFlags: string[];
};

export interface VisionProvider {
  readonly name: string;
  analyze(request: VisionRequest): Promise<Extraction>;
}

export function validateExtraction(raw: unknown): { ok: true; value: Extraction } | { ok: false; errors: string[] } {
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  }
  const value = parsed.data;
  const missing = Object.entries(value.evidence)
    .filter(([, covered]) => !covered)
    .map(([key]) => key);
  if (!value.unrecognized && missing.length > 0) {
    return { ok: false, errors: [`evidence 未覆盖: ${missing.join(',')}`] };
  }
  return { ok: true, value };
}