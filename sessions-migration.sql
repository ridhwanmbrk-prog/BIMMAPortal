CREATE TABLE IF NOT EXISTS sessions (
   id TEXT PRIMARY KEY,
  user_id TEXT,
  peserta_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PETUGAS', 'PESERTA')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (role IN ('ADMIN', 'PETUGAS') AND user_id IS NOT NULL AND peserta_id IS NULL)
    OR
    (role = 'PESERTA' AND peserta_id IS NOT NULL AND user_id IS NULL)
  ),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (peserta_id) REFERENCES peserta(peserta_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_peserta_id ON sessions(peserta_id);
