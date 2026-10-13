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

// 3 Batch Kalender Resmi BIMMA UNISA Bandung
export const INITIAL_BATCHES: Batch[] = [
  {
    batchId: 'Batch 1',
    namaBatch: 'Batch 1 - Periode Ganjil',
    tahun: '2026/2027',
    tanggalMulai: '2026-12-05',
    tanggalSelesai: '2027-01-16',
    statusBatch: 'BELUM_AKTIF',
    keterangan: '5 Desember 2026 – 16 Januari 2027',
    agendaKalender: [
      { namaAgenda: 'Kedatangan Mahasantri Batch 1', durasi: '1 Hari', tanggalRentang: '5 Desember 2026' },
      { namaAgenda: 'Placement Test BTAQ & Praktek Ibadah', durasi: '2 Hari', tanggalRentang: '6 Desember - 7 Desember 2026' },
      { namaAgenda: 'Kegiatan Bimbingan', durasi: '4 Minggu', tanggalRentang: '8 Desember 2026 - 8 Januari 2027' },
      { namaAgenda: 'Libur Natal', durasi: '2 Hari', tanggalRentang: '24 Desember - 25 Desember 2026' },
      { namaAgenda: 'Libur Tahun Baru', durasi: '2 Hari', tanggalRentang: '31 Desember 2026 – 1 Januari 2027' },
      { namaAgenda: 'Penilaian Praktik Ibadah', durasi: '2 Hari', tanggalRentang: '11 Januari – 12 Januari 2027' },
      { namaAgenda: 'Penilaian Praktik BTAQ', durasi: '2 Hari', tanggalRentang: '13 Januari – 14 Januari 2027' },
      { namaAgenda: 'Kepulangan Batch 1', durasi: '1 Hari', tanggalRentang: '16 Januari 2027' },
    ],
  },
  {
    batchId: 'Batch 2',
    namaBatch: 'Batch 2 - Periode Genap',
    tahun: '2026/2027',
    tanggalMulai: '2027-04-10',
    tanggalSelesai: '2027-05-15',
    statusBatch: 'BELUM_AKTIF',
    keterangan: '10 April 2027 – 15 Mei 2027',
    agendaKalender: [
      { namaAgenda: 'Kedatangan Mahasantri Batch 2', durasi: '1 Hari', tanggalRentang: '10 April 2027' },
      { namaAgenda: 'Placement Test BTAQ & Praktek Ibadah', durasi: '2 Hari', tanggalRentang: '11 April – 12 April 2027' },
      { namaAgenda: 'Kegiatan Bimbingan', durasi: '4 Minggu', tanggalRentang: '13 April – 8 Mei 2027' },
      { namaAgenda: 'Penilaian Praktik Ibadah', durasi: '2 Hari', tanggalRentang: '10 Mei – 11 Mei 2027' },
      { namaAgenda: 'Penilaian Praktik BTAQ', durasi: '2 Hari', tanggalRentang: '12 Mei – 13 Mei 2027' },
      { namaAgenda: 'Kepulangan Batch 2', durasi: '1 Hari', tanggalRentang: '15 Mei 2027' },
    ],
  },
  {
    batchId: 'Batch 3',
    namaBatch: 'Batch 3 - Periode Akhir',
    tahun: '2026/2027',
    tanggalMulai: '2027-06-05',
    tanggalSelesai: '2027-07-10',
    statusBatch: 'BELUM_AKTIF',
    keterangan: '5 Juni 2027 – 10 Juli 2027',
    agendaKalender: [
      { namaAgenda: 'Kedatangan Mahasantri Batch 3', durasi: '1 Hari', tanggalRentang: '5 Juni 2027' },
      { namaAgenda: 'Placement Test BTAQ & Praktek Ibadah', durasi: '2 Hari', tanggalRentang: '6 Juni – 7 Juni 2027' },
      { namaAgenda: 'Kegiatan Bimbingan', durasi: '4 Minggu', tanggalRentang: '8 Juni – 3 Juli 2027' },
      { namaAgenda: 'Penilaian Praktik Ibadah', durasi: '2 Hari', tanggalRentang: '5 Juli – 6 Juli 2027' },
      { namaAgenda: 'Penilaian Praktik BTAQ', durasi: '2 Hari', tanggalRentang: '7 Juli – 8 Juli 2027' },
      { namaAgenda: 'Kepulangan Batch 3', durasi: '1 Hari', tanggalRentang: '10 Juli 2027' },
    ],
  },
];

// Jadwal Kegiatan Resmi UNISA (Kegiatan Pagi & Kegiatan Malam)
export const INITIAL_JADWAL: JadwalKegiatan[] = [
  {
    jadwalId: 'J001',
    namaKegiatan: 'Kegiatan Pagi',
    jamMulai: '05:00',
    jamSelesai: '06:30',
    toleransiBukaAwal: 20,
    toleransiTutupAkhir: 20,
    wajib: true,
    statusAktif: true,
    keterangan: 'Kegiatan pagi mahasantri BIMMA (Subuh & Halaqah Pagi)',
  },
  {
    jadwalId: 'J002',
    namaKegiatan: 'Kegiatan Malam',
    jamMulai: '18:00',
    jamSelesai: '21:00',
    toleransiBukaAwal: 20,
    toleransiTutupAkhir: 20,
    wajib: true,
    statusAktif: true,
    keterangan: 'Kegiatan malam mahasantri BIMMA (Maghrib, Isya, & Bimbingan Malam)',
  },
];

// Data Peserta Mahasantri Bersih (Tanpa data uji coba)
export const INITIAL_PESERTA: Peserta[] = [];

// Data Absensi Bersih (Tanpa data uji coba)
export const INITIAL_ABSENSI: Absensi[] = [];

// Data Pengajuan Izin Bersih (Tanpa data uji coba)
export const INITIAL_IZIN: Izin[] = [];

// Data Pembenaran / Koreksi Bersih (Tanpa data uji coba)
export const INITIAL_PEMBENARAN: Pembenaran[] = [];

// Data Audit Log Bersih
export const INITIAL_AUDIT: AuditLog[] = [];
