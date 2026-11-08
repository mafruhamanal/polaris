CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reader_settings (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  font_family    TEXT    NOT NULL DEFAULT 'system',
  font_size      INTEGER NOT NULL DEFAULT 16,
  letter_spacing REAL    NOT NULL DEFAULT 0,
  word_spacing   REAL    NOT NULL DEFAULT 0,
  line_spacing   REAL    NOT NULL DEFAULT 1.4,
  background     TEXT    NOT NULL DEFAULT 'white',
  voice          TEXT,
  reading_speed  REAL    NOT NULL DEFAULT 1.0,
  reading_level  TEXT    NOT NULL DEFAULT 'standard',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_text  TEXT NOT NULL,
  response       TEXT NOT NULL,
  mode           TEXT NOT NULL,
  source_app     TEXT,
  source_url     TEXT,
  source_window  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mac_device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  device_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_responses_user_created
  ON saved_responses (user_id, created_at DESC);

-- Catalogs: folders the user groups saved responses and Write notes into.
CREATE TABLE IF NOT EXISTS catalogs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalogs_user_name ON catalogs (user_id, lower(name));

ALTER TABLE saved_responses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE saved_responses ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalogs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS saved_responses_catalog ON saved_responses (catalog_id);
