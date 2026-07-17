import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as callLogController from '../controllers/callLog.controller';
import * as adminController from '../controllers/admin.controller';
import {
  authMiddleware,
  adminMiddleware,
  apiKeyMiddleware,
  validateBody,
} from '../middleware/auth';
import {
  loginSchema,
  registerDeviceSchema,
  syncCallSchema,
  batchSyncSchema,
  deleteCallLogsSchema,
  deviceTelemetrySchema,
} from '../middleware/validation';

const router = Router();

router.post(
  '/auth/login',
  (req, res, next) => validateBody(loginSchema, req, res, next),
  authController.login
);

router.post(
  '/auth/register-device',
  (req, res, next) => validateBody(registerDeviceSchema, req, res, next),
  authController.registerDevice
);

router.post(
  '/call-log/sync',
  authMiddleware,
  apiKeyMiddleware,
  (req, res, next) => validateBody(syncCallSchema, req, res, next),
  callLogController.syncCall
);

router.post(
  '/call-log/batch-sync',
  authMiddleware,
  apiKeyMiddleware,
  (req, res, next) => validateBody(batchSyncSchema, req, res, next),
  callLogController.batchSync
);

router.get('/call-log/history', authMiddleware, callLogController.getHistory);
router.get('/call-log/pending', authMiddleware, callLogController.getPending);

router.post(
  '/call-log/device-telemetry',
  authMiddleware,
  apiKeyMiddleware,
  (req, res, next) => validateBody(deviceTelemetrySchema, req, res, next),
  callLogController.reportTelemetry
);

// Admin dashboard routes
router.get(
  '/admin/dashboard/stats',
  authMiddleware,
  adminMiddleware,
  adminController.getDashboardStats
);

router.get(
  '/admin/dashboard/analytics',
  authMiddleware,
  adminMiddleware,
  adminController.getAnalytics
);

router.get(
  '/admin/dashboard/live',
  authMiddleware,
  adminMiddleware,
  adminController.getLiveSnapshot
);

router.get(
  '/admin/call-logs',
  authMiddleware,
  adminMiddleware,
  adminController.getAllCallLogs
);

router.delete(
  '/admin/call-logs/:serverId',
  authMiddleware,
  adminMiddleware,
  adminController.deleteCallLog
);

router.post(
  '/admin/call-logs/delete',
  authMiddleware,
  adminMiddleware,
  (req, res, next) => validateBody(deleteCallLogsSchema, req, res, next),
  adminController.deleteCallLogs
);

router.get(
  '/admin/contacts',
  authMiddleware,
  adminMiddleware,
  adminController.getContacts
);

router.get(
  '/admin/sync-audit',
  authMiddleware,
  adminMiddleware,
  adminController.getSyncAudit
);

router.get(
  '/admin/devices/:deviceId',
  authMiddleware,
  adminMiddleware,
  adminController.getDeviceDetail
);

router.get(
  '/admin/devices',
  authMiddleware,
  adminMiddleware,
  adminController.getAllDevices
);

export default router;
