import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerDeviceSchema = z.object({
  deviceId: z.string().min(8).max(128),
  deviceName: z.string().min(1).max(255).optional(),
});

export const syncCallSchema = z.object({
  deviceId: z.string().min(8).max(128),
  hash: z.string().length(64),
  androidId: z.number().int().nonnegative(),
  phoneNumber: z.string().max(32),
  contactName: z.string().max(255).optional().default(''),
  callType: z.enum([
    'INCOMING', 'OUTGOING', 'MISSED', 'REJECTED', 'BLOCKED', 'VOICEMAIL', 'UNKNOWN',
  ]),
  duration: z.number().int().nonnegative(),
  callTime: z.number().int().positive(),
  simSlot: z.number().int().default(-1),
});

export const batchSyncSchema = z
  .object({
    deviceId: z.string().min(8).max(128),
    calls: z
      .array(syncCallSchema.omit({ deviceId: true }))
      .max(100)
      .default([]),
    deletions: z
      .array(
        z.object({
          hash: z.string().length(64).optional(),
          androidId: z.number().int().nonnegative(),
        })
      )
      .max(100)
      .default([]),
  })
  .refine((data) => data.calls.length > 0 || data.deletions.length > 0, {
    message: 'At least one call or deletion is required',
  });

export const paginationSchema = z.object({
  deviceId: z.string().min(8).max(128),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const deleteCallLogsSchema = z.object({
  serverIds: z.array(z.string().uuid()).min(1).max(500),
});

export const deviceTelemetrySchema = z.object({
  deviceId: z.string().min(8).max(128),
  permissions: z.record(z.boolean()).optional(),
  pluginStatus: z.record(z.unknown()).optional(),
  sqliteDebug: z.record(z.unknown()).optional(),
  syncStatus: z.record(z.unknown()).optional(),
  appVersion: z.string().max(64).optional(),
  osVersion: z.string().max(128).optional(),
  networkConnected: z.boolean().optional(),
  platform: z.string().max(32).optional(),
});
