-- ============================================================
-- Migration 001: Initial Schema
-- AWS Updates Platform
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'solution_architect',
  'developer',
  'devops',
  'data_engineer'
);

CREATE TYPE language_pref AS ENUM ('en', 'hi', 'hinglish');

CREATE TYPE priority_level AS ENUM ('critical', 'high', 'normal');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  name                TEXT NOT NULL,
  role                user_role NOT NULL,
  language_preference language_pref NOT NULL DEFAULT 'en',
  is_first_login      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- ============================================================
-- UPDATES
-- ============================================================

CREATE TABLE updates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  raw_content           TEXT NOT NULL,
  simplified_en         TEXT,                        -- LLM output (stored once)
  simplified_hi         TEXT,                        -- Amazon Translate output (stored once)
  simplified_hinglish   TEXT,                        -- Hinglish output (stored once)
  source_url            TEXT NOT NULL UNIQUE,
  content_hash          TEXT NOT NULL UNIQUE,        -- for duplicate detection
  published_at          TIMESTAMPTZ NOT NULL,
  category              TEXT NOT NULL DEFAULT 'General',
  service_tags          TEXT[] NOT NULL DEFAULT '{}',
  role_tags             user_role[] NOT NULL DEFAULT '{}',
  priority              priority_level NOT NULL DEFAULT 'normal',
  is_processed          BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Full-text search vector (auto-updated via trigger)
  search_vector         TSVECTOR
);

CREATE INDEX idx_updates_published_at   ON updates (published_at DESC);
CREATE INDEX idx_updates_priority       ON updates (priority);
CREATE INDEX idx_updates_role_tags      ON updates USING GIN (role_tags);
CREATE INDEX idx_updates_service_tags   ON updates USING GIN (service_tags);
CREATE INDEX idx_updates_search_vector  ON updates USING GIN (search_vector);
CREATE INDEX idx_updates_content_hash   ON updates (content_hash);
CREATE INDEX idx_updates_is_processed   ON updates (is_processed);

-- Trigger: keep search_vector in sync with title + simplified_en
CREATE OR REPLACE FUNCTION updates_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.simplified_en, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER updates_search_vector_update
  BEFORE INSERT OR UPDATE OF title, simplified_en, category
  ON updates
  FOR EACH ROW EXECUTE FUNCTION updates_search_vector_trigger();

-- ============================================================
-- USER UPDATE STATE
-- ============================================================

CREATE TABLE user_update_state (
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  update_id       UUID NOT NULL REFERENCES updates (id) ON DELETE CASCADE,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  is_last_seen    BOOLEAN NOT NULL DEFAULT FALSE,  -- only one TRUE per user
  acknowledged_at TIMESTAMPTZ,                     -- for high-priority dismissal

  PRIMARY KEY (user_id, update_id)
);

CREATE INDEX idx_uus_user_id      ON user_update_state (user_id);
CREATE INDEX idx_uus_is_read      ON user_update_state (user_id, is_read);
CREATE INDEX idx_uus_is_last_seen ON user_update_state (user_id, is_last_seen);

-- Trigger: ensure only one last_seen row per user
CREATE OR REPLACE FUNCTION enforce_single_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_last_seen = TRUE THEN
    UPDATE user_update_state
    SET is_last_seen = FALSE
    WHERE user_id = NEW.user_id
      AND update_id <> NEW.update_id
      AND is_last_seen = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_last_seen_per_user
  BEFORE INSERT OR UPDATE OF is_last_seen
  ON user_update_state
  FOR EACH ROW EXECUTE FUNCTION enforce_single_last_seen();

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================

CREATE TABLE analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users (id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,   -- update_viewed, update_skipped, search_performed, etc.
  update_id   UUID REFERENCES updates (id) ON DELETE SET NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_user_id    ON analytics_events (user_id);
CREATE INDEX idx_analytics_event_type ON analytics_events (event_type);
CREATE INDEX idx_analytics_update_id  ON analytics_events (update_id);
CREATE INDEX idx_analytics_created_at ON analytics_events (created_at DESC);
-- For "most viewed this week" queries
CREATE INDEX idx_analytics_viewed_week ON analytics_events (update_id, created_at)
  WHERE event_type = 'update_viewed';

-- ============================================================
-- updated_at auto-update for users
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
