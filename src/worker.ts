
function safeUser(row: any): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    namaLengkap: row.nama_lengkap ?? row.username ?? '',
    role: row.role,
    gender: row.gender ?? '',
    statusAktif: row.status_aktif === 'AKTIF',
  };
}

function mapPeserta(row: any): Record<string, unknown> {
  return {
    id: row.peserta_id,
    pesertaId: row.peserta_id,
    nim: row.nim ?? '',
    namaLengkap: row.nama_lengkap ?? '',
    nama: row.nama_lengkap ?? '',
    jurusan: row.program_studi ?? '',
    programStudi: row.program_studi ?? '',
    fakultas: row.fakultas ?? '',
    gender: row.gender ?? '',
    batchId: row.batch_id ?? '',
    kamar: row.kamar ?? '',
    nomorWhatsapp: row.nomor_whatsapp ?? '',
    email: row.email ?? '',
    alamat: row.alamat ?? '',
    tanggalMasuk: row.tanggal_masuk ?? '',
    status: row.status_peserta ?? '',
    statusPeserta: row.status_peserta ?? '',
    qrCode: row.qr_code ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapAbsensi(row: any): Record<string, unknown> {
  return {
    id: row.absensi_id,
    absensiId: row.absensi_id,
    pesertaId: row.peserta_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? '',
    tanggal: row.tanggal ?? '',
    status: row.status_absensi ?? '',
    statusAbsensi: row.status_absensi ?? '',
    keteranganWaktu: row.keterangan_waktu ?? '',
    menitKeterlambatan: row.menit_keterlambatan ?? 0,
    alasanTerlambat: row.alasan_terlambat ?? '',
    catatan: row.catatan ?? '',
    waktuScan: row.waktu_scan ?? '',
    waktuServer: row.waktu_server ?? '',
    penggunaId: row.pengguna_id ?? '',
    musyrifBertugas: row.musyrif_bertugas ?? '',
    sumberAbsensi: row.sumber_absensi ?? 'SCAN_QR',
    statusValidasi: row.status_validasi ?? 'SAH',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapJadwal(row: any): Record<string, unknown> {
  return {
    id: row.jadwal_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? '',
    hari: row.hari ?? '',
    jamMulai: row.jam_mulai ?? '',
    jamSelesai: row.jam_selesai ?? '',
    deskripsi: row.deskripsi ?? '',
    toleransiMenit: row.toleransi_menit ?? 0,
    toleransiBukaAwal: row.toleransi_menit ?? 0,
    toleransiTutupAkhir: row.toleransi_menit ?? 0,
    wajib: true,
    status: row.status_aktif ?? '',
    statusAktif: row.status_aktif === 'AKTIF',
  };
}

function mapBatch(row: any): Record<string, unknown> {
  return {
    id: row.id,
    batchId: row.id,
    nama: row.nama ?? '',
    namaBatch: row.nama ?? '',
    tahun: row.tahun ?? '',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    status: row.status_aktif ?? '',
    statusBatch: row.status_aktif ?? '',
    createdAt: row.created_at ?? '',
  };
}

function mapIzin(row: any): Record<string, unknown> {
  return {
    id: row.izin_id,
    izinId: row.izin_id,
    pesertaId: row.peserta_id,
    jenisIzin: row.jenis_izin ?? '',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    waktuMulai: row.tanggal_mulai ?? '',
    waktuSelesai: row.tanggal_selesai ?? '',
    alasan: row.alasan ?? '',
    status: row.status_persetujuan ?? '',
    statusPersetujuan: row.status_persetujuan ?? '',
    disetujuiOleh: row.disetujui_oleh ?? '',
    waktuPengajuan: row.waktu_pengajuan ?? '',
    waktuPersetujuan: row.waktu_persetujuan ?? '',
    catatan: row.catatan ?? '',
    nomorSurat: row.nomor_surat ?? '',
    kodeVerifikasi: row.kode_verifikasi ?? '',
  };
}

function mapPembenaran(row: any): Record<string, unknown> {
  return {
    id: row.pembenaran_id,
    pembenaranId: row.pembenaran_id,
    pesertaId: row.peserta_id,
    absensiId: row.absensi_id ?? '',
    jadwalId: row.jadwal_id ?? '',
    tanggal: row.tanggal ?? '',
    alasan: row.alasan ?? '',
    buktiLampiran: row.bukti_lampiran ?? '',
    status: row.status_pengajuan ?? '',
    statusPengajuan: row.status_pengajuan ?? '',
    disetujuiOleh: row.disetujui_oleh ?? '',
    waktuPengajuan: row.waktu_pengajuan ?? '',
    waktuTindakan: row.waktu_tindakan ?? '',
    createdAt: row.created_at ?? '',
  };
}

function safeUser(row: any): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    namaLengkap: row.nama_lengkap ?? row.username ?? '',
    role: row.role,
    gender: row.gender ?? '',
    statusAktif: row.status_aktif === 'AKTIF',
  };
}

function mapPeserta(row: any): Record<string, unknown> {
  return {
    id: row.peserta_id,
    pesertaId: row.peserta_id,
    nim: row.nim ?? '',
    namaLengkap: row.nama_lengkap ?? '',
    nama: row.nama_lengkap ?? '',
    jurusan: row.program_studi ?? '',
    programStudi: row.program_studi ?? '',
    fakultas: row.fakultas ?? '',
    gender: row.gender ?? '',
    batchId: row.batch_id ?? '',
    kamar: row.kamar ?? '',
    nomorWhatsapp: row.nomor_whatsapp ?? '',
    email: row.email ?? '',
    alamat: row.alamat ?? '',
    tanggalMasuk: row.tanggal_masuk ?? '',
    status: row.status_peserta ?? '',
    statusPeserta: row.status_peserta ?? '',
    qrCode: row.qr_code ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapAbsensi(row: any): Record<string, unknown> {
  return {
    id: row.absensi_id,
    absensiId: row.absensi_id,
    pesertaId: row.peserta_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? '',
    tanggal: row.tanggal ?? '',
    status: row.status_absensi ?? '',
    statusAbsensi: row.status_absensi ?? '',
    keteranganWaktu: row.keterangan_waktu ?? '',
    menitKeterlambatan: row.menit_keterlambatan ?? 0,
    alasanTerlambat: row.alasan_terlambat ?? '',
    catatan: row.catatan ?? '',
    waktuScan: row.waktu_scan ?? '',
    waktuServer: row.waktu_server ?? '',
    penggunaId: row.pengguna_id ?? '',
    musyrifBertugas: row.musyrif_bertugas ?? '',
    sumberAbsensi: row.sumber_absensi ?? 'SCAN_QR',
    statusValidasi: row.status_validasi ?? 'SAH',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapJadwal(row: any): Record<string, unknown> {
  return {
    id: row.jadwal_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? '',
    hari: row.hari ?? '',
    jamMulai: row.jam_mulai ?? '',
    jamSelesai: row.jam_selesai ?? '',
    deskripsi: row.deskripsi ?? '',
    toleransiMenit: row.toleransi_menit ?? 0,
    toleransiBukaAwal: row.toleransi_menit ?? 0,
    toleransiTutupAkhir: row.toleransi_menit ?? 0,
    wajib: true,
    status: row.status_aktif ?? '',
    statusAktif: row.status_aktif === 'AKTIF',
  };
}

function mapBatch(row: any): Record<string, unknown> {
  return {
    id: row.id,
    batchId: row.id,
    nama: row.nama ?? '',
    namaBatch: row.nama ?? '',
    tahun: row.tahun ?? '',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    status: row.status_aktif ?? '',
    statusBatch: row.status_aktif ?? '',
    createdAt: row.created_at ?? '',
  };
}

function mapIzin(row: any): Record<string, unknown> {
  return {
    id: row.izin_id,
    izinId: row.izin_id,
    pesertaId: row.peserta_id,
    jenisIzin: row.jenis_izin ?? '',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    waktuMulai: row.tanggal_mulai ?? '',
    waktuSelesai: row.tanggal_selesai ?? '',
    alasan: row.alasan ?? '',
    status: row.status_persetujuan ?? '',
    statusPersetujuan: row.status_persetujuan ?? '',
    disetujuiOleh: row.disetujui_oleh ?? '',
    waktuPengajuan: row.waktu_pengajuan ?? '',
    waktuPersetujuan: row.waktu_persetujuan ?? '',
    catatan: row.catatan ?? '',
    nomorSurat: row.nomor_surat ?? '',
    kodeVerifikasi: row.kode_verifikasi ?? '',
  };
}

function mapPembenaran(row: any): Record<string, unknown> {
  return {
    id: row.pembenaran_id,
    pembenaranId: row.pembenaran_id,
    pesertaId: row.peserta_id,
    absensiId: row.absensi_id ?? '',
    jadwalId: row.jadwal_id ?? '',
    tanggal: row.tanggal ?? '',
    alasan: row.alasan ?? '',
    buktiLampiran: row.bukti_lampiran ?? '',
    status: row.status_pengajuan ?? '',
    statusPengajuan: row.status_pengajuan ?? '',
    disetujuiOleh: row.disetujui_oleh ?? '',
    waktuPengajuan: row.waktu_pengajuan ?? '',
    waktuTindakan: row.waktu_tindakan ?? '',
    createdAt: row.created_at ?? '',
  };
}
