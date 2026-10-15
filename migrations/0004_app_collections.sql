PRAGMA foreign_keys = ON;

-- Canonical JSON collections used by the existing synchronous UI storage API.
-- The structured tables (peserta, absensi, users, etc.) remain for auth/reporting
-- and can be migrated into normalized tables without losing application fields.
CREATE TABLE IF NOT EXISTS app_collections (
  collection_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_collections_updated_at
  ON app_collections(updated_at);
