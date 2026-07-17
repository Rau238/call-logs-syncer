-- Call Log Sync System — PostgreSQL Schema
-- Auto-runs on first Docker Postgres start (docker-entrypoint-initdb.d)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE call_type AS ENUM (
    'INCOMING', 'OUTGOING', 'MISSED', 'REJECTED', 'BLOCKED', 'VOICEMAIL', 'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL DEFAULT '',
  role          user_role NOT NULL DEFAULT 'user',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  device_id     VARCHAR(128) NOT NULL UNIQUE,
  device_name   VARCHAR(255) NOT NULL DEFAULT 'Android Device',
  api_key_hash  VARCHAR(255) NOT NULL UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

CREATE TABLE IF NOT EXISTS call_logs (
  id            BIGSERIAL PRIMARY KEY,
  device_id     VARCHAR(128) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  server_uuid   UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  android_id    BIGINT NOT NULL,
  phone_number  VARCHAR(32) NOT NULL DEFAULT '',
  contact_name  VARCHAR(255) NOT NULL DEFAULT '',
  call_type     call_type NOT NULL,
  duration      INTEGER NOT NULL DEFAULT 0,
  call_time     BIGINT NOT NULL,
  sim_slot      INTEGER NOT NULL DEFAULT -1,
  hash          CHAR(64) NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_device_id ON call_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_time ON call_logs(call_time DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_device_time ON call_logs(device_id, call_time DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone ON call_logs(phone_number);

CREATE TABLE IF NOT EXISTS sync_audit (
  id            BIGSERIAL PRIMARY KEY,
  device_id     VARCHAR(128) NOT NULL,
  batch_size    INTEGER NOT NULL DEFAULT 0,
  synced_count  INTEGER NOT NULL DEFAULT 0,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_audit_device ON sync_audit(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_audit_created ON sync_audit(created_at DESC);

-- Admin seed (password: admin123 — CHANGE IN PRODUCTION)
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@enterprise.com',
  '$2a$10$YCRbKDzvwIiw39vHo9HDP.I6cP2i3WC/pZ86UdDF.U57KZWM9zKE2',
  'System Admin',
  'admin'
) ON CONFLICT (email) DO NOTHING;
