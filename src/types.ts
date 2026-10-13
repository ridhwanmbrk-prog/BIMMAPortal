// TypeScript types definition for BIMMA Attendance UNISA Bandung

export type UserRole = 'ADMIN' | 'PETUGAS' | 'PESERTA';

export interface User {
  id: string;
  namaLengkap: string;
  username: string;
  role: UserRole;
  statusAktif: boolean;
  pesertaId?: string; // Khusus role PESERTA (menautkan ke data santri)
  nim?: string;       // NIM Mahasantri
  gender?: 'IKHWAN' | 'AKHWAT';
  programStudi?: string;
  batchId?: string;
}

export interface Peserta {
  pesertaId: string;
  nim: string;
  namaLengkap: string;
  batchId: string;
  programStudi: string;
  fakultas?: string;
  nomorWhatsApp?: string;
  email?: string;
  alamat?: string;
  tanggalMasuk: string;
  statusPeserta: 'AKTIF' | 'IZIN' | 'BELUM_AKTIF' | 'SELESAI' | 'ALPA' | 'NONAKTIF' | 'LULUS' | 'MUTASI';
  fotoProfil?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgendaBatch {
  namaAgenda: string;
  durasi: string;
  tanggalRentang: string;
  keterangan?: string;
}

export interface Batch {
  batchId: string;
  namaBatch: string;
  tahun: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  statusBatch: 'AKTIF' | 'BELUM_AKTIF' | 'SELESAI' | 'PERSIAPAN';
  keterangan?: string;
  agendaKalender: AgendaBatch[];
}

export interface JadwalKegiatan {
  jadwalId: string;
  namaKegiatan: string;
  jamMulai: string; // HH:mm
  jamSelesai: string; // HH:mm
  toleransiBukaAwal: number; // menit
  toleransiTutupAkhir: number; // menit
  wajib: boolean;
  statusAktif: boolean; // Tombol toggle aktif/nonaktif di ujung tabel
  keterangan?: string;
}

export type StatusAbsensi = 'HADIR' | 'IZIN' | 'ALPA';
export type SumberAbsensi = 'SCAN_QR' | 'IZIN_SISTEM' | 'PEMBENARAN_ADMIN' | 'MANUAL';
export type KeteranganWaktu = 'TEPAT_WAKTU' | 'TERLAMBAT';

export interface Absensi {
  absensiId: string;
  jadwalId: string; // Acuan langsung ke JadwalKegiatan
  namaKegiatan: string;
  tanggal: string; // YYYY-MM-DD
  pesertaId: string;
  statusAbsensi: StatusAbsensi;
  keteranganWaktu?: KeteranganWaktu;
  menitKeterlambatan?: number;
  alasanTerlambat?: string;
  catatan?: string;
  waktuScan?: string;
  waktuServer: string;
  penggunaId: string;
  musyrifBertugas?: string;
  sumberAbsensi: SumberAbsensi;
  statusValidasi: 'SAH' | 'DIKOREKSI' | 'DIBATALKAN';
  alasanKoreksi?: string;
  referensiAsalId?: string;
  createdAt: string;
  updatedAt: string;
}

export type JenisIzin = 'IZIN_PULANG' | 'SAKIT' | 'KEPERLUAN_SYARI' | 'IZIN_KHUSUS';
export type StatusPersetujuan = 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';

export interface Izin {
  izinId: string;
  pesertaId: string;
  jenisIzin: JenisIzin;
  waktuMulai: string;
  waktuSelesai: string;
  alasan: string;
  buktiFileId?: string;
  diajukanOleh: string;
  waktuPengajuan: string;
  statusPersetujuan: StatusPersetujuan;
  diputuskanOleh?: string;
  waktuKeputusan?: string;
  catatanAdmin?: string;
  nomorSurat?: string; // Format: BIMMA/IZN/YYYY/XXX
  kodeVerifikasi?: string; // QR & Unique verification code: VRF-IZN-XXXX
  statusKedatangan?: 'BELUM_KEMBALI' | 'SUDAH_KEMBALI' | 'TERLAMBAT';
  waktuKedatanganKembali?: string;
  petugasVerifikasi?: string;
  catatanKedatangan?: string;
  alasanTerlambat?: string;
}

export interface Pembenaran {
  pembenaranId: string;
  pesertaId: string;
  jadwalId: string;
  namaKegiatan: string;
  tanggalKejadian: string;
  alasan: string;
  diajukanOleh: string;
  waktuPengajuan: string;
  statusPersetujuan: StatusPersetujuan;
  diputuskanOleh?: string;
  waktuKeputusan?: string;
  catatanAdmin?: string;
  statusAbsensiSebelum?: StatusAbsensi;
  statusAbsensiSesudah?: StatusAbsensi;
}

export interface Musyrif {
  id: string;
  nama: string;
  gender: 'IKHWAN' | 'AKHWAT';
  status: boolean;
  nim?: string;
  jurusan?: string;
  angkatan?: string;
  nomorWhatsApp?: string;
  email?: string;
}

export interface AuditLog {
  auditId: string;
  waktuServer: string;
  penggunaId: string;
  aksi: string;
  jenisEntitas: string;
  entitasId: string;
  nilaiSebelum?: string;
  nilaiSesudah?: string;
  alasan?: string;
  statusAksi: 'BERHASIL' | 'GAGAL' | 'DITOLAK';
}

export interface AppConfig {
  backendUrl: string;
  namaKampus: string;
  namaPesma: string;
  alamatPesma: string;
  zonaWaktu: string;
  logoUrl: string;
  toleransiDefault: number;
}
