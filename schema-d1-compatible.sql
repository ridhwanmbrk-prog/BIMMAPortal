-- BIMMA Portal: schema kompatibel untuk Cloudflare D1
-- File ini dibuat sebagai kandidat perbaikan; review sebelum dijalankan di database.
-- Tidak menyisipkan akun/password default. Jangan expose endpoint SQL publik.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nama_lengkap TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PETUGAS',
  gender TEXT,
  status_aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batch (
  id TEXT PRIMARY KEY,
  batch_id TEXT UNIQUE,
  nama TEXT,
  nama_batch TEXT,
  tahun TEXT,
  tanggal_mulai TEXT,
  tanggal_selesai TEXT,
  status_aktif INTEGER DEFAULT 1,
  status_batch TEXT,
  keterangan TEXT,
  agenda_kalender TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS peserta (
  peserta_id TEXT PRIMARY KEY,
  nim TEXT UNIQUE NOT NULL,
  nama_lengkap TEXT NOT NULL,
  gender TEXT,
  program_studi TEXT,
  batch_id TEXT,
  kamar TEXT,
  status_peserta TEXT DEFAULT 'AKTIF',
  nomor_whatsapp TEXT,
  email TEXT,
  alamat TEXT,
  qr_code TEXT,
  tanggal_masuk TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jadwal_kegiatan (
  jadwal_id TEXT PRIMARY KEY,
  nama_kegiatan TEXT NOT NULL,
  hari TEXT,
  jam_mulai TEXT,
  jam_selesai TEXT,
  deskripsi TEXT,
  status_aktif INTEGER DEFAULT 1,
  toleransi_menit INTEGER DEFAULT 0,
  toleransi_buka_awal INTEGER DEFAULT 0,
  toleransi_tutup_akhir INTEGER DEFAULT 0,
  wajib INTEGER DEFAULT 1,
  keterangan TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS absensi (
  absensi_id TEXT PRIMARY KEY,
  jadwal_id TEXT,
  nama_kegiatan TEXT,
  tanggal TEXT NOT NULL,
  peserta_id TEXT NOT NULL,
  status_absensi TEXT NOT NULL DEFAULT 'HADIR',
  keterangan_waktu TEXT DEFAULT 'TEPAT_WAKTU',
  menit_keterlambatan INTEGER DEFAULT 0,
  alasan_terlambat TEXT,
  catatan TEXT,
  waktu_scan TEXT,
  waktu_server TEXT DEFAULT (datetime('now')),
  pengguna_id TEXT,
  musyrif_bertugas TEXT,
  sumber_absensi TEXT DEFAULT 'SCAN_QR',
  status_validasi TEXT DEFAULT 'SAH',
  alasan_koreksi TEXT,
  referensi_asal_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (peserta_id) REFERENCES peserta(peserta_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS izin (
  izin_id TEXT PRIMARY KEY,
  peserta_id TEXT NOT NULL,
  jenis_izin TEXT,
  tanggal_mulai TEXT,
  tanggal_selesai TEXT,
  waktu_mulai TEXT,
  waktu_selesai TEXT,
  alasan TEXT,
  bukti_file_id TEXT,
  diajukan_oleh TEXT,
  waktu_pengajuan TEXT DEFAULT (datetime('now')),
  status_persetujuan TEXT DEFAULT 'MENUNGGU',
  diputuskan_oleh TEXT,
  waktu_keputusan TEXT,
  disetujui_oleh TEXT,
  waktu_persetujuan TEXT,
  catatan_admin TEXT,
  catatan TEXT,
  nomor_surat TEXT,
  kode_verifikasi TEXT,
  status_kedatangan TEXT,
  waktu_kedatangan_kembali TEXT,
  petugas_verifikasi TEXT,
  catatan_kedatangan TEXT,
  alasan_terlambat TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (peserta_id) REFERENCES peserta(peserta_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pembenaran (
  pembenaran_id TEXT PRIMARY KEY,
  peserta_id TEXT NOT NULL,
  absensi_id TEXT,
  jadwal_id TEXT,
  nama_kegiatan TEXT,
  tanggal TEXT,
  tanggal_kejadian TEXT,
  alasan TEXT,
  bukti_lampiran TEXT,
  diajukan_oleh TEXT,
  waktu_pengajuan TEXT DEFAULT (datetime('now')),
  status_persetujuan TEXT DEFAULT 'MENUNGGU',
  status_pengajuan TEXT DEFAULT 'MENUNGGU',
  diputuskan_oleh TEXT,
  disetujui_oleh TEXT,
  waktu_keputusan TEXT,
  waktu_tindakan TEXT,
  catatan_admin TEXT,
  status_absensi_sebelum TEXT,
  status_absensi_sesudah TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (peserta_id) REFERENCES peserta(peserta_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS musyrif (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  gender TEXT,
  status INTEGER DEFAULT 1,
  nim TEXT,
  jurusan TEXT,
  angkatan TEXT,
  nomor_whatsapp TEXT,
  email TEXT,
  kontak TEXT,
  peran TEXT DEFAULT 'Musyrif Pendamping',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id TEXT PRIMARY KEY,
  waktu_server TEXT DEFAULT (datetime('now')),
  pengguna_id TEXT,
  aksi TEXT,
  jenis_entitas TEXT,
  entitas_id TEXT,
  nilai_sebelum TEXT,
  nilai_sesudah TEXT,
  alasan TEXT,
  status_aksi TEXT
);

CREATE INDEX IF NOT EXISTS idx_peserta_nim ON peserta(nim);
CREATE INDEX IF NOT EXISTS idx_peserta_batch ON peserta(batch_id);
CREATE INDEX IF NOT EXISTS idx_absensi_lookup ON absensi(tanggal, jadwal_id, peserta_id);
CREATE INDEX IF NOT EXISTS idx_absensi_peserta ON absensi(peserta_id);
CREATE INDEX IF NOT EXISTS idx_izin_peserta ON izin(peserta_id);
CREATE INDEX IF NOT EXISTS idx_izin_kode ON izin(kode_verifikasi);
CREATE INDEX IF NOT EXISTS idx_pembenaran_peserta ON pembenaran(peserta_id);
