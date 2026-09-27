-- ENGQUEST PostgreSQL target schema.
-- Run against an empty database; this does not alter the live Firestore database.

BEGIN;

CREATE TABLE IF NOT EXISTS teams (
  team_id TEXT PRIMARY KEY CHECK (team_id ~ '^eqth[0-9]{2,}$'),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  members JSONB NOT NULL CHECK (jsonb_typeof(members) = 'array'),
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 7),
  registered_at TEXT NOT NULL,
  last_activity_at TEXT,
  round3_requested_at TEXT,
  round3_photo_submitted_at TEXT,
  round3_rejected_at TEXT,
  round3_approved_at TEXT,
  round4_clue_password TEXT,
  round7_requested_at TEXT,
  round7_photo_submitted_at TEXT,
  round7_rejected_at TEXT,
  round7_approved_at TEXT,
  raw_data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_key TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  raw_data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS enrollments_team_id_idx ON enrollments(team_id);

CREATE TABLE IF NOT EXISTS team_names (
  name_key TEXT PRIMARY KEY,
  team_id TEXT NOT NULL UNIQUE,
  raw_data JSONB NOT NULL
);

-- Registration creates uniqueness claims before inserting the team document,
-- matching the existing Firestore transaction flow.
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_team_id_fkey;
ALTER TABLE team_names DROP CONSTRAINT IF EXISTS team_names_team_id_fkey;

CREATE TABLE IF NOT EXISTS system_state (
  document_id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS photo_proofs (
  team_id TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  round_number SMALLINT NOT NULL CHECK (round_number IN (3, 7)),
  filename TEXT,
  content_type TEXT,
  uploaded_at TEXT,
  raw_data JSONB NOT NULL,
  PRIMARY KEY (team_id, round_number)
);

CREATE TABLE IF NOT EXISTS migration_unmapped_documents (
  document_path TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS teams_progress_idx ON teams(progress);
CREATE INDEX IF NOT EXISTS teams_round3_pending_idx ON teams(round3_requested_at)
  WHERE round3_requested_at IS NOT NULL AND round3_rejected_at IS NULL AND round3_approved_at IS NULL;
CREATE INDEX IF NOT EXISTS teams_round7_pending_idx ON teams(round7_requested_at)
  WHERE round7_requested_at IS NOT NULL AND round7_approved_at IS NULL;

CREATE TABLE IF NOT EXISTS migration_metadata (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO migration_metadata(key, value)
VALUES ('schema_version', '1'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
