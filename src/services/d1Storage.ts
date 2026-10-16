
import { Peserta, Absensi, User, UserAccount } from '../types';

export const D1_CONFIG = {
  databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
  databaseName: 'bimma-absensi-db',
  domain: 'https://absensi.bimma-uab.my.id',
  apiPrefix: '/api/d1',
};

const TOKEN_KEY = 'bimma_d1_session_token';

export interface D1Status {
  connected: boolean;
  databaseId: string;
  databaseName: string;
  mode: 'CLOUDFLARE_WORKER_BINDING' | 'D1_UNAVAILABLE';
  lastSync?: string;
  message: string;
}

function getToken(): string | null {
  try {
    return typeof window !== 'undefined'
      ? window.sessionStorage.getItem(TOKEN_KEY)
      : null;
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    console.warn('Token sesi tidak dapat disimpan.');
  }
}

export function clearD1Session(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage tidak tersedia.
  }
}

async function d1Request(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (authenticated) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  // One browser action produces at most one Worker invocation. In particular,
  // never automatically retry HTTP 429: retries multiplied account-level
  // request usage and contributed to Error 1027 during the migration.
  return fetch(`${D1_CONFIG.apiPrefix}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

async function readResponse(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

function rememberLoginToken(data: any): void {
  const token = data?.token ?? data?.sessionToken ?? data?.session?.token;
  if (typeof token === 'string' && token.length > 0) {
    saveToken(token);
  }
}

// 1. Cek koneksi D1
export async function checkD1Status(): Promise<D1Status> {
  try {
    const res = await d1Request('/health', { method: 'GET' }, false);

    if (res.ok) {
      return {
        connected: true,
        databaseId: D1_CONFIG.databaseId,
        databaseName: D1_CONFIG.databaseName,
        mode: 'CLOUDFLARE_WORKER_BINDING',
        lastSync: new Date().toISOString(),
        message: 'Endpoint Cloudflare D1 dapat dihubungi.',
      };
    }
  } catch (err) {
    console.warn('D1 health check gagal:', err);
  }

  return {
    connected: false,
    databaseId: D1_CONFIG.databaseId,
    databaseName: D1_CONFIG.databaseName,
    mode: 'D1_UNAVAILABLE',
    message: 'Endpoint D1 tidak dapat dihubungi.',
  };
}

// 2. Login peserta

export async function d1LoginPeserta(
  nimOrId: string,
): Promise<{ success: boolean; user?: User; peserta?: Peserta; message: string }> {
  clearD1Session();

  const key = nimOrId.trim();

  if (!key) {
    return {
      success: false,
      message: 'QR peserta tidak terbaca.',
    };
  }

  try {
    const res = await d1Request(
      '/login-peserta',
      {
        method: 'POST',
        body: JSON.stringify({ key }),
      },
      false,
    );

    const data = await readResponse(res);

    if (!res.ok || data.success !== true || !data.user || !data.token) {
      clearD1Session();

      return {
        success: false,
        message: data.message || 'QR peserta tidak berhasil diverifikasi.',
      };
    }

    rememberLoginToken(data);

    if (!getToken()) {
      return {
        success: false,
        message: 'Token sesi tidak dapat disimpan. Login dibatalkan.',
      };
    }

    return {
      success: true,
      user: data.user,
      peserta: data.peserta,
      message: 'Login peserta berhasil diverifikasi server.',
    };
  } catch (err) {
    clearD1Session();
    console.warn('D1 login peserta gagal:', err);

    return {
      success: false,
      message: 'Server login peserta tidak dapat dihubungi.',
    };
  }
}


// Canonical JSON collection storage for every application module.
export const D1_COLLECTION_KEYS = [
  'CONFIG', 'PESERTA', 'BATCH', 'JADWAL', 'ABSENSI', 'IZIN',
  'PEMBENARAN', 'MUSYRIF', 'AUDIT',
] as const;
export type D1CollectionKey = typeof D1_COLLECTION_KEYS[number];

export async function d1FetchCollections(): Promise<{
  success: boolean;
  collections?: Partial<Record<D1CollectionKey, any>>;
  message: string;
}> {
  try {
    const res = await d1Request('/collections', { method: 'GET' });
    const data = await readResponse(res);
    if (!res.ok || data.success !== true) {
      return { success: false, message: data.message || `D1 collections gagal dimuat (${res.status}).` };
    }
    return { success: true, collections: data.collections || {}, message: 'Data koleksi berhasil dimuat dari D1.' };
  } catch {
    return { success: false, message: 'Tidak dapat menghubungi penyimpanan koleksi D1.' };
  }
}

export async function d1SaveCollection(
  key: D1CollectionKey,
  items: unknown,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await d1Request('/collections', {
      method: 'PUT',
      body: JSON.stringify({ key, items }),
    });
    const data = await readResponse(res);
    if (!res.ok || data.success !== true) {
      return { success: false, message: data.message || `Penyimpanan ${key} ke D1 gagal (${res.status}).` };
    }
    return { success: true, message: data.message || `Koleksi ${key} tersimpan di D1.` };
  } catch {
    return { success: false, message: `Tidak dapat menyimpan koleksi ${key} ke D1.` };
  }
}


export async function d1MigrateRelationalCollections(): Promise<{
  success: boolean;
  alreadyMigrated?: boolean;
  migrated?: { batches: number; participants: number; izin: number };
  message: string;
}> {
  try {
    const res = await d1Request('/admin/relational-migrate', { method: 'POST' });
    const data = await readResponse(res);
    if (!res.ok || data.success !== true) {
      return { success: false, message: data.message || `Migrasi tabel relasional gagal (${res.status}).` };
    }
    return {
      success: true,
      alreadyMigrated: Boolean(data.alreadyMigrated),
      migrated: data.migrated,
      message: data.message || 'Migrasi tabel relasional selesai.',
    };
  } catch {
    return { success: false, message: 'Tidak dapat menghubungi Worker untuk menjalankan migrasi relasional.' };
  }
}

export async function d1ValidateSession(): Promise<{ success: boolean; message: string }> {
  try {
    if (!getToken()) return { success: false, message: 'Sesi D1 tidak ditemukan. Silakan login kembali.' };
    const res = await d1Request('/me', { method: 'GET' });
    const data = await readResponse(res);
    if (!res.ok || data.success !== true) {
      clearD1Session();
      return { success: false, message: data.message || `Sesi D1 tidak valid (${res.status}).` };
    }
    return { success: true, message: 'Sesi D1 valid.' };
  } catch {
    return { success: false, message: 'Tidak dapat memvalidasi sesi D1.' };
  }
}

/** Lookup the requested participant directly from the canonical D1 collection. */
export async function d1LookupParticipantBiodata(key: string): Promise<{ success: boolean; peserta?: Peserta; message: string }> {
  const clean = key.trim();
  if (!clean) return { success: false, message: 'Masukkan NIM atau ID peserta.' };
  try {
    const res = await d1Request(`/public/participant?key=${encodeURIComponent(clean)}`, { method: 'GET' }, false);
    const data = await readResponse(res);
    if (!res.ok || data.success !== true || !data.peserta) {
      return { success: false, message: data.message || `Data peserta tidak ditemukan (${res.status}).` };
    }
    return { success: true, peserta: data.peserta as Peserta, message: data.message || 'Data ditemukan.' };
  } catch {
    return { success: false, message: 'Server database tidak dapat dihubungi. Periksa koneksi lalu coba lagi.' };
  }
}

/** Update only contact fields through the Worker, and wait for D1 confirmation. */
export async function d1UpdateParticipantBiodata(payload: {
  pesertaId: string; nim: string; email: string; nomorWhatsApp: string; alamat: string;
}): Promise<{ success: boolean; peserta?: Peserta; message: string }> {
  try {
    const res = await d1Request('/public/participant-biodata', {
      method: 'POST',
      body: JSON.stringify({
        pesertaId: payload.pesertaId.trim(), nim: payload.nim.trim(),
        email: payload.email.trim(), nomorWhatsApp: payload.nomorWhatsApp.trim(), alamat: payload.alamat.trim(),
      }),
    }, false);
    const data = await readResponse(res);
    if (!res.ok || data.success !== true || !data.peserta) {
      return { success: false, message: data.message || `Biodata gagal disimpan (${res.status}).` };
    }
    return { success: true, peserta: data.peserta as Peserta, message: data.message || 'Biodata berhasil disimpan ke database pusat.' };
  } catch {
    return { success: false, message: 'Server database tidak dapat dihubungi. Perubahan belum tersimpan.' };
  }
}

export async function d1Logout(): Promise<void> {
  try {
    await d1Request('/logout', { method: 'POST', body: '{}' });
  } catch {
    // Ensure client credentials are cleared even without network access.
  } finally {
    clearD1Session();
  }
}


// 3. Sinkronisasi data peserta
export async function syncSantriToD1(
  pesertaList: Peserta[],
): Promise<{ success: boolean; count: number; message: string }> {
  const result = await d1SaveCollection('PESERTA', pesertaList);
  return { success: result.success, count: result.success ? pesertaList.length : 0, message: result.message };
}

// 4. Catat satu absensi langsung pada koleksi D1 canonical.
export async function recordAbsensiToD1(
  absensi: Absensi,
): Promise<{ success: boolean; message: string }> {
  const current = await d1FetchCollections();
  if (!current.success) return { success: false, message: current.message };
  const records = Array.isArray(current.collections?.ABSENSI) ? current.collections!.ABSENSI as Absensi[] : [];
  const index = records.findIndex(item => item.absensiId === absensi.absensiId);
  const next = [...records];
  if (index >= 0) next[index] = absensi;
  else next.unshift(absensi);
  return d1SaveCollection('ABSENSI', next);
}

// 5. Sinkronisasi penuh riwayat absensi ke koleksi D1 canonical.
export async function syncAbsensiToD1(
  absensiList: Absensi[],
): Promise<{ success: boolean; count: number; message: string }> {
  const result = await d1SaveCollection('ABSENSI', absensiList);
  return { success: result.success, count: result.success ? absensiList.length : 0, message: result.message };
}

// 6. Ambil snapshot data D1
export async function fetchFullDataFromD1(): Promise<{
  success: boolean;
  data?: {
    peserta: any[];
    absensi: any[];
    jadwal: any[];
    batch: any[];
    izin: any[];
    pembenaran: any[];
    musyrif: any[];
    users?: any[];
  };
  message: string;
}> {
  const [collections, users] = await Promise.all([d1FetchCollections(), d1FetchUsers()]);
  if (!collections.success) return { success: false, message: collections.message };
  if (!users.success) return { success: false, message: users.message };
  const all = collections.collections || {};
  return {
    success: true,
    data: {
      peserta: Array.isArray(all.PESERTA) ? all.PESERTA : [],
      absensi: Array.isArray(all.ABSENSI) ? all.ABSENSI : [],
      jadwal: Array.isArray(all.JADWAL) ? all.JADWAL : [],
      batch: Array.isArray(all.BATCH) ? all.BATCH : [],
      izin: Array.isArray(all.IZIN) ? all.IZIN : [],
      pembenaran: Array.isArray(all.PEMBENARAN) ? all.PEMBENARAN : [],
      musyrif: Array.isArray(all.MUSYRIF) ? all.MUSYRIF : [],
      users: users.users || [],
    },
    message: 'Snapshot data berhasil diambil dari koleksi Cloudflare D1.',
  };
}

// 7. Ambil akun admin dan petugas
export async function d1FetchUsers(): Promise<{
  success: boolean;
  users?: UserAccount[];
  message: string;
}> {
  try {
    const res = await d1Request('/users', { method: 'GET' });
    const data = await readResponse(res);

    if (res.ok) {
      const users: UserAccount[] = (data.users || []).map((u: any) => ({
        id: String(u.id || ''),
        username: String(u.username || ''),
        // D1 never returns password hashes to the browser.
        password: '',
        passwordHash: '',
        namaLengkap: String(u.namaLengkap || u.nama_lengkap || u.username || ''),
        role: u.role === 'ADMIN' ? 'ADMIN' : 'PETUGAS',
        gender: u.gender === 'AKHWAT' ? 'AKHWAT' : 'IKHWAN',
        statusAktif: u.statusAktif !== false && u.status !== 'NONAKTIF',
        createdAt: u.createdAt || u.created_at,
        updatedAt: u.updatedAt || u.updated_at,
      }));
      return {
        success: true,
        users,
        message: 'Daftar akun berhasil dimuat dari D1.',
      };
    }

    return {
      success: false,
      message: data.message || `Pengambilan akun ditolak server (${res.status}).`,
    };
  } catch {
    return {
      success: false,
      message: 'Gagal menghubungi endpoint akun D1.',
    };
  }
}

/** Import legacy browser accounts after an administrator has authenticated with D1.
 * The Worker hashes plaintext legacy passwords and never returns them to the browser.
 */
export async function d1ImportLegacyUsers(accounts: UserAccount[]): Promise<{ success: boolean; imported?: number; skipped?: number; duplicates?: number; message: string }> {
  try {
    const safeAccounts = accounts.slice(0, 100).map(account => ({
      id: String(account.id || ''), username: String(account.username || ''),
      password: String(account.password || ''), passwordHash: String(account.passwordHash || ''),
      namaLengkap: String(account.namaLengkap || account.username || ''),
      role: account.role === 'ADMIN' ? 'ADMIN' : 'PETUGAS', gender: account.gender,
      statusAktif: account.statusAktif !== false,
    }));
    const res = await d1Request('/users/import-legacy', {
      method: 'POST', body: JSON.stringify({ accounts: safeAccounts }),
    });
    const data = await readResponse(res);
    if (!res.ok || data.success !== true) return { success: false, message: data.message || `Impor akun lama ditolak (${res.status}).` };
    return { success: true, imported: Number(data.imported || 0), skipped: Number(data.skipped || 0), duplicates: Number(data.duplicates || 0), message: data.message || 'Akun lama berhasil diproses.' };
  } catch {
    return { success: false, message: 'Tidak dapat memigrasikan akun lama ke D1.' };
  }
}

// 8. Simpan atau perbarui akun
export async function d1SaveUser(
  user: UserAccount,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await d1Request('/users', {
      method: 'POST',
      body: JSON.stringify({
        id: user.id,
        username: user.username,
        password: user.password || user.passwordHash,
        namaLengkap: user.namaLengkap,
        role: user.role,
        gender: user.gender,
        statusAktif: user.statusAktif,
      }),
    });
    const data = await readResponse(res);

    if (res.ok) {
      return {
        success: true,
        message: data.message || 'Permintaan penyimpanan akun berhasil.',
      };
    }

    return {
      success: false,
      message: data.message || `Penyimpanan akun ditolak server (${res.status}).`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Kesalahan jaringan D1.',
    };
  }
}

// 9. Hapus akun
export async function d1DeleteUser(
  id: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await d1Request('/users/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    const data = await readResponse(res);

    if (res.ok) {
      return {
        success: true,
        message: data.message || 'Permintaan penghapusan akun berhasil.',
      };
    }

    return {
      success: false,
      message: data.message || `Penghapusan akun ditolak server (${res.status}).`,
    };
  } catch {
    return {
      success: false,
      message: 'Gagal menghubungi endpoint penghapusan akun D1.',
    };
  }
}

// 10. Login admin dan petugas
export async function d1LoginStaff(
  key: string,
  password: string,
): Promise<{ success: boolean; user?: User; message: string }> {
  clearD1Session();

  try {
    const res = await d1Request(
      '/login',
      {
        method: 'POST',
        body: JSON.stringify({ key: key.trim(), password }),
      },
      false,
    );
    const data = await readResponse(res);

    if (!res.ok || !data.success || !data.user) {
      return {
        success: false,
        message: data.message || 'Kredensial tidak valid.',
      };
    }

    rememberLoginToken(data);

    if (!getToken()) {
      return {
        success: false,
        message: 'Server tidak mengembalikan token sesi. Login dibatalkan.',
      };
    }

    return {
      success: true,
      user: data.user,
      message: 'Login berhasil diverifikasi server.',
    };
  } catch {
    return {
      success: false,
      message: 'Endpoint login D1 tidak dapat dihubungi.',
    };
  }
}
