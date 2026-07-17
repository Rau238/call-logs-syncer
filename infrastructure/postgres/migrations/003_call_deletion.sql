-- Track when user deletes a call from phone — keep history on server
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_call_logs_deleted ON call_logs(is_deleted) WHERE is_deleted = TRUE;
