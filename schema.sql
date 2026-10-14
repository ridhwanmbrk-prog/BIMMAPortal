-- =====================================================================
-- SCHEMA CLOUDFLARE D1 SQL: bimma-absensi-db
-- Database ID: dd5dbf9a-56c0-4ee0-85df-a698c7c99e56
-- Domain: https://absensi.bimma-uab.my.id/
-- PESMA (Pesantren Mahasiswa) Universitas 'Aisyiyah Bandung
-- =====================================================================

-- 1. TABEL PENGGUNA & LOGIN (ADMIN & PETUGAS)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nama_lengkap TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'PETUGAS', 'PESERTA')),
  gender TEXT CHECK(gender IN ('IKHWAN', 'AKHWAT', NULL)),
  status_aktif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. TABEL SANTRI / MAHASANTRI BIMMA
CREATE TABLE IF NOT EXISTS peserta (
  peserta_id TEXT PRIMARY KEY,
  nim TEXT UNIQUE NOT NULL,
  nama_lengkap TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('IKHWAN', 'AKHWAT')),
  program_studi TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  kamar TEXT,
  status_peserta TEXT DEFAULT 'AKTIF' CHECK(status_peserta IN ('AKTIF', 'LULUS', 'ALPA_BERAT', 'NONAKTIF')),
  nomor_whatsapp TEXT,
  email TEXT,
  alamat TEXT,
  qr_code TEXT,
  tanggal_masuk TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. TABEL BATCH / ANGKATAN
CREATE TABLE IF NOT EXISTS batch (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  tahun TEXT NOT NULL,
  tanggal_mulai TEXT,
  tanggal_selesai TEXT,
  status_aktif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 4. TABEL JADWAL KEGIATAN BIMMA
CREATE TABLE IF NOT EXISTS jadwal_kegiatan (
  jadwal_id TEXT PRIMARY KEY,
  nama_kegiatan TEXT NOT NULL,
  hari TEXT NOT NULL,
  jam_mulai TEXT NOT NULL,
  jam_selesai TEXT NOT NULL,
  deskripsi TEXT,
  status_aktif INTEGER DEFAULT 1,
  toleransi_menit INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 5. TABEL PRESENSI / KEHADIRAN (SCAN QR & VERIFIKASI)
CREATE TABLE IF NOT EXISTS absensi (
  absensi_id TEXT PRIMARY KEY,
  jadwal_id TEXT NOT NULL,
  nama_kegiatan TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  peserta_id TEXT NOT NULL,
  status_absensi TEXT NOT NULL CHECK(status_absensi IN ('HADIR', 'IZIN', 'ALPA')),
  keterangan_waktu TEXT NOT NULL CHECK(keterangan_waktu IN ('TEPAT_WAKTU', 'TERLAMBAT')),
  menit_keterlambatan INTEGER DEFAULT 0,
  alasan_terlambat TEXT,
  catatan TEXT,
  waktu_scan TEXT,
  waktu_server TEXT DEFAULT (datetime('now')),
  pengguna_id TEXT,
  musyrif_bertugas TEXT,
  sumber_absensi TEXT DEFAULT 'SCAN_QR',
  status_validasi TEXT DEFAULT 'SAH',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (peserta_id) REFERENCES peserta(peserta_id) ON DELETE CASCADE
);

-- 6. TABEL PERIZINAN ASRAMA (SURAT IZIN & KODE KEDATANGAN)
CREATE TABLE IF NOT EXISTS izin (
  izin_id TEXT PRIMARY KEY,
  peserta_id TEXT NOT NULL,
  jenis_izin TEXT NOT NULL CHECK(jenis_izin IN ('IZIN_PULANG', 'IZIN_SAKIT', 'IZIN_AKADEMIK', 'IZIN_ORGANISASI', 'IZIN_MENDESAK')),
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  alasan TEXT NOT NULL,
  status_persetujuan TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK(status_persetujuan IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  disetujui_oleh TEXT,
  waktu_pengajuan TEXT DEFAULT (datetime('now')),
  waktu_persetujuan TEXT,
  catatan TEXT,
  nomor_surat TEXT,
  kode_verifikasi TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (peserta_id) REFERENCES peserta(peserta_id) ON DELETE CASCADE
);

-- 7. TABEL PEMBENARAN / VERIFIKASI TERLAMBAT
CREATE TABLE IF NOT EXISTS pembenaran (
  pembenaran_id TEXT PRIMARY KEY,
  peserta_id TEXT NOT NULL,
  absensi_id TEXT,
  jadwal_id TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  alasan TEXT NOT NULL,
  bukti_lampiran TEXT,
  status_pengajuan TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK(status_pengajuan IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  disetujui_oleh TEXT,
  waktu_pengajuan TEXT DEFAULT (datetime('now')),
  waktu_tindakan TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (peserta_id) REFERENCES peserta(peserta_id) ON DELETE CASCADE
);

-- 8. TABEL MUSYRIF / PETUGAS PIKET
CREATE TABLE IF NOT EXISTS musyrif (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  kontak TEXT,
  status INTEGER DEFAULT 1,
  peran TEXT DEFAULT 'Musyrif Pendamping',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 9. TABEL CONFIG APLIKASI
CREATE TABLE IF NOT EXISTS app_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 10. TABEL AUDIT LOG AKTIVITAS
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id TEXT PRIMARY KEY,
  waktu_server TEXT DEFAULT (datetime('now')),
  pengguna_id TEXT NOT NULL,
  aksi TEXT NOT NULL,
  jenis_entitas TEXT NOT NULL,
  entitas_id TEXT NOT NULL,
  nilai_sebelum TEXT,
  nilai_sesudah TEXT,
  alasan TEXT,
  status_aksi TEXT NOT NULL
);

-- =====================================================================
-- INDEKS OPTIMASI PENCARIAN & ANTI-DUPLIKASI
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_peserta_nim ON peserta(nim);
CREATE INDEX IF NOT EXISTS idx_peserta_batch ON peserta(batch_id);
CREATE INDEX IF NOT EXISTS idx_absensi_lookup ON absensi(tanggal, jadwal_id, peserta_id);
CREATE INDEX IF NOT EXISTS idx_absensi_peserta ON absensi(peserta_id);
CREATE INDEX IF NOT EXISTS idx_izin_peserta ON izin(peserta_id);
CREATE INDEX IF NOT EXISTS idx_izin_kode ON izin(kode_verifikasi);
CREATE INDEX IF NOT EXISTS idx_pembenaran_peserta ON pembenaran(peserta_id);

-- =====================================================================
-- DATA SEED AWAL (DEFAULT USERS, PETUGAS & JADWAL RESMI)
-- =====================================================================
INSERT OR IGNORE INTO users (id, username, password_hash, nama_lengkap, role, gender, status_aktif)
VALUES 
  ('U001', 'admin', 'admin', 'Administrator Pesma UNISA', 'ADMIN', 'IKHWAN', 1),
  ('U002', 'petugas', 'petugas', 'Petugas Musyrif BIMMA', 'PETUGAS', 'IKHWAN', 1);

INSERT OR IGNORE INTO batch (id, nama, tahun, tanggal_mulai, tanggal_selesai, status_aktif)
VALUES 
  ('Batch 1', 'BIMMA Angkatan 1', '2026', '2026-01-01', '2026-12-31', 1),
  ('Batch 2', 'BIMMA Angkatan 2', '2026', '2026-06-01', '2026-12-31', 1);

INSERT OR IGNORE INTO musyrif (id, nama, kontak, status, peran)
VALUES
  ('M01', 'Ustadz Ahmad Fauzi, M.Ag', '081234567891', 1, 'Musyrif Pembina Ikhwan'),
  ('M02', 'Ustadzah Siti Aisyah, S.Pd.I', '081234567892', 1, 'Musyrifah Pembina Akhwat'),
  ('M03', 'Ustadz Muhammad Ridwan, S.Kom', '081234567893', 1, 'Musyrif Kedisiplinan & IT');

INSERT OR IGNORE INTO jadwal_kegiatan (jadwal_id, nama_kegiatan, hari, jam_mulai, jam_selesai, deskripsi, status_aktif, toleransi_menit)
VALUES
  ('J01', 'Sholat Subuh & Kuliah Subuh', 'Setiap Hari', '04:30', '06:00', 'Sholat Subuh berjamaah dan kajian keislaman di Masjid Asrama', 1, 15),
  ('J02', 'Tahsin & Tahfidz Al-Qur''an', 'Senin - Jumat', '16:00', '17:30', 'Halaqah Al-Qur''an bersama Musyrif/Musyrifah', 1, 15),
  ('J03', 'Sholat Maghrib & Isya Berjamaah', 'Setiap Hari', '18:00', '19:45', 'Sholat Maghrib, kultum santri, dan Sholat Isya berjamaah', 1, 15),
  ('J04', 'Kajian Kitab / Belajar Malam', 'Senin - Kamis', '20:00', '21:30', 'Pendalaman kitab aqidah, fiqih, dan akhlak', 1, 15);
