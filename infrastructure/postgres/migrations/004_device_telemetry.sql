-- Device telemetry for admin dashboard (permissions, debug, sync health)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS telemetry JSONB DEFAULT '{}'::jsonb;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS telemetry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_call_logs_deleted ON call_logs (is_deleted) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_call_logs_call_time ON call_logs (call_time DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone ON call_logs (phone_number);
CREATE INDEX IF NOT EXISTS idx_sync_audit_created ON sync_audit (created_at DESC);
