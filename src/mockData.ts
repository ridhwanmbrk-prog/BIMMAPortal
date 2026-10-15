import { Peserta, Batch, JadwalKegiatan, Musyrif, AppConfig, Izin, Pembenaran, Absensi, AuditLog } from './types';

export const INITIAL_CONFIG: AppConfig = {
  backendUrl: '',
  namaKampus: "Universitas 'Aisyiyah Bandung",
  namaPesma: 'Pesantren Mahasiswa (PESMA) UNISA Bandung',
  alamatPesma: 'Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275',
  zonaWaktu: 'Asia/Jakarta',
  logoUrl: '',
  toleransiDefault: 15,
};

// Data Petugas Awal Kosong (Dikelola oleh Admin via menu Kelola Petugas)
export const INITIAL_MUSYRIF: Musyrif[] = [];

// 3 Batch Kalender Resmi BIMMA UNISA Bandung (Mulai dari nol, ditambahkan oleh Admin via Kelola Batch)
export const INITIAL_BATCHES: Batch[] = [];

// Jadwal Kegiatan Resmi UNISA (Mulai dari nol, ditambahkan oleh Admin via Kelola Jadwal)
export const INITIAL_JADWAL: JadwalKegiatan[] = [];

// Data Peserta Mahasantri Bersih (Mulai dari nol)
export const INITIAL_PESERTA: Peserta[] = [];

// Data Absensi Bersih (Mulai dari nol)
export const INITIAL_ABSENSI: Absensi[] = [];

// Data Pengajuan Izin Bersih (Mulai dari nol)
export const INITIAL_IZIN: Izin[] = [];

// Data Pembenaran / Koreksi Bersih (Mulai dari nol)
export const INITIAL_PEMBENARAN: Pembenaran[] = [];

// Data Audit Log Bersih
export const INITIAL_AUDIT: AuditLog[] = [];

