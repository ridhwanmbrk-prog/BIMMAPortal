
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS batch (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS peserta (
  id TEXT PRIMARY KEY,
  nim TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  jurusan TEXT,
  gender TEXT,
  nomor_whatsapp TEXT,
  email TEXT,
  alamat TEXT,
  tanggal_masuk TEXT,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_peserta (
  batch_id TEXT NOT NULL,
  peserta_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id, peserta_id),
  FOREIGN KEY (batch_id) REFERENCES batch(id),
  FOREIGN KEY (peserta_id) REFERENCES peserta(id)
);

CREATE TABLE IF NOT EXISTS jadwal_kegiatan (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  nama_kegiatan TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  jam_mulai TEXT,
  jam_selesai TEXT,
  wajib INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batch(id)
);

CREATE TABLE IF NOT EXISTS absensi (
  id TEXT PRIMARY KEY,
  peserta_id TEXT NOT NULL,
  jadwal_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'HADIR',
  waktu_server TEXT,
  keterangan TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (peserta_id, jadwal_id),
  FOREIGN KEY (peserta_id) REFERENCES peserta(id),
  FOREIGN KEY (jadwal_id) REFERENCES jadwal_kegiatan(id)
);

CREATE TABLE IF NOT EXISTS izin (
  id TEXT PRIMARY KEY,
  peserta_id TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  alasan TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peserta_id) REFERENCES peserta(id)
);

CREATE TABLE IF NOT EXISTS pembenaran (
  id TEXT PRIMARY KEY,
  peserta_id TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  alasan TEXT,
  status TEXT NOT NULL DEFAULT 'MENUNGGU',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peserta_id) REFERENCES peserta(id)
);

CREATE TABLE IF NOT EXISTS musyrif (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  peserta_id TEXT,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peserta_id) REFERENCES peserta(id)
);

CREATE TABLE IF NOT EXISTS app_config (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  aksi TEXT NOT NULL,
  entitas TEXT,
  entitas_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jadwal_batch_tanggal
  ON jadwal_kegiatan(batch_id, tanggal);

CREATE INDEX IF NOT EXISTS idx_absensi_peserta
  ON absensi(peserta_id);

CREATE INDEX IF NOT EXISTS idx_absensi_jadwal
  ON absensi(jadwal_id);

CREATE INDEX IF NOT EXISTS idx_izin_peserta_tanggal
  ON izin(peserta_id, tanggal_mulai, tanggal_selesai);

CREATE INDEX IF NOT EXISTS idx_pembenaran_peserta_tanggal
  ON pembenaran(peserta_id, tanggal);

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
ALTER TABLE users ADD COLUMN nama_lengkap TEXT;
ALTER TABLE users ADD COLUMN gender TEXT;
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
