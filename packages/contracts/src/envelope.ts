import { z } from 'zod';

export const apiMetaSchema = z
  .object({
    cursor: z.string().optional(),
    hasMore: z.boolean().optional(),
    total: z.number().int().nonnegative().optional(),
  })
  .optional();

export function envelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    requestId: z.string(),
    code: z.string(),
    message: z.string(),
    data: data.nullable(),
    retryable: z.boolean(),
    retryAfterMs: z.number().int().nonnegative().optional(),
    meta: apiMetaSchema,
  });
}

export type ApiEnvelope<T> = {
  requestId: string;
  code: string;
  message: string;
  data: T | null;
  retryable: boolean;
  retryAfterMs?: number;
  meta?: { cursor?: string; hasMore?: boolean; total?: number };
};

export type PageMeta = { cursor?: string; hasMore: boolean; total?: number };