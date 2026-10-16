-- Additive schema changes for lossless migration from app_collections.
-- Run this migration before deploying the Worker code that performs the backfill.
ALTER TABLE batch ADD COLUMN tahun TEXT;
ALTER TABLE batch ADD COLUMN keterangan TEXT;
ALTER TABLE batch ADD COLUMN data_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE peserta ADD COLUMN data_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE izin ADD COLUMN jenis_izin TEXT;
ALTER TABLE izin ADD COLUMN waktu_mulai TEXT;
ALTER TABLE izin ADD COLUMN waktu_selesai TEXT;
ALTER TABLE izin ADD COLUMN diajukan_oleh TEXT;
ALTER TABLE izin ADD COLUMN waktu_pengajuan TEXT;
ALTER TABLE izin ADD COLUMN diputuskan_oleh TEXT;
ALTER TABLE izin ADD COLUMN waktu_keputusan TEXT;
ALTER TABLE izin ADD COLUMN catatan_admin TEXT;
ALTER TABLE izin ADD COLUMN bukti_file_id TEXT;
ALTER TABLE izin ADD COLUMN nomor_surat TEXT;
ALTER TABLE izin ADD COLUMN kode_verifikasi TEXT;
ALTER TABLE izin ADD COLUMN status_kedatangan TEXT;
ALTER TABLE izin ADD COLUMN waktu_kedatangan_kembali TEXT;
ALTER TABLE izin ADD COLUMN petugas_verifikasi TEXT;
ALTER TABLE izin ADD COLUMN catatan_kedatangan TEXT;
ALTER TABLE izin ADD COLUMN alasan_terlambat TEXT;
ALTER TABLE izin ADD COLUMN data_json TEXT NOT NULL DEFAULT '{}';
