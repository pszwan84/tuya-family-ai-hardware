import { z } from 'zod';

export const deviceRoleSchema = z.enum(['grandparent', 'middle', 'child']);
export const collectStateSchema = z.enum(['enabled', 'paused']);
export const privacyLedSchema = z.enum(['off', 'breathing', 'on', 'error']);

export const collectPolicySchema = z.object({
  minIntervalSec: z.number().int().min(10).max(86400),
  dailyLimit: z.number().int().min(1).max(500),
  windows: z
    .array(
      z.object({
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(8)
    .optional(),
});

export type CollectPolicy = z.infer<typeof collectPolicySchema>;

export const heartbeatSchema = z.object({
  fwVersion: z.string().min(1).max(64),
  protoVersion: z.string().min(1).max(32).optional(),
  collectState: collectStateSchema,
  queueDepth: z.number().int().min(0),
  freeMB: z.number().int().min(0),
  lastUpload: z
    .object({
      result: z.enum(['ok', 'failed']),
      code: z.string().max(64).optional(),
      at: z.string().datetime(),
    })
    .optional(),
  reportedVersion: z.number().int().min(0),
  privacyLed: privacyLedSchema,
});

export type Heartbeat = z.infer<typeof heartbeatSchema>;

export const deviceCommandSchema = z.object({
  id: z.string(),
  type: z.enum(['capture_now', 'set_switch', 'set_policy']),
  payload: z.record(z.unknown()),
  version: z.number().int().min(0),
});

export type DeviceCommandPayload = z.infer<typeof deviceCommandSchema>;

export const heartbeatResponseSchema = z.object({
  desiredCollectState: collectStateSchema,
  desiredVersion: z.number().int().min(0),
  serverTime: z.string().datetime(),
  resendCommands: z.array(deviceCommandSchema).optional(),
});

export const deviceStatusSchema = z.object({
  deviceId: z.string(),
  online: z.boolean(),
  lastSeenAt: z.string().datetime().nullable(),
  collectState: collectStateSchema,
  queueDepth: z.number().int().min(0),
  freeMB: z.number().int().min(0),
  lastUpload: z
    .object({ result: z.enum(['ok', 'failed']), code: z.string().optional(), at: z.string() })
    .nullable(),
  firmware: z.object({ fwVersion: z.string().nullable(), protoVersion: z.string().nullable() }),
  pendingOnOnline: z.boolean(),
});

export const patchDeviceSchema = z
  .object({
    collectState: collectStateSchema.optional(),
    policy: collectPolicySchema.optional(),
  })
  .refine((value) => value.collectState !== undefined || value.policy !== undefined, {
    message: '至少提供一个可更新字段',
  });

export const bindDeviceSchema = z.object({
  activationCode: z.string().min(4).max(128),
});

export const deviceTokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresInSec: z.number().int().positive(),
  familyId: z.string(),
});

export const commandPullResponseSchema = z.object({
  commands: z.array(deviceCommandSchema),
});