// Storage, API synchronization, QR Code creation, and Schedule Time Window Validation

import {
  Peserta, Batch, JadwalKegiatan, Musyrif,
  AppConfig, Izin, Pembenaran, Absensi, AuditLog, User
} from './types';
import {
  INITIAL_CONFIG, INITIAL_MUSYRIF, INITIAL_BATCHES,
  INITIAL_JADWAL, INITIAL_PESERTA,
  INITIAL_ABSENSI, INITIAL_IZIN, INITIAL_PEMBENARAN, INITIAL_AUDIT
} from './mockData';

const STORAGE_KEYS = {
  USER: 'bimma_current_user',
  CONFIG: 'bimma_config',
  PESERTA: 'bimma_peserta',
  BATCH: 'bimma_batch',
  JADWAL: 'bimma_jadwal',
  ABSENSI: 'bimma_absensi',
  IZIN: 'bimma_izin',
  PEMBENARAN: 'bimma_pembenaran',
  MUSYRIF: 'bimma_musyrif',
  AUDIT: 'bimma_audit',
  ACTIVE_MUSYRIF: 'bimma_active_musyrif',
  THEME_MODE: 'bimma_theme_mode',
};

const CLEAN_STORAGE_VERSION = 'bimma_clean_production_v3';

export function initLocalStorageIfEmpty() {
  if (localStorage.getItem('bimma_clean_marker') !== CLEAN_STORAGE_VERSION) {
    // Bersihkan semua data uji coba dan update batch & santri dengan status otomatis
    localStorage.removeItem(STORAGE_KEYS.PESERTA);
    localStorage.removeItem(STORAGE_KEYS.BATCH);
    localStorage.removeItem(STORAGE_KEYS.ABSENSI);
    localStorage.removeItem(STORAGE_KEYS.IZIN);
    localStorage.removeItem(STORAGE_KEYS.PEMBENARAN);
    localStorage.removeItem(STORAGE_KEYS.MUSYRIF);
    localStorage.removeItem(STORAGE_KEYS.AUDIT);
    localStorage.setItem('bimma_clean_marker', CLEAN_STORAGE_VERSION);
  }

  if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(INITIAL_CONFIG));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PESERTA)) {
    localStorage.setItem(STORAGE_KEYS.PESERTA, JSON.stringify(INITIAL_PESERTA));
  }
  if (!localStorage.getItem(STORAGE_KEYS.BATCH)) {
    localStorage.setItem(STORAGE_KEYS.BATCH, JSON.stringify(INITIAL_BATCHES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.JADWAL)) {
    localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(INITIAL_JADWAL));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ABSENSI)) {
    localStorage.setItem(STORAGE_KEYS.ABSENSI, JSON.stringify(INITIAL_ABSENSI));
  }
  if (!localStorage.getItem(STORAGE_KEYS.IZIN)) {
    localStorage.setItem(STORAGE_KEYS.IZIN, JSON.stringify(INITIAL_IZIN));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PEMBENARAN)) {
    localStorage.setItem(STORAGE_KEYS.PEMBENARAN, JSON.stringify(INITIAL_PEMBENARAN));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MUSYRIF)) {
    localStorage.setItem(STORAGE_KEYS.MUSYRIF, JSON.stringify(INITIAL_MUSYRIF));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(INITIAL_AUDIT));
  }

  // Sinkronisasi status batch dan santri secara otomatis sesuai tanggal saat ini
  syncDatabaseState();

  // Pastikan tema terkunci pada nuansa Putih & Hijau UNISA (tanpa mode gelap)
  document.documentElement.classList.remove('dark');
}

// User Session
export function getCurrentUser(): User | null {
  const data = localStorage.getItem(STORAGE_KEYS.USER);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.USER);
  } else {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
}

// Config
export function getConfig(): AppConfig {
  initLocalStorageIfEmpty();
  const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
  return raw ? JSON.parse(raw) : INITIAL_CONFIG;
}

export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  const updated = { ...current, ...cfg };
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
  return updated;
}

// Active Musyrif
export function getActiveMusyrif(): Musyrif | null {
  const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_MUSYRIF);
  return raw ? JSON.parse(raw) : null;
}

export function setActiveMusyrif(musyrif: Musyrif | null) {
  if (!musyrif) {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_MUSYRIF);
  } else {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MUSYRIF, JSON.stringify(musyrif));
  }
}

// Generic Getter & Setter
export function getItems<T>(key: keyof typeof STORAGE_KEYS): T[] {
  initLocalStorageIfEmpty();
  const raw = localStorage.getItem(STORAGE_KEYS[key]);
  return raw ? JSON.parse(raw) : [];
}

export function setItems<T>(key: keyof typeof STORAGE_KEYS, items: T[]) {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(items));
}

// Add Audit Log
export function addAuditLog(entry: {
  penggunaId: string;
  aksi: string;
  jenisEntitas: string;
  entitasId: string;
  nilaiSebelum?: string;
  nilaiSesudah?: string;
  alasan?: string;
  statusAksi: 'BERHASIL' | 'GAGAL' | 'DITOLAK';
}) {
  const logs = getItems<AuditLog>('AUDIT');
  const newLog: AuditLog = {
    auditId: `LOG${String(logs.length + 1).padStart(6, '0')}`,
    waktuServer: new Date().toISOString(),
    ...entry,
  };
  logs.unshift(newLog);
  setItems('AUDIT', logs.slice(0, 500));
}

// Validasi Jam Kegiatan Otomatis (Tanpa perlu nunggu sesi dimulai)
export function isWithinScheduleTime(jadwal: JadwalKegiatan): { valid: boolean; reason?: string } {
  if (!jadwal.statusAktif) {
    return {
      valid: false,
      reason: `Kegiatan ${jadwal.namaKegiatan} sedang dinonaktifkan oleh pengurus.`,
    };
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = jadwal.jamMulai.split(':').map(Number);
  const [endH, endM] = jadwal.jamSelesai.split(':').map(Number);

  const startTotal = startH * 60 + startM - (jadwal.toleransiBukaAwal || 15);
  const endTotal = endH * 60 + endM + (jadwal.toleransiTutupAkhir || 15);

  if (nowMinutes < startTotal) {
    const sJam = Math.floor(startTotal / 60).toString().padStart(2, '0');
    const sMenit = (startTotal % 60).toString().padStart(2, '0');
    return {
      valid: false,
      reason: `Belum masuk jam kegiatan ${jadwal.namaKegiatan} (${jadwal.jamMulai} - ${jadwal.jamSelesai} WIB). Absensi baru bisa dilakukan mulai ${sJam}:${sMenit} WIB.`,
    };
  }

  if (nowMinutes > endTotal) {
    return {
      valid: false,
      reason: `Waktu absensi ${jadwal.namaKegiatan} telah lewat (${jadwal.jamMulai} - ${jadwal.jamSelesai} WIB + batas toleransi).`,
    };
  }

  return { valid: true };
}

// =========================================================================
// SISTEM EVALUASI BATCH OTOMATIS BERDASARKAN TANGGAL HARI INI (STRICT BY DATE)
// =========================================================================

export function evaluateBatchStatus(
  batch: Batch,
  referenceDate?: string
): 'AKTIF' | 'BELUM_AKTIF' | 'SELESAI' {
  const today = referenceDate || new Date().toISOString().split('T')[0];

  if (today < batch.tanggalMulai) {
    return 'BELUM_AKTIF';
  } else if (today >= batch.tanggalMulai && today <= batch.tanggalSelesai) {
    return 'AKTIF';
  } else {
    return 'SELESAI';
  }
}

export function getActiveBatchToday(batches?: Batch[], referenceDate?: string): Batch {
  const bList = batches && batches.length > 0 ? batches : getItems<Batch>('BATCH');
  const today = referenceDate || new Date().toISOString().split('T')[0];

  // 1. Cek apakah ada batch yang strictly aktif hari ini
  const strictlyActive = bList.find(
    (b) => today >= b.tanggalMulai && today <= b.tanggalSelesai
  );
  if (strictlyActive) return strictlyActive;

  // 2. Jika tidak ada yang sedang berjalan hari ini, cari batch terdekat berikutnya
  const upcoming = bList.find((b) => today < b.tanggalMulai);
  if (upcoming) return upcoming;

  return bList[0] || INITIAL_BATCHES[0];
}

export function getBatchStatusInfo(batch: Batch, referenceDate?: string): {
  status: 'AKTIF' | 'BELUM_AKTIF' | 'SELESAI';
  isActiveToday: boolean;
  label: string;
  badgeClass: string;
  badgeText: string;
  keteranganTenggat: string;
} {
  const today = referenceDate || new Date().toISOString().split('T')[0];
  const evalStatus = evaluateBatchStatus(batch, today);

  if (evalStatus === 'BELUM_AKTIF') {
    return {
      status: 'BELUM_AKTIF',
      isActiveToday: false,
      label: 'Belum Aktif',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
      badgeText: 'BELUM AKTIF',
      keteranganTenggat: `Dimulai pada ${batch.tanggalMulai} (Tenggat: ${batch.keterangan || batch.tanggalSelesai})`,
    };
  } else if (evalStatus === 'AKTIF') {
    return {
      status: 'AKTIF',
      isActiveToday: true,
      label: 'Sedang Berlangsung',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      badgeText: 'AKTIF',
      keteranganTenggat: `Tenggat hingga ${batch.tanggalSelesai}`,
    };
  } else {
    return {
      status: 'SELESAI',
      isActiveToday: false,
      label: 'Sudah Selesai',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
      badgeText: 'SELESAI',
      keteranganTenggat: `Berakhir pada ${batch.tanggalSelesai}`,
    };
  }
}

// SINKRONISASI OTOMATIS DATABASE DI LATAR BELAKANG
export function syncDatabaseState(referenceDate?: string): void {
  const today = referenceDate || new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  // 1. Sinkronisasi status batch sesuai tanggal hari ini
  const rawBatches = localStorage.getItem(STORAGE_KEYS.BATCH);
  let batchList: Batch[] = rawBatches ? JSON.parse(rawBatches) : INITIAL_BATCHES;
  let batchChanged = false;

  batchList = batchList.map((b) => {
    const calculated = evaluateBatchStatus(b, today);
    if (b.statusBatch !== calculated) {
      batchChanged = true;
      return { ...b, statusBatch: calculated };
    }
    return b;
  });

  if (batchChanged) {
    localStorage.setItem(STORAGE_KEYS.BATCH, JSON.stringify(batchList));
  }

  // 2. Sinkronisasi status izin & status santri (Peserta)
  const rawPeserta = localStorage.getItem(STORAGE_KEYS.PESERTA);
  const rawIzin = localStorage.getItem(STORAGE_KEYS.IZIN);

  if (rawPeserta) {
    const pList: Peserta[] = JSON.parse(rawPeserta);
    const iList: Izin[] = rawIzin ? JSON.parse(rawIzin) : [];
    let pesertaChanged = false;

    // Map batch status
    const batchStatusMap: Record<string, 'AKTIF' | 'BELUM_AKTIF' | 'SELESAI'> = {};
    batchList.forEach((b) => {
      batchStatusMap[b.batchId] = evaluateBatchStatus(b, today);
    });

    const updatedPeserta = pList.map((p) => {
      // Prioritas 1: Jika santri memiliki Izin yang telah di-ACC dan belum kembali
      const activeIzin = iList.find(
        (iz) =>
          iz.pesertaId === p.pesertaId &&
          iz.statusPersetujuan === 'DISETUJUI' &&
          iz.statusKedatangan !== 'SUDAH_KEMBALI'
      );

      if (activeIzin) {
        // Santri berstatus IZIN selama belum diverifikasi kedatangannya
        if (p.statusPeserta !== 'IZIN') {
          pesertaChanged = true;
          return { ...p, statusPeserta: 'IZIN' as const, updatedAt: nowIso };
        }
        return p;
      }

      // Prioritas 2: Status Batch santri
      const bStatus = batchStatusMap[p.batchId];
      if (bStatus === 'BELUM_AKTIF') {
        if (p.statusPeserta !== 'BELUM_AKTIF' && p.statusPeserta !== 'NONAKTIF') {
          pesertaChanged = true;
          return { ...p, statusPeserta: 'BELUM_AKTIF' as const, updatedAt: nowIso };
        }
      } else if (bStatus === 'SELESAI') {
        if (p.statusPeserta !== 'SELESAI' && p.statusPeserta !== 'NONAKTIF' && p.statusPeserta !== 'LULUS') {
          pesertaChanged = true;
          return { ...p, statusPeserta: 'SELESAI' as const, updatedAt: nowIso };
        }
      } else if (bStatus === 'AKTIF') {
        if (p.statusPeserta !== 'AKTIF' && p.statusPeserta !== 'NONAKTIF') {
          pesertaChanged = true;
          return { ...p, statusPeserta: 'AKTIF' as const, updatedAt: nowIso };
        }
      }

      return p;
    });

    if (pesertaChanged) {
      localStorage.setItem(STORAGE_KEYS.PESERTA, JSON.stringify(updatedPeserta));
    }
  }
}

// BATCH MANAGEMENT (TAMBAH, EDIT, HAPUS BATCH DENGAN AGENDA KEGIATAN)
export function saveBatch(batchData: Batch): { success: boolean; message: string } {
  const batches = getItems<Batch>('BATCH');
  const evaluatedStatus = evaluateBatchStatus(batchData);
  const toSave: Batch = {
    ...batchData,
    statusBatch: evaluatedStatus,
  };

  const idx = batches.findIndex((b) => b.batchId.toLowerCase() === batchData.batchId.toLowerCase());
  if (idx !== -1) {
    batches[idx] = toSave;
  } else {
    batches.push(toSave);
  }

  setItems('BATCH', batches);
  syncDatabaseState();

  addAuditLog({
    penggunaId: getCurrentUser()?.id || 'ADMIN',
    aksi: idx !== -1 ? 'UPDATE_BATCH' : 'TAMBAH_BATCH',
    jenisEntitas: 'BATCH',
    entitasId: toSave.batchId,
    nilaiSesudah: `${toSave.namaBatch} (${toSave.tanggalMulai} s/d ${toSave.tanggalSelesai})`,
    statusAksi: 'BERHASIL',
  });

  return { success: true, message: `Batch ${toSave.batchId} berhasil disimpan!` };
}

export function deleteBatch(batchId: string): { success: boolean; message: string } {
  const batches = getItems<Batch>('BATCH');
  const pesertaList = getItems<Peserta>('PESERTA');

  const pesertaInBatch = pesertaList.filter((p) => p.batchId === batchId);
  if (pesertaInBatch.length > 0) {
    return {
      success: false,
      message: `Tidak dapat menghapus ${batchId} karena masih ada ${pesertaInBatch.length} santri yang terdaftar di batch ini!`,
    };
  }

  const filtered = batches.filter((b) => b.batchId !== batchId);
  setItems('BATCH', filtered);
  syncDatabaseState();

  addAuditLog({
    penggunaId: getCurrentUser()?.id || 'ADMIN',
    aksi: 'HAPUS_BATCH',
    jenisEntitas: 'BATCH',
    entitasId: batchId,
    statusAksi: 'BERHASIL',
  });

  return { success: true, message: `Batch ${batchId} berhasil dihapus!` };
}

// =========================================================================
// SISTEM IZIN, SURAT DIGITAL BUKTI KEDATANGAN & VERIFIKASI KEMBALI KE ASRAMA
// =========================================================================

export function approveIzin(
  izinId: string,
  approvedBy: string,
  catatanAdmin?: string
): { success: boolean; izin?: Izin; message: string } {
  const izinList = getItems<Izin>('IZIN');
  const pesertaList = getItems<Peserta>('PESERTA');

  const idx = izinList.findIndex((i) => i.izinId === izinId);
  if (idx === -1) {
    return { success: false, message: 'Data izin tidak ditemukan!' };
  }

  const targetIzin = izinList[idx];
  const nowIso = new Date().toISOString();
  const year = new Date().getFullYear();
  const seq = String(idx + 1).padStart(4, '0');
  const randKey = Math.random().toString(36).substring(2, 6).toUpperCase();

  // Buat nomor surat resmi & kode unik verifikasi kedatangan
  const nomorSurat = targetIzin.nomorSurat || `BIMMA/IZN/${year}/${seq}`;
  const kodeVerifikasi = targetIzin.kodeVerifikasi || `VRF-IZN-${seq}-${randKey}`;

  targetIzin.statusPersetujuan = 'DISETUJUI';
  targetIzin.diputuskanOleh = approvedBy;
  targetIzin.waktuKeputusan = nowIso;
  targetIzin.catatanAdmin = catatanAdmin || targetIzin.catatanAdmin;
  targetIzin.nomorSurat = nomorSurat;
  targetIzin.kodeVerifikasi = kodeVerifikasi;
  targetIzin.statusKedatangan = 'BELUM_KEMBALI';

  izinList[idx] = targetIzin;
  setItems('IZIN', izinList);

  // Ubah status santri menjadi IZIN di database peserta
  const pIdx = pesertaList.findIndex((p) => p.pesertaId === targetIzin.pesertaId);
  if (pIdx !== -1) {
    pesertaList[pIdx].statusPeserta = 'IZIN';
    pesertaList[pIdx].updatedAt = nowIso;
    setItems('PESERTA', pesertaList);
  }

  addAuditLog({
    penggunaId: approvedBy,
    aksi: 'ACC_SURAT_IZIN',
    jenisEntitas: 'IZIN',
    entitasId: izinId,
    nilaiSesudah: `ACC Izin: ${nomorSurat} (${kodeVerifikasi})`,
    statusAksi: 'BERHASIL',
  });

  return {
    success: true,
    izin: targetIzin,
    message: `Izin resmi disetujui! Surat izin & QR verifikasi kedatangan telah diterbitkan.`,
  };
}

export function rejectIzin(
  izinId: string,
  rejectedBy: string,
  catatanAdmin?: string
): { success: boolean; message: string } {
  const izinList = getItems<Izin>('IZIN');
  const idx = izinList.findIndex((i) => i.izinId === izinId);
  if (idx === -1) {
    return { success: false, message: 'Data izin tidak ditemukan!' };
  }

  izinList[idx].statusPersetujuan = 'DITOLAK';
  izinList[idx].diputuskanOleh = rejectedBy;
  izinList[idx].waktuKeputusan = new Date().toISOString();
  izinList[idx].catatanAdmin = catatanAdmin;

  setItems('IZIN', izinList);
  syncDatabaseState();

  addAuditLog({
    penggunaId: rejectedBy,
    aksi: 'TOLAK_SURAT_IZIN',
    jenisEntitas: 'IZIN',
    entitasId: izinId,
    statusAksi: 'BERHASIL',
  });

  return { success: true, message: 'Pengajuan izin telah ditolak.' };
}

// VERIFIKASI KEDATANGAN SANTRI KEMBALI KE ASRAMA
export function verifyKedatanganSantri(
  kodeOrNimOrId: string,
  namaPetugas: string,
  catatan?: string,
  alasanTerlambat?: string
): { success: boolean; message: string; izin?: Izin; peserta?: Peserta; isOverdue?: boolean; lateString?: string } {
  const clean = kodeOrNimOrId.trim().toUpperCase();
  const izinList = getItems<Izin>('IZIN');
  const pesertaList = getItems<Peserta>('PESERTA');

  // Cari izin yang cocok berdasarkan kode verifikasi, nomor surat, izinId, atau NIM/pesertaId
  const targetPeserta = pesertaList.find(
    (p) => p.nim.toUpperCase() === clean || p.pesertaId.toUpperCase() === clean
  );

  const targetIzin = izinList.find((iz) => {
    if (iz.statusPersetujuan !== 'DISETUJUI') return false;
    if (iz.statusKedatangan === 'SUDAH_KEMBALI') return false;

    if (iz.kodeVerifikasi && iz.kodeVerifikasi.toUpperCase() === clean) return true;
    if (iz.izinId.toUpperCase() === clean) return true;
    if (iz.nomorSurat && iz.nomorSurat.toUpperCase() === clean) return true;
    if (targetPeserta && iz.pesertaId === targetPeserta.pesertaId) return true;
    return false;
  });

  if (!targetIzin) {
    return {
      success: false,
      message: `Tidak ditemukan surat izin aktif yang memerlukan verifikasi kedatangan untuk '${clean}'!`,
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const deadline = new Date(targetIzin.waktuSelesai);
  const isOverdue = now.getTime() > deadline.getTime();
  let lateString = '';

  if (isOverdue) {
    const diffMs = now.getTime() - deadline.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const lateH = Math.floor(diffMins / 60);
    const lateM = diffMins % 60;
    lateString = lateH > 0 ? `${lateH} jam ${lateM} menit` : `${diffMins} menit`;
    targetIzin.statusKedatangan = 'TERLAMBAT';
    targetIzin.alasanTerlambat = alasanTerlambat || targetIzin.alasanTerlambat || 'Terlambat kembali ke asrama';
    targetIzin.catatanKedatangan = `${catatan || ''} [MELEBIHI TENGGAT: Terlambat ${lateString} dari batas ${targetIzin.waktuSelesai.replace('T', ' ')} WIB${alasanTerlambat ? ' • Alasan: ' + alasanTerlambat : ''}]`;
  } else {
    targetIzin.statusKedatangan = 'SUDAH_KEMBALI';
    targetIzin.catatanKedatangan = catatan || 'Kembali tepat waktu ke asrama sesuai izin.';
  }

  targetIzin.waktuKedatanganKembali = nowIso;
  targetIzin.petugasVerifikasi = namaPetugas;

  // Simpan izin
  setItems('IZIN', izinList);

  // KEMBALIKAN STATUS SANTRI MENJADI AKTIF KEMBALI
  const pIndex = pesertaList.findIndex((p) => p.pesertaId === targetIzin.pesertaId);
  let updatedPeserta: Peserta | undefined;

  if (pIndex !== -1) {
    pesertaList[pIndex].statusPeserta = 'AKTIF';
    pesertaList[pIndex].updatedAt = nowIso;
    setItems('PESERTA', pesertaList);
    updatedPeserta = pesertaList[pIndex];
  }

  addAuditLog({
    penggunaId: getCurrentUser()?.id || 'PETUGAS',
    aksi: 'VERIFIKASI_KEDATANGAN',
    jenisEntitas: 'IZIN',
    entitasId: targetIzin.izinId,
    nilaiSesudah: `KEDATANGAN ${isOverdue ? 'TERLAMBAT (' + lateString + ')' : 'TEPAT WAKTU'}: ${updatedPeserta?.namaLengkap || targetIzin.pesertaId} oleh ${namaPetugas}`,
    alasan: alasanTerlambat || targetIzin.catatanKedatangan,
    statusAksi: 'BERHASIL',
  });

  return {
    success: true,
    izin: targetIzin,
    peserta: updatedPeserta,
    isOverdue,
    lateString,
    message: isOverdue
      ? `Kedatangan santri ${updatedPeserta?.namaLengkap || ''} tercatat MELEBIHI TENGGAT (${lateString}). Status kembali AKTIF dengan catatan keterlambatan.`
      : `Alhamdulillah! Kedatangan santri ${updatedPeserta?.namaLengkap || ''} TEPAT WAKTU diverifikasi. Status santri kembali AKTIF.`,
  };
}

// DAFTAR SANTRI YANG PERLU VERIFIKASI KEDATANGAN
export function getPendingKedatanganIzin(): {
  izin: Izin;
  peserta?: Peserta;
  isOverdue: boolean;
  deadlineString: string;
}[] {
  const izinList = getItems<Izin>('IZIN');
  const pesertaList = getItems<Peserta>('PESERTA');
  const now = new Date();

  const pesertaMap: Record<string, Peserta> = {};
  pesertaList.forEach((p) => {
    pesertaMap[p.pesertaId] = p;
  });

  const pending = izinList.filter(
    (iz) => iz.statusPersetujuan === 'DISETUJUI' && iz.statusKedatangan !== 'SUDAH_KEMBALI' && iz.statusKedatangan !== 'TERLAMBAT'
  );

  return pending.map((iz) => {
    const deadline = new Date(iz.waktuSelesai);
    const isOverdue = now > deadline;
    return {
      izin: iz,
      peserta: pesertaMap[iz.pesertaId],
      isOverdue,
      deadlineString: iz.waktuSelesai.replace('T', ' ') + ' WIB',
    };
  });
}

// Scanner Processing Engine: Mengacu Langsung ke Jadwal Kegiatan (Bukan Sesi)
export interface ScanResult {
  success: boolean;
  code: 'HADIR_BERHASIL' | 'DUPLIKAT' | 'TIDAK_DITEMUKAN' | 'NONAKTIF' | 'DI_LUAR_JADWAL';
  message: string;
  peserta?: Peserta;
  waktuScan?: string;
  namaKegiatan?: string;
  keteranganWaktu?: 'TEPAT_WAKTU' | 'TERLAMBAT';
  menitKeterlambatan?: number;
  alasanTerlambat?: string;
  catatan?: string;
  absensiId?: string;
}

export async function processQrScan(
  nim: string,
  jadwalId?: string,
  alasanTerlambatCustom?: string
): Promise<ScanResult> {
  const activeMusyrif = getActiveMusyrif();
  const user = getCurrentUser();

  if (!activeMusyrif) {
    return {
      success: false,
      code: 'DI_LUAR_JADWAL',
      message: 'Musyrif/Musyrifah bertugas belum dipilih! Silakan pilih nama petugas terlebih dahulu.',
    };
  }

  const pesertaList = getItems<Peserta>('PESERTA');
  const jadwalList = getItems<JadwalKegiatan>('JADWAL');
  const absensiList = getItems<Absensi>('ABSENSI');

  const cleanNim = nim.trim();
  const targetPeserta = pesertaList.find((p) => p.nim === cleanNim || p.pesertaId === cleanNim);

  if (!targetPeserta) {
    return {
      success: false,
      code: 'TIDAK_DITEMUKAN',
      message: `NIM/ID '${cleanNim}' tidak terdaftar dalam database santri!`,
    };
  }

  if (targetPeserta.statusPeserta !== 'AKTIF') {
    let customMsg = `Santri ${targetPeserta.namaLengkap} berstatus ${targetPeserta.statusPeserta}! Absensi ditolak.`;
    if (targetPeserta.statusPeserta === 'IZIN') {
      customMsg = `Santri ${targetPeserta.namaLengkap} sedang berstatus IZIN (belum diverifikasi kedatangan kembali ke asrama)! Silakan verifikasi surat izinnya terlebih dahulu di scanner.`;
    } else if (targetPeserta.statusPeserta === 'BELUM_AKTIF') {
      customMsg = `Batch santri ${targetPeserta.namaLengkap} (${targetPeserta.batchId}) belum aktif untuk kegiatan saat ini!`;
    }

    return {
      success: false,
      code: 'NONAKTIF',
      peserta: targetPeserta,
      message: customMsg,
    };
  }

  // Cari jadwal kegiatan target
  let targetJadwal: JadwalKegiatan | undefined;
  if (jadwalId) {
    targetJadwal = jadwalList.find((j) => j.jadwalId === jadwalId);
  } else {
    // Cari jadwal kegiatan aktif yang jamnya cocok saat ini
    targetJadwal = jadwalList.find((j) => j.statusAktif && isWithinScheduleTime(j).valid);
  }

  if (!targetJadwal) {
    return {
      success: false,
      code: 'DI_LUAR_JADWAL',
      peserta: targetPeserta,
      message: 'Tidak ada kegiatan saat ini! Presensi santri otomatis dibuka saat masuk jam kegiatan BIMMA.',
    };
  }

  // Validasi waktu batas kegiatan
  const timeCheck = isWithinScheduleTime(targetJadwal);
  if (!timeCheck.valid) {
    return {
      success: false,
      code: 'DI_LUAR_JADWAL',
      peserta: targetPeserta,
      message: timeCheck.reason || 'Di luar waktu kegiatan yang ditentukan!',
    };
  }

  // ANTI-DUPLIKAT MUTLAK: 1 santri hanya boleh 1x absen untuk 1 kegiatan di hari yang sama
  const todayStr = new Date().toISOString().split('T')[0];
  const existing = absensiList.find(
    (a) =>
      a.tanggal === todayStr &&
      a.jadwalId === targetJadwal!.jadwalId &&
      a.pesertaId === targetPeserta.pesertaId
  );

  if (existing) {
    return {
      success: false,
      code: 'DUPLIKAT',
      peserta: targetPeserta,
      namaKegiatan: targetJadwal.namaKegiatan,
      waktuScan: existing.waktuScan,
      message: `SUDAH TERCATAT PADA KEGIATAN ${targetJadwal.namaKegiatan.toUpperCase()} HARI INI (${existing.waktuScan?.split('T')[1]?.slice(0, 5) || ''} WIB)!`,
    };
  }

  // Evaluasi Waktu: Tepat Waktu vs Melebihi Waktu Tenggat (Terlambat)
  const now = new Date();
  const [startH, startM] = targetJadwal.jamMulai.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let keteranganWaktu: 'TEPAT_WAKTU' | 'TERLAMBAT' = 'TEPAT_WAKTU';
  let menitKeterlambatan = 0;
  let catatanWaktu = `Hadir tepat waktu sebelum batas jadwal (${targetJadwal.jamMulai} WIB)`;

  if (nowMinutes > startMinutes) {
    keteranganWaktu = 'TERLAMBAT';
    menitKeterlambatan = nowMinutes - startMinutes;
    catatanWaktu = `Terlambat ${menitKeterlambatan} menit melebihi jam mulai kegiatan (${targetJadwal.jamMulai} WIB)`;
  }

  // Simpan Absensi Baru
  const nowIso = now.toISOString();
  const newAbsensiId = `A${String(absensiList.length + 1).padStart(6, '0')}`;
  const newAbsensi: Absensi = {
    absensiId: newAbsensiId,
    jadwalId: targetJadwal.jadwalId,
    namaKegiatan: targetJadwal.namaKegiatan,
    tanggal: todayStr,
    pesertaId: targetPeserta.pesertaId,
    statusAbsensi: 'HADIR',
    keteranganWaktu,
    menitKeterlambatan,
    alasanTerlambat: alasanTerlambatCustom || (keteranganWaktu === 'TERLAMBAT' ? 'Melebihi waktu tenggat' : ''),
    catatan: catatanWaktu,
    waktuScan: nowIso,
    waktuServer: nowIso,
    penggunaId: user?.id || 'U002',
    musyrifBertugas: activeMusyrif.nama,
    sumberAbsensi: 'SCAN_QR',
    statusValidasi: 'SAH',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  absensiList.push(newAbsensi);
  setItems('ABSENSI', absensiList);

  addAuditLog({
    penggunaId: user?.id || 'U002',
    aksi: 'SCAN_QR',
    jenisEntitas: 'ABSENSI',
    entitasId: newAbsensi.absensiId,
    nilaiSebelum: 'NONE',
    nilaiSesudah: `HADIR (${keteranganWaktu}${menitKeterlambatan > 0 ? ' +' + menitKeterlambatan + 'm' : ''}) - ${targetPeserta.namaLengkap} (${targetJadwal.namaKegiatan})`,
    alasan: `Musyrif: ${activeMusyrif.nama}. ${catatanWaktu}`,
    statusAksi: 'BERHASIL',
  });

  return {
    success: true,
    code: 'HADIR_BERHASIL',
    peserta: targetPeserta,
    namaKegiatan: targetJadwal.namaKegiatan,
    waktuScan: nowIso,
    keteranganWaktu,
    menitKeterlambatan,
    alasanTerlambat: newAbsensi.alasanTerlambat,
    catatan: catatanWaktu,
    absensiId: newAbsensiId,
    message: keteranganWaktu === 'TERLAMBAT'
      ? `HADIR TERLAMBAT (${menitKeterlambatan} Menit): ${targetPeserta.namaLengkap} melebihi waktu tenggat ${targetJadwal.jamMulai} WIB!`
      : `HADIR TEPAT WAKTU: ${targetPeserta.namaLengkap} (${targetJadwal.namaKegiatan})`,
  };
}

// Perbarui Alasan Keterlambatan Absensi Santri
export function updateAbsensiAlasan(
  absensiId: string,
  alasan: string,
  catatanTambahan?: string
): { success: boolean; message: string } {
  const absensiList = getItems<Absensi>('ABSENSI');
  const idx = absensiList.findIndex((a) => a.absensiId === absensiId);
  if (idx === -1) {
    return { success: false, message: 'Data absensi tidak ditemukan!' };
  }

  absensiList[idx].alasanTerlambat = alasan;
  if (catatanTambahan) {
    absensiList[idx].catatan = `${absensiList[idx].catatan || ''} [Alasan: ${alasan} - ${catatanTambahan}]`;
  } else {
    absensiList[idx].catatan = `${absensiList[idx].catatan || ''} [Alasan: ${alasan}]`;
  }
  absensiList[idx].updatedAt = new Date().toISOString();
  setItems('ABSENSI', absensiList);

  addAuditLog({
    penggunaId: getCurrentUser()?.id || 'PETUGAS',
    aksi: 'CATAT_ALASAN_TERLAMBAT',
    jenisEntitas: 'ABSENSI',
    entitasId: absensiId,
    nilaiSesudah: `Alasan Terlambat: ${alasan}`,
    statusAksi: 'BERHASIL',
  });

  return { success: true, message: 'Alasan keterlambatan berhasil disimpan!' };
}

// Update Profil Pribadi Mahasiswa (Dari Form Mandiri Mahasiswa)
export function updateProfilMahasiswa(nimOrId: string, data: { email: string; nomorWhatsApp: string; alamat: string }): { success: boolean; message: string; peserta?: Peserta } {
  const pesertaList = getItems<Peserta>('PESERTA');
  const cleanKey = nimOrId.trim();

  const idx = pesertaList.findIndex((p) => p.nim === cleanKey || p.pesertaId === cleanKey);
  if (idx === -1) {
    return { success: false, message: 'NIM atau ID santri tidak ditemukan dalam database!' };
  }

  const p = pesertaList[idx];
  p.email = data.email.trim();
  p.nomorWhatsApp = data.nomorWhatsApp.trim();
  p.alamat = data.alamat.trim();
  p.updatedAt = new Date().toISOString();

  pesertaList[idx] = p;
  setItems('PESERTA', pesertaList);

  addAuditLog({
    penggunaId: 'MANDIRI_MAHASISWA',
    aksi: 'UPDATE_BIODATA_MANDIRI',
    jenisEntitas: 'PESERTA',
    entitasId: p.nim,
    nilaiSesudah: `Update WA: ${p.nomorWhatsApp}, Email: ${p.email}`,
    statusAksi: 'BERHASIL',
  });

  return { success: true, message: 'Data pribadi berhasil diperbarui dan terintegrasi ke database pusat!', peserta: p };
}

// Deteksi Kegiatan Yang Sedang Berlangsung Berdasarkan Jam Realtime
export function getKegiatanSedangBerlangsung(customList?: JadwalKegiatan[]): {
  kegiatan: JadwalKegiatan | null;
  status: 'BERLANGSUNG' | 'SEGERA' | 'SELESAI';
  keterangan: string;
} {
  const list = customList || getItems<JadwalKegiatan>('JADWAL');
  const aktifList = list.filter((j) => j.statusAktif);

  if (aktifList.length === 0) {
    return { kegiatan: null, status: 'SELESAI', keterangan: 'Tidak ada kegiatan aktif' };
  }

  // 1. Cek kegiatan yang waktu sekarang berada dalam rentang (+ toleransi)
  for (const j of aktifList) {
    const check = isWithinScheduleTime(j);
    if (check.valid) {
      return {
        kegiatan: j,
        status: 'BERLANGSUNG',
        keterangan: `Sedang Berlangsung (${j.jamMulai} - ${j.jamSelesai} WIB)`,
      };
    }
  }

  // 2. Jika tidak ada yang pas sedang berlangsung, cari jadwal terdekat hari ini
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let closestNext: JadwalKegiatan | null = null;
  let minDiffNext = Infinity;

  let closestPast: JadwalKegiatan | null = null;
  let minDiffPast = Infinity;

  for (const j of aktifList) {
    const [h, m] = j.jamMulai.split(':').map(Number);
    const startMins = h * 60 + m;

    if (startMins > nowMinutes) {
      const diff = startMins - nowMinutes;
      if (diff < minDiffNext) {
        minDiffNext = diff;
        closestNext = j;
      }
    } else {
      const diff = nowMinutes - startMins;
      if (diff < minDiffPast) {
        minDiffPast = diff;
        closestPast = j;
      }
    }
  }

  if (closestNext) {
    return {
      kegiatan: closestNext,
      status: 'SEGERA',
      keterangan: `Jadwal Berikutnya (${closestNext.jamMulai} WIB)`,
    };
  }

  // Default ke jadwal terakhir yang telah lewat hari ini
  const fallback = closestPast || aktifList[0];
  return {
    kegiatan: fallback,
    status: 'SELESAI',
    keterangan: `Jadwal Hari Ini: ${fallback.namaKegiatan} (${fallback.jamMulai} - ${fallback.jamSelesai} WIB)`,
  };
}

// Login Otomatis Peserta / Mahasantri Menggunakan QR Code atau NIM
export function loginPesertaByNimOrId(nimOrId: string): { success: boolean; user?: User; message: string } {
  const clean = nimOrId.trim();
  const pesertaList = getItems<Peserta>('PESERTA');
  const target = pesertaList.find((p) => p.nim === clean || p.pesertaId === clean);

  if (!target) {
    return {
      success: false,
      message: `Santri dengan NIM/ID "${clean}" tidak ditemukan dalam sistem!`,
    };
  }

  if (target.statusPeserta !== 'AKTIF') {
    return {
      success: false,
      message: `Akun santri ${target.namaLengkap} berstatus ${target.statusPeserta}. Hubungi admin.`,
    };
  }

  const user: User = {
    id: `USER_${target.pesertaId}`,
    namaLengkap: target.namaLengkap,
    username: target.nim,
    role: 'PESERTA',
    statusAktif: true,
    pesertaId: target.pesertaId,
    nim: target.nim,
    programStudi: target.programStudi,
    batchId: target.batchId,
  };

  setCurrentUser(user);
  addAuditLog({
    penggunaId: user.id,
    aksi: 'LOGIN_QR_PESERTA',
    jenisEntitas: 'PESERTA',
    entitasId: target.pesertaId,
    nilaiSesudah: `Login Mahasantri: ${target.namaLengkap} (${target.nim})`,
    statusAksi: 'BERHASIL',
  });

  return {
    success: true,
    user,
    message: `Selamat datang, ${target.namaLengkap}!`,
  };
}

// Musyrif CRUD Helpers (Khusus Admin)
export function saveMusyrif(musyrif: Musyrif): void {
  const list = getItems<Musyrif>('MUSYRIF');
  const idx = list.findIndex((m) => m.id === musyrif.id);
  if (idx !== -1) {
    list[idx] = musyrif;
  } else {
    list.push(musyrif);
  }
  setItems('MUSYRIF', list);
}

export function deleteMusyrif(id: string): void {
  const list = getItems<Musyrif>('MUSYRIF');
  const filtered = list.filter((m) => m.id !== id);
  setItems('MUSYRIF', filtered);
}

// Absensi Edit / Update Helpers (Khusus Admin)
export function updateAbsensiRecord(absensiId: string, updates: Partial<Absensi>): void {
  const list = getItems<Absensi>('ABSENSI');
  const idx = list.findIndex((a) => a.absensiId === absensiId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    setItems('ABSENSI', list);
  }
}

export function deleteAbsensiRecord(absensiId: string): void {
  const list = getItems<Absensi>('ABSENSI');
  const filtered = list.filter((a) => a.absensiId !== absensiId);
  setItems('ABSENSI', filtered);
}

