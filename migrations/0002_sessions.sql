
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  peserta_id TEXT,
  role TEXT NOT NULL
    CHECK (role IN ('ADMIN', 'PETUGAS', 'PESERTA')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (
    (user_id IS NOT NULL AND peserta_id IS NULL)
    OR
    (user_id IS NULL AND peserta_id IS NOT NULL)
  ),

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (peserta_id) REFERENCES peserta(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_peserta
  ON sessions(peserta_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
  ON sessions(expires_at);
