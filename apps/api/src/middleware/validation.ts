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

export const updateCallLogSchema = z.object({
  contactName: z.string().max(255).optional(),
  phoneNumber: z.string().max(32).optional(),
  callType: z
    .enum(['INCOMING', 'OUTGOING', 'MISSED', 'REJECTED', 'BLOCKED', 'VOICEMAIL', 'UNKNOWN'])
    .optional(),
  duration: z.number().int().nonnegative().optional(),
  callTime: z.number().int().positive().optional(),
  simSlot: z.number().int().optional(),
  isDeleted: z.boolean().optional(),
});

export const updateContactSchema = z.object({
  contactName: z.string().max(255),
});

export const updateDeviceSchema = z.object({
  deviceName: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

export const deleteDevicesSchema = z.object({
  deviceIds: z.array(z.string().min(1)).min(1).max(100),
});

export const deleteSyncAuditSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
});

export const deleteContactCallsBulkSchema = z.object({
  phoneNumbers: z.array(z.string().min(1)).min(1).max(100),
});

export const deviceTelemetrySchema = z
  .object({
    deviceId: z.string().min(8).max(128),
  })
  .passthrough();
