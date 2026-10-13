-- BIMMA Portal central database foundation.
-- Apply this migration only after reviewing the schema; it is not applied by this commit.
-- JSON payloads preserve the application's existing TypeScript models while the API is migrated incrementally.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PETUGAS', 'PESERTA')),
  status_aktif INTEGER NOT NULL DEFAULT 1 CHECK (status_aktif IN (0, 1)),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS peserta (
  peserta_id TEXT PRIMARY KEY NOT NULL,
  nim TEXT NOT NULL UNIQUE,
  batch_id TEXT NOT NULL,
  status_peserta TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_peserta_batch ON peserta(batch_id);
CREATE INDEX IF NOT EXISTS idx_peserta_status ON peserta(status_peserta);

CREATE TABLE IF NOT EXISTS batch (
  batch_id TEXT PRIMARY KEY NOT NULL,
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jadwal (
  jadwal_id TEXT PRIMARY KEY NOT NULL,
  status_aktif INTEGER NOT NULL DEFAULT 1 CHECK (status_aktif IN (0, 1)),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS absensi (
  absensi_id TEXT PRIMARY KEY NOT NULL,
  peserta_id TEXT NOT NULL,
  jadwal_id TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  status_absensi TEXT NOT NULL CHECK (status_absensi IN ('HADIR', 'IZIN', 'ALPA')),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_peserta_tanggal ON absensi(peserta_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_jadwal_tanggal ON absensi(jadwal_id, tanggal);

CREATE TABLE IF NOT EXISTS izin (
  izin_id TEXT PRIMARY KEY NOT NULL,
  peserta_id TEXT NOT NULL,
  status_persetujuan TEXT NOT NULL CHECK (status_persetujuan IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_izin_peserta ON izin(peserta_id);
CREATE INDEX IF NOT EXISTS idx_izin_status ON izin(status_persetujuan);

CREATE TABLE IF NOT EXISTS pembenaran (
  pembenaran_id TEXT PRIMARY KEY NOT NULL,
  peserta_id TEXT NOT NULL,
  jadwal_id TEXT NOT NULL,
  tanggal_kejadian TEXT NOT NULL,
  status_persetujuan TEXT NOT NULL CHECK (status_persetujuan IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pembenaran_status ON pembenaran(status_persetujuan);

CREATE TABLE IF NOT EXISTS musyrif (
  id TEXT PRIMARY KEY NOT NULL,
  status_aktif INTEGER NOT NULL DEFAULT 1 CHECK (status_aktif IN (0, 1)),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id TEXT PRIMARY KEY NOT NULL,
  pengguna_id TEXT NOT NULL,
  aksi TEXT NOT NULL,
  waktu_server TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);
CREATE INDEX IF NOT EXISTS idx_audit_waktu ON audit_logs(waktu_server);

CREATE TABLE IF NOT EXISTS app_config (
  config_key TEXT PRIMARY KEY NOT NULL,
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
