import { getBusinessDateString, getBusinessTimeMinutes } from './utils/date';
import { isScheduleApplicableOnDate } from './utils/schedule';
// Storage, API synchronization, QR Code creation, and Schedule Time Window Validation

import {
  Peserta, Batch, JadwalKegiatan, Musyrif,
  AppConfig, Izin, Pembenaran, Absensi, AuditLog, User, UserAccount
} from './types';
import {
  INITIAL_CONFIG, INITIAL_MUSYRIF, INITIAL_BATCHES,
  INITIAL_JADWAL, INITIAL_PESERTA,
  INITIAL_ABSENSI, INITIAL_IZIN, INITIAL_PEMBENARAN, INITIAL_AUDIT
} from './mockData';
import {
  D1_CONFIG,
  d1LoginPeserta,
  d1LoginStaff,
  d1FetchUsers,
  d1SaveUser,
  d1DeleteUser,
  d1ImportLegacyUsers,
  checkD1Status,
  clearD1Session,
  D1Status,
  d1FetchCollections,
  d1SaveCollection,
  D1CollectionKey,
  d1ValidateSession,
  d1UpdateParticipantBiodata,
} from './services/d1Storage';

export const INITIAL_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'U001',
    username: 'admin',
    password: '',
    passwordHash: '',
    namaLengkap: 'Administrator Pesma UNISA',
    role: 'ADMIN',
    gender: 'IKHWAN',
    statusAktif: true,
  },
  {
    id: 'U002',
    username: 'petugas',
    password: '',
    passwordHash: '',
    namaLengkap: 'Petugas Musyrif BIMMA',
    role: 'PETUGAS',
    gender: 'IKHWAN',
    statusAktif: true,
  },
];

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
  USERS_ACCOUNTS: 'bimma_users_accounts',
};

const CLEAN_STORAGE_VERSION = 'bimma_clean_zero_data_v6';
let localStorageInitialized = false;
const dataCache = new Map<string, string>();
const legacyStorageKeys = new Set<string>();
const DATA_LOCAL_KEYS = [
  STORAGE_KEYS.CONFIG, STORAGE_KEYS.PESERTA, STORAGE_KEYS.BATCH, STORAGE_KEYS.JADWAL,
  STORAGE_KEYS.ABSENSI, STORAGE_KEYS.IZIN, STORAGE_KEYS.PEMBENARAN, STORAGE_KEYS.MUSYRIF,
  STORAGE_KEYS.AUDIT, STORAGE_KEYS.USERS_ACCOUNTS,
];
function readCachedRaw(key: string): string | null { return dataCache.get(key) ?? null; }
function writeCachedRaw(key: string, value: unknown): void { dataCache.set(key, JSON.stringify(value)); }
const pendingD1Writes = new Map<D1CollectionKey, unknown>();
let flushingD1Writes = false;
let pendingD1RetryTimer: number | null = null;
let consecutiveD1Failures = 0;
let lastD1WriteError: string | null = null;
let lastD1MigrationWarning: string | null = null;
export function getD1WriteError(): string | null { return lastD1WriteError; }
export function getD1MigrationWarning(): string | null { return lastD1MigrationWarning; }
function notifyD1MigrationWarning(message: string): void {
  lastD1MigrationWarning = message;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bimma:d1-migration-warning', { detail: { warning: message } }));
}
function notifyD1WriteError(message: string | null): void {
  lastD1WriteError = message;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bimma:d1-write-status', { detail: { error: message } }));
}
const D1_WRITEABLE_KEYS: Partial<Record<keyof typeof STORAGE_KEYS, D1CollectionKey>> = {
  CONFIG: 'CONFIG', PESERTA: 'PESERTA', BATCH: 'BATCH', JADWAL: 'JADWAL',
  ABSENSI: 'ABSENSI', IZIN: 'IZIN', PEMBENARAN: 'PEMBENARAN',
  MUSYRIF: 'MUSYRIF', AUDIT: 'AUDIT',
};

export function initLocalStorageIfEmpty() {
  if (typeof window === 'undefined' || localStorageInitialized) return;
  localStorageInitialized = true;

  // Import an existing browser copy into memory once as a migration source. New
  // writes do not go to localStorage; after successful D1 hydration the old keys
  // are removed. UI preferences/session identity may remain in browser storage.
  const defaults: Array<[string, unknown]> = [
    [STORAGE_KEYS.CONFIG, INITIAL_CONFIG], [STORAGE_KEYS.PESERTA, INITIAL_PESERTA],
    [STORAGE_KEYS.BATCH, INITIAL_BATCHES], [STORAGE_KEYS.JADWAL, INITIAL_JADWAL],
    [STORAGE_KEYS.ABSENSI, INITIAL_ABSENSI], [STORAGE_KEYS.IZIN, INITIAL_IZIN],
    [STORAGE_KEYS.PEMBENARAN, INITIAL_PEMBENARAN], [STORAGE_KEYS.MUSYRIF, INITIAL_MUSYRIF],
    [STORAGE_KEYS.AUDIT, INITIAL_AUDIT], [STORAGE_KEYS.USERS_ACCOUNTS, INITIAL_USER_ACCOUNTS],
  ];
  for (const [key, fallback] of defaults) {
    const legacy = localStorage.getItem(key);
    if (legacy !== null) legacyStorageKeys.add(key);
    dataCache.set(key, legacy ?? JSON.stringify(fallback));
  }
  document.documentElement.classList.remove('dark');
}


function initialCollectionValue(key: D1CollectionKey): unknown {
  const storageKeyByCollection: Record<D1CollectionKey, string> = {
    CONFIG: STORAGE_KEYS.CONFIG, PESERTA: STORAGE_KEYS.PESERTA, BATCH: STORAGE_KEYS.BATCH,
    JADWAL: STORAGE_KEYS.JADWAL, ABSENSI: STORAGE_KEYS.ABSENSI, IZIN: STORAGE_KEYS.IZIN,
    PEMBENARAN: STORAGE_KEYS.PEMBENARAN, MUSYRIF: STORAGE_KEYS.MUSYRIF, AUDIT: STORAGE_KEYS.AUDIT,
  };
  const storageKey = storageKeyByCollection[key];
  if (legacyStorageKeys.has(storageKey)) {
    if (key === 'CONFIG') return getConfig();
    return getItems<any>(key as keyof typeof STORAGE_KEYS);
  }
  // Keep configuration defaults, but never seed production D1 with mock/demo rows
  // merely because a new browser has no legacy local data.
  if (key === 'CONFIG') return INITIAL_CONFIG;
  return [];
}

function clearLegacyBusinessStorage(clearUserAccounts: boolean): void {
  for (const key of DATA_LOCAL_KEYS) {
    if (key === STORAGE_KEYS.USERS_ACCOUNTS && !clearUserAccounts) continue;
    localStorage.removeItem(key);
  }
}

async function flushD1Writes(): Promise<void> {
  if (flushingD1Writes) return;
  if (pendingD1RetryTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingD1RetryTimer);
    pendingD1RetryTimer = null;
  }
  flushingD1Writes = true;
  try {
    // Serialize writes globally and coalesce rapid changes to the same collection.
    while (pendingD1Writes.size > 0) {
      const next = pendingD1Writes.entries().next().value as [D1CollectionKey, unknown] | undefined;
      if (!next) break;
      const [collection, value] = next;
      pendingD1Writes.delete(collection);
      const result = await d1SaveCollection(collection, value);
      if (!result.success) {
        // A newer value may have been queued while this request was in flight;
        // never replace that newer value with this failed older snapshot.
        if (!pendingD1Writes.has(collection)) pendingD1Writes.set(collection, value);
        const message = `${collection} belum tersimpan ke D1: ${result.message}`;
        console.error(`[D1] ${message}`);
        notifyD1WriteError(message);
        consecutiveD1Failures += 1;
        // Do not retry rate limiting/auth/schema/client errors automatically.
        // Retrying those errors creates more Workers invocations without fixing
        // the cause. Transient server/network failures get at most two retries.
        const permanentOrRateLimited = /\((?:400|401|403|404|409|413|429)\)/.test(result.message);
        const retryAllowed = !permanentOrRateLimited && consecutiveD1Failures < 3;
        if (retryAllowed && typeof window !== 'undefined' && pendingD1RetryTimer === null) {
          const retryDelay = consecutiveD1Failures === 1 ? 15000 : 45000;
          pendingD1RetryTimer = window.setTimeout(() => {
            pendingD1RetryTimer = null;
            void flushD1Writes();
          }, retryDelay);
        }
        break;
      }
      consecutiveD1Failures = 0;
      notifyD1WriteError(null);
    }
  } finally {
    flushingD1Writes = false;
  }
}

function queueD1Write(collection: D1CollectionKey, value: unknown): void {
  pendingD1Writes.set(collection, value);
  // A new user change is a new explicit attempt; clear any stale retry timer.
  consecutiveD1Failures = 0;
  if (pendingD1RetryTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingD1RetryTimer);
    pendingD1RetryTimer = null;
  }
  void flushD1Writes();
}

/** Load the server's canonical copy before rendering authenticated modules.
 * On the very first admin/staff sign-in, existing browser data is imported once
 * only when app_collections is completely empty. Subsequent loads always hydrate
 * from D1; a failed D1 request is reported instead of silently falling back.
 */
async function performSyncWithCloudflareD1(role: User['role'] = 'ADMIN'): Promise<{ success: boolean; message: string }> {
  const session = await d1ValidateSession();
  if (!session.success) return session;

  const fetched = await d1FetchCollections();
  if (!fetched.success || !fetched.collections) {
    return { success: false, message: fetched.message || 'Gagal membaca data dari D1.' };
  }

  const keyMap: Record<string, keyof typeof STORAGE_KEYS> = {
    CONFIG: 'CONFIG', PESERTA: 'PESERTA', BATCH: 'BATCH', JADWAL: 'JADWAL',
    ABSENSI: 'ABSENSI', IZIN: 'IZIN', PEMBENARAN: 'PEMBENARAN',
    MUSYRIF: 'MUSYRIF', AUDIT: 'AUDIT',
  };
  const present = Object.keys(fetched.collections).filter(key => fetched.collections?.[key as D1CollectionKey] !== undefined);

  if (present.length === 0) {
    if (role === 'PESERTA') {
      return { success: false, message: 'Penyimpanan D1 belum diinisialisasi. Minta admin login terlebih dahulu untuk migrasi data awal.' };
    }
    const initial: Array<[D1CollectionKey, unknown]> = [
      ['CONFIG', initialCollectionValue('CONFIG')], ['PESERTA', initialCollectionValue('PESERTA')],
      ['BATCH', initialCollectionValue('BATCH')], ['JADWAL', initialCollectionValue('JADWAL')],
      ['ABSENSI', initialCollectionValue('ABSENSI')], ['IZIN', initialCollectionValue('IZIN')],
      ['PEMBENARAN', initialCollectionValue('PEMBENARAN')], ['MUSYRIF', initialCollectionValue('MUSYRIF')],
      ['AUDIT', initialCollectionValue('AUDIT')],
    ];
    // Sequential, idempotent writes prevent bursts that were triggering HTTP 429.
    for (const [key, value] of initial) {
      const saved = await d1SaveCollection(key, value);
      if (!saved.success) return { success: false, message: `Migrasi awal terhenti pada ${key}: ${saved.message}` };
    }
  } else {
    for (const [collection, storageKey] of Object.entries(keyMap)) {
      const value = fetched.collections[collection as D1CollectionKey];
      if (value !== undefined && value !== null) {
        writeCachedRaw(STORAGE_KEYS[storageKey], value);
      }
    }

    // Only trusted staff may initialize missing collections from their cache.
    if (role !== 'PESERTA') {
      const defaults: Array<[D1CollectionKey, unknown]> = [
        ['CONFIG', initialCollectionValue('CONFIG')], ['PESERTA', initialCollectionValue('PESERTA')],
        ['BATCH', initialCollectionValue('BATCH')], ['JADWAL', initialCollectionValue('JADWAL')],
        ['ABSENSI', initialCollectionValue('ABSENSI')], ['IZIN', initialCollectionValue('IZIN')],
        ['PEMBENARAN', initialCollectionValue('PEMBENARAN')], ['MUSYRIF', initialCollectionValue('MUSYRIF')],
        ['AUDIT', initialCollectionValue('AUDIT')],
      ];
      for (const [key, value] of defaults) {
        if (!present.includes(key)) {
          const saved = await d1SaveCollection(key, value);
          if (!saved.success) return { success: false, message: `Inisialisasi ${key} gagal: ${saved.message}` };
        }
      }
    }
  }

  let clearLegacyAccounts = role === 'ADMIN';
  if (role !== 'PESERTA') {
    const currentLegacyAccounts = readCachedRaw(STORAGE_KEYS.USERS_ACCOUNTS);
    if (role === 'ADMIN' && legacyStorageKeys.has(STORAGE_KEYS.USERS_ACCOUNTS) && currentLegacyAccounts) {
      let accounts: UserAccount[] = [];
      try { const parsed = JSON.parse(currentLegacyAccounts); if (Array.isArray(parsed)) accounts = parsed; } catch { /* Ignore malformed legacy account cache; never trust it for authentication. */ }
      if (accounts.length) {
        const imported = await d1ImportLegacyUsers(accounts);
        if (!imported.success) return { success: false, message: `Migrasi akun lama gagal: ${imported.message}` };
        if (Number(imported.skipped || 0) > 0) {
          clearLegacyAccounts = false;
          notifyD1MigrationWarning(`Migrasi akun lama: ${imported.imported || 0} diimpor, ${imported.skipped} akun perlu diperiksa karena data login tidak lengkap. Salinan akun lama dipertahankan di browser agar tidak hilang.`);
        }
      }
    }
    const userResult = await d1FetchUsers();
    if (!userResult.success) return { success: false, message: userResult.message };
    writeCachedRaw(STORAGE_KEYS.USERS_ACCOUNTS, (userResult.users || []).map(u => ({ ...u, password: '', passwordHash: '' })));
  }
  clearLegacyBusinessStorage(clearLegacyAccounts);

  if (role !== 'PESERTA') {
    syncPetugasRosterFromAccounts();
  }

  return { success: true, message: 'Data aplikasi berhasil dimuat dari Cloudflare D1.' };
}

// React StrictMode and route changes can request hydration concurrently. Keep one
// in-flight bootstrap so a single login cannot flood the Worker with duplicate reads.
let d1SyncInFlight: Promise<{ success: boolean; message: string }> | null = null;
export function syncWithCloudflareD1(role: User['role'] = 'ADMIN'): Promise<{ success: boolean; message: string }> {
  if (d1SyncInFlight) return d1SyncInFlight;
  const run = performSyncWithCloudflareD1(role);
  d1SyncInFlight = run;
  const clearInFlight = () => { if (d1SyncInFlight === run) d1SyncInFlight = null; };
  // Attach both handlers without creating an unobserved rejected promise from finally().
  void run.then(clearInFlight, clearInFlight);
  return run;
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
  const raw = readCachedRaw(STORAGE_KEYS.CONFIG);
  return raw ? JSON.parse(raw) : INITIAL_CONFIG;
}

export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  const updated = { ...current, ...cfg };
  setItems('CONFIG', updated);
  return updated;
}

// Active Musyrif
export function getActiveMusyrif(): Musyrif | null {
  const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_MUSYRIF);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const id = typeof parsed === 'string' ? parsed : String(parsed?.id || '');
    if (!id) return null;
    // Resolve the selected staff member from the D1-hydrated collection, never from
    // a full personal-data object stored in the browser.
    return getItems<Musyrif>('MUSYRIF').find((item) => item.id === id) || null;
  } catch {
    return getItems<Musyrif>('MUSYRIF').find((item) => item.id === raw) || null;
  }
}

export function setActiveMusyrif(musyrif: Musyrif | null) {
  if (!musyrif) localStorage.removeItem(STORAGE_KEYS.ACTIVE_MUSYRIF);
  else localStorage.setItem(STORAGE_KEYS.ACTIVE_MUSYRIF, JSON.stringify(musyrif.id));
}

// Generic Getter & Setter
export function getItems<T>(key: keyof typeof STORAGE_KEYS): T[] {
  initLocalStorageIfEmpty();
  const raw = readCachedRaw(STORAGE_KEYS[key]);
  return raw ? JSON.parse(raw) : [];
}

export function setItems<T>(key: keyof typeof STORAGE_KEYS, items: T[] | AppConfig) {
  writeCachedRaw(STORAGE_KEYS[key], items);
  const collection = D1_WRITEABLE_KEYS[key];
  if (collection) queueD1Write(collection, items);
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
  if (!isScheduleApplicableOnDate(jadwal, getBusinessDateString(now))) {
    return {
      valid: false,
      reason: `Kegiatan ${jadwal.namaKegiatan} tidak dijadwalkan untuk hari ini.`,
    };
  }
  const nowMinutes = getBusinessTimeMinutes(now);

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
  batch?: Batch | null,
  referenceDate?: string
): 'AKTIF' | 'BELUM_AKTIF' | 'SELESAI' {
  if (!batch || !batch.tanggalMulai) {
    return 'BELUM_AKTIF';
  }
  const today = referenceDate || getBusinessDateString();

  if (today < batch.tanggalMulai) {
    return 'BELUM_AKTIF';
  } else if (today >= batch.tanggalMulai && today <= (batch.tanggalSelesai || batch.tanggalMulai)) {
    return 'AKTIF';
  } else {
    return 'SELESAI';
  }
}

export function getActiveBatchToday(batches?: Batch[], referenceDate?: string): Batch | undefined {
  const bList = batches && batches.length > 0 ? batches : getItems<Batch>('BATCH');
  if (!bList || bList.length === 0) {
    return undefined;
  }
  const today = referenceDate || getBusinessDateString();

  // 1. Cek apakah ada batch yang strictly aktif hari ini
  const strictlyActive = bList.find(
    (b) => today >= b.tanggalMulai && today <= (b.tanggalSelesai || b.tanggalMulai)
  );
  if (strictlyActive) return strictlyActive;

  // 2. Jika tidak ada yang sedang berjalan hari ini, cari batch terdekat berikutnya
  const upcoming = bList.find((b) => today < b.tanggalMulai);
  if (upcoming) return upcoming;

  return bList[0];
}

export function getBatchStatusInfo(batch?: Batch | null, referenceDate?: string): {
  status: 'AKTIF' | 'BELUM_AKTIF' | 'SELESAI';
  isActiveToday: boolean;
  label: string;
  badgeClass: string;
  badgeText: string;
  keteranganTenggat: string;
} {
  if (!batch || !batch.tanggalMulai) {
    return {
      status: 'BELUM_AKTIF',
      isActiveToday: false,
      label: 'Belum Ada Batch',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
      badgeText: 'KOSONG',
      keteranganTenggat: 'Belum ada batch kegiatan terdaftar',
    };
  }
  const today = referenceDate || getBusinessDateString();
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
  const today = referenceDate || getBusinessDateString();
  const nowIso = new Date().toISOString();

  // 1. Sinkronisasi status batch sesuai tanggal hari ini
  const rawBatches = readCachedRaw(STORAGE_KEYS.BATCH);
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
    setItems('BATCH', batchList);
  }

  // 2. Sinkronisasi status izin & status santri (Peserta)
  const rawPeserta = readCachedRaw(STORAGE_KEYS.PESERTA);
  const rawIzin = readCachedRaw(STORAGE_KEYS.IZIN);

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
          iz.statusKedatangan !== 'SUDAH_KEMBALI' &&
          iz.statusKedatangan !== 'TERLAMBAT'
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
      setItems('PESERTA', updatedPeserta);
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
    // Status TERLAMBAT juga berarti verifikasi kedatangan telah selesai.
    if (iz.statusKedatangan === 'SUDAH_KEMBALI' || iz.statusKedatangan === 'TERLAMBAT') return false;

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
  const todayStr = getBusinessDateString();
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
  const nowMinutes = getBusinessTimeMinutes(now);

  let keteranganWaktu: 'TEPAT_WAKTU' | 'TERLAMBAT' = 'TEPAT_WAKTU';
  let menitKeterlambatan = 0;
  let catatanWaktu = `Hadir tepat waktu (toleransi sampai 15 menit setelah jam mulai ${targetJadwal.jamMulai} WIB)`;

  if (nowMinutes > startMinutes + 15) {
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
export async function updateProfilMahasiswa(
  nimOrId: string,
  data: { email: string; nomorWhatsApp: string; alamat: string },
): Promise<{ success: boolean; message: string; peserta?: Peserta }> {
  const pesertaList = getItems<Peserta>('PESERTA');
  const cleanKey = nimOrId.trim();
  const participant = pesertaList.find((p) => p.nim === cleanKey || p.pesertaId === cleanKey);
  if (!participant) return { success: false, message: 'NIM atau ID peserta tidak ditemukan dalam database.' };

  // Wait for Cloudflare to confirm persistence before showing success.
  const result = await d1UpdateParticipantBiodata({
    pesertaId: participant.pesertaId,
    nim: participant.nim,
    email: data.email,
    nomorWhatsApp: data.nomorWhatsApp,
    alamat: data.alamat,
  });
  if (!result.success || !result.peserta) return { success: false, message: result.message };

  const updated = pesertaList.map((p) => p.pesertaId === result.peserta!.pesertaId ? result.peserta! : p);
  writeCachedRaw(STORAGE_KEYS.PESERTA, updated);
  return { success: true, message: result.message, peserta: result.peserta };
}

// Deteksi Kegiatan Yang Sedang Berlangsung Berdasarkan Jam Realtime
export function getKegiatanSedangBerlangsung(customList?: JadwalKegiatan[]): {
  kegiatan: JadwalKegiatan | null;
  status: 'BERLANGSUNG' | 'SEGERA' | 'SELESAI';
  keterangan: string;
} {
  const list = customList || getItems<JadwalKegiatan>('JADWAL');
  const aktifList = list.filter(
    (j) => j.statusAktif && isScheduleApplicableOnDate(j, getBusinessDateString()),
  );

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
  const nowMinutes = getBusinessTimeMinutes(now);

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

export async function loginPesertaByNimOrId(
  nimOrId: string,
): Promise<{ success: boolean; user?: User; peserta?: Peserta; message: string }> {
  const clean = nimOrId.trim();
  if (!clean) return { success: false, message: 'QR peserta tidak terbaca.' };

  const result = await d1LoginPeserta(clean);
  if (!result.success || !result.user || !result.peserta) {
    clearD1Session();
    return { success: false, message: result.message || 'Login peserta gagal diverifikasi oleh D1.' };
  }
  // App hydrates the participant-scoped D1 snapshot before storing the session user.
  return { success: true, user: result.user, peserta: result.peserta, message: result.message };
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

/**
 * Sinkronkan akun PETUGAS dengan daftar Musyrif/Musyrifah.
 * Profil manual dipertahankan; akun yang dinonaktifkan tetap ada
 * sebagai profil nonaktif, dan akun yang dihapus/diubah menjadi ADMIN
 * dilepas dari daftar petugas otomatis.
 */
export function syncPetugasRosterFromAccounts(
  accounts: UserAccount[] = getUserAccounts(),
): void {
  const existing = getItems<Musyrif>('MUSYRIF');
  const activeBefore = getActiveMusyrif();
  const staffAccounts = accounts.filter((account) => account.role === 'PETUGAS');
  const staffIds = new Set(staffAccounts.map((account) => account.id));
  let updated = [...existing];

  for (const account of staffAccounts) {
    const accountName = String(account.namaLengkap || account.username).trim();
    const normalizedName = accountName.toLocaleLowerCase('id-ID');
    const gender = account.gender === 'AKHWAT' ? 'AKHWAT' : 'IKHWAN';
    const managedId = `ACCOUNT_USER_${account.id}`;

    let index = updated.findIndex(
      (item) => item.akunUserId === account.id || item.id === managedId,
    );

    // Jika profil manual yang sama sudah ada secara unik, tautkan profil
    // tersebut alih-alih membuat baris duplikat.
    if (index < 0) {
      const matches = updated
        .map((item, itemIndex) => ({ item, itemIndex }))
        .filter(({ item }) =>
          !item.akunUserId &&
          !item.id.startsWith('ACCOUNT_USER_') &&
          item.gender === gender &&
          item.nama.trim().toLocaleLowerCase('id-ID') === normalizedName
        );

      if (matches.length === 1) index = matches[0].itemIndex;
    }

    const previous = index >= 0 ? updated[index] : null;
    const synced: Musyrif = {
      ...(previous || {}),
      id: previous?.id || managedId,
      akunUserId: account.id,
      nama: accountName || account.username,
      gender,
      status: Boolean(account.statusAktif),
    };

    if (index >= 0) {
      updated[index] = synced;
    } else {
      updated.push(synced);
    }
  }

  // Bersihkan profil otomatis hanya jika akunnya sudah tidak berperan PETUGAS.
  // Baris manual yang tidak tertaut tidak ikut terhapus.
  updated = updated.filter((item) => {
    const linkedAccountId =
      item.akunUserId ||
      (item.id.startsWith('ACCOUNT_USER_')
        ? item.id.slice('ACCOUNT_USER_'.length)
        : null);

    return !linkedAccountId || staffIds.has(linkedAccountId);
  });

  if (JSON.stringify(existing) !== JSON.stringify(updated)) {
    setItems('MUSYRIF', updated);
  }

  // Jangan mempertahankan petugas piket yang sudah dinonaktifkan/dilepas.
  if (
    activeBefore &&
    !updated.some((item) => item.id === activeBefore.id && item.status)
  ) {
    setActiveMusyrif(null);
  }
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

// =====================================================================
// CLOUDFLARE D1 SQL EXPORTED HELPERS & MANUAL SYNC
// =====================================================================
export function getD1Config() {
  return D1_CONFIG;
}

export async function getD1Status(): Promise<D1Status> {
  return checkD1Status();
}

export async function syncAllDataToD1(): Promise<{
  success: boolean;
  message: string;
  pesertaCount: number;
  absensiCount: number;
}> {
  const collections: Array<[D1CollectionKey, unknown]> = [
    ['CONFIG', getConfig()],
    ['PESERTA', getItems<Peserta>('PESERTA')],
    ['BATCH', getItems<Batch>('BATCH')],
    ['JADWAL', getItems<JadwalKegiatan>('JADWAL')],
    ['ABSENSI', getItems<Absensi>('ABSENSI')],
    ['IZIN', getItems<Izin>('IZIN')],
    ['PEMBENARAN', getItems<Pembenaran>('PEMBENARAN')],
    ['MUSYRIF', getItems<Musyrif>('MUSYRIF')],
    ['AUDIT', getItems<AuditLog>('AUDIT')],
  ];
  const results: Array<{ success: boolean; message: string }> = [];
  for (const [key, value] of collections) results.push(await d1SaveCollection(key, value));
  const failed = results.filter(result => !result.success);
  return {
    success: failed.length === 0,
    message: failed.length === 0
      ? `Semua ${collections.length} koleksi berhasil disimpan ke D1.`
      : `${failed.length} dari ${collections.length} koleksi gagal disimpan: ${failed.map(result => result.message).join(' ')}`,
    pesertaCount: getItems<Peserta>('PESERTA').length,
    absensiCount: getItems<Absensi>('ABSENSI').length,
  };
}

// =====================================================================
// MANAJEMEN AKUN LOGIN & KREDENSIAL (ADMIN & PETUGAS / MUSYRIF)
// =====================================================================

export function getUserAccounts(): UserAccount[] {
  initLocalStorageIfEmpty();
  const raw = readCachedRaw(STORAGE_KEYS.USERS_ACCOUNTS);
  if (!raw) return [];
  try {
    const list: UserAccount[] = JSON.parse(raw);
    return Array.isArray(list) ? list.map(u => ({ ...u, password: '', passwordHash: '' })) : [];
  } catch {
    return [];
  }
}

export async function saveUserAccount(account: UserAccount): Promise<{ success: boolean; message: string }> {
  const list = getUserAccounts();
  const cleanUsername = account.username.trim().toLowerCase();

  // Validasi duplikasi username terhadap akun lain
  const duplicate = list.find((u) => u.id !== account.id && u.username.toLowerCase() === cleanUsername);
  if (duplicate) {
    return { success: false, message: `Username "${cleanUsername}" sudah digunakan oleh akun lain!` };
  }

  const updatedAccount: UserAccount = {
    ...account,
    username: cleanUsername,
    password: account.password || account.passwordHash || '',
    passwordHash: account.password || account.passwordHash || '',
    updatedAt: new Date().toISOString(),
  };

  const idx = list.findIndex((u) => u.id === account.id);
  if (idx !== -1) {
    list[idx] = updatedAccount;
  } else {
    list.push(updatedAccount);
  }

  // Persist credentials only in D1; never cache plaintext passwords in the browser.
  const persisted = await d1SaveUser(updatedAccount);
  if (!persisted.success) return persisted;
  writeCachedRaw(STORAGE_KEYS.USERS_ACCOUNTS, list.map(u => ({ ...u, password: '', passwordHash: '' })));
  syncPetugasRosterFromAccounts(list);

  addAuditLog({
    penggunaId: getCurrentUser()?.id || 'U001',
    aksi: idx !== -1 ? 'EDIT_AKUN_USER' : 'TAMBAH_AKUN_USER',
    jenisEntitas: 'USER_ACCOUNT',
    entitasId: account.id,
    nilaiSesudah: `${updatedAccount.username} (${updatedAccount.role} - ${updatedAccount.namaLengkap})`,
    statusAksi: 'BERHASIL',
  });

  return { success: true, message: `Akun ${updatedAccount.namaLengkap} berhasil disimpan!` };
}

export async function deleteUserAccount(id: string): Promise<{ success: boolean; message: string }> {
  const list = getUserAccounts();
  const target = list.find((u) => u.id === id);

  if (!target) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  // Lindungi admin utama agar sistem tidak terkunci
  const activeAdmins = list.filter((u) => u.role === 'ADMIN' && u.statusAktif);
  if (target.role === 'ADMIN' && activeAdmins.length <= 1) {
    return { success: false, message: 'Tidak dapat menghapus admin utama satu-satunya!' };
  }

  const filtered = list.filter((u) => u.id !== id);
  const persisted = await d1DeleteUser(id);
  if (!persisted.success) return persisted;
  writeCachedRaw(STORAGE_KEYS.USERS_ACCOUNTS, filtered.map(u => ({ ...u, password: '', passwordHash: '' })));
  syncPetugasRosterFromAccounts(filtered);

  addAuditLog({
    penggunaId: getCurrentUser()?.id || 'U001',
    aksi: 'HAPUS_AKUN_USER',
    jenisEntitas: 'USER_ACCOUNT',
    entitasId: id,
    nilaiSebelum: `${target.username} (${target.namaLengkap})`,
    statusAksi: 'BERHASIL',
  });

  return { success: true, message: `Akun ${target.username} berhasil dihapus.` };
}

export async function changeStaffCredentials(
  userId: string,
  newUsername?: string,
  newPassword?: string,
  newNama?: string
): Promise<{ success: boolean; message: string }> {
  const list = getUserAccounts();
  const target = list.find((u) => u.id === userId);
  if (!target) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  if (newUsername && newUsername.trim()) {
    const cleanUsername = newUsername.trim().toLowerCase();
    const duplicate = list.find((u) => u.id !== userId && u.username.toLowerCase() === cleanUsername);
    if (duplicate) {
      return { success: false, message: `Username "${cleanUsername}" sudah digunakan.` };
    }
    target.username = cleanUsername;
  }

  if (newPassword && newPassword.trim()) {
    target.password = newPassword.trim();
    target.passwordHash = newPassword.trim();
  }

  if (newNama && newNama.trim()) {
    target.namaLengkap = newNama.trim();
  }

  target.updatedAt = new Date().toISOString();
  const persisted = await d1SaveUser(target);
  if (!persisted.success) return persisted;
  writeCachedRaw(STORAGE_KEYS.USERS_ACCOUNTS, list.map(u => ({ ...u, password: '', passwordHash: '' })));
  syncPetugasRosterFromAccounts(list);

  // Update current user session jika user yang sedang login diubah
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    setCurrentUser({
      ...currentUser,
      username: target.username,
      namaLengkap: target.namaLengkap,
    });
  }

  return { success: true, message: 'Kredensial login berhasil diperbarui dan disinkronkan ke D1!' };
}

export async function verifyStaffLogin(
  key: string,
  password?: string
): Promise<{ success: boolean; user?: User; message: string }> {
  const cleanKey = key.trim();
  const cleanPass = password || '';
  if (!cleanKey || !cleanPass) {
    return { success: false, message: 'Username dan password wajib diisi.' };
  }

  // Authentication must be decided by the Worker/D1 only; localStorage accounts
  // are a cache for account management and must never be accepted as credentials.
  return d1LoginStaff(cleanKey, cleanPass);
}
