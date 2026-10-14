
import type { Peserta, Absensi, User, UserAccount } from '../types';

export const D1_CONFIG = {
  databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
  databaseName: 'bimma-absensi-db',
  domain: 'https://absensi.bimma-uab.my.id',
  apiPrefix: '/api/d1',
};

const D1_SESSION_KEY = 'bimma_d1_session_token';

export interface D1Status {
  connected: boolean;
  databaseId: string;
  databaseName: string;
  mode: 'CLOUDFLARE_PAGES_BINDING' | 'LOCAL_ACTIVE_CACHE';
  lastSync?: string;
  message: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  token?: string;
  user?: User;
  peserta?: Peserta;
  users?: UserAccount[];
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
  [key: string]: any;
}

function readSessionToken(): string | null {
  try {
    return sessionStorage.getItem(D1_SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveD1SessionToken(token: string): void {
  try {
    sessionStorage.setItem(D1_SESSION_KEY, token);
  } catch {
    throw new Error('Penyimpanan sesi tidak tersedia di browser ini.');
  }
}

export function getD1SessionToken(): string | null {
  return readSessionToken();
}

export function clearD1Session(): void {
  try {
    sessionStorage.removeItem(D1_SESSION_KEY);
  } catch {
    // Tidak ada sesi browser yang dapat dihapus.
  }
}

async function readJson(res: Response): Promise<ApiResponse> {
  try {
    return (await res.json()) as ApiResponse;
  } catch {
    return {};
  }
}

/**
 * Seluruh request API D1 menggunakan helper ini.
 * Token hanya dikirim ke API pada origin aplikasi yang sama.
 */
async function d1Request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = readSessionToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${D1_CONFIG.apiPrefix}${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  if (response.status === 401 && path !== '/login') {
    clearD1Session();
  }

  return response;
}

function apiError(data: ApiResponse, fallback: string): string {
  return typeof data.message === 'string' && data.message.trim()
    ? data.message
    : fallback;
}

// 1. Periksa koneksi API D1.
export async function checkD1Status(): Promise<D1Status> {
  try {
    const res = await d1Request('/health', { method: 'GET' });
    const data = await readJson(res);

    if (res.ok && data.success !== false) {
      return {
        connected: true,
        databaseId: D1_CONFIG.databaseId,
        databaseName: D1_CONFIG.databaseName,
        mode: 'CLOUDFLARE_PAGES_BINDING',
        lastSync: new Date().toISOString(),
        message: 'API Cloudflare D1 berhasil dihubungi.',
      };
    }

    return {
      connected: false,
      databaseId: D1_CONFIG.databaseId,
      databaseName: D1_CONFIG.databaseName,
      mode: 'LOCAL_ACTIVE_CACHE',
      message: apiError(data, 'API D1 belum dapat digunakan.'),
    };
  } catch {
    return {
      connected: false,
      databaseId: D1_CONFIG.databaseId,
      databaseName: D1_CONFIG.databaseName,
      mode: 'LOCAL_ACTIVE_CACHE',
      message: 'Tidak dapat menghubungi API D1.',
    };
  }
}

// 2. Login peserta melalui NIM atau ID.
// Backend harus membatasi sesi ini ke data peserta yang bersangkutan.
export async function d1LoginPeserta(
  nimOrId: string,
): Promise<{
  success: boolean;
  user?: User;
  peserta?: Peserta;
  message: string;
}> {
  try {
    const key = nimOrId.trim();

    if (!key) {
      return { success: false, message: 'NIM atau ID wajib diisi.' };
    }

    const res = await d1Request('/login', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });

    const data = await readJson(res);

    if (!res.ok || !data.success || !data.user || !data.token) {
      return {
        success: false,
        message: apiError(data, 'Login peserta gagal.'),
      };
    }

    saveD1SessionToken(data.token);

    return {
      success: true,
      user: data.user,
      peserta: data.peserta,
      message: 'Login peserta berhasil diverifikasi oleh server.',
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Tidak dapat menghubungi API login peserta.',
    };
  }
}

// 3. Sinkronisasi peserta ke D1.
// Endpoint ini nantinya wajib dibatasi untuk admin/petugas berwenang.
export async function syncSantriToD1(
  pesertaList: Peserta[],
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await d1Request('/sync', {
      method: 'POST',
      body: JSON.stringify({ peserta: pesertaList }),
    });

    const data = await readJson(res);

    if (res.ok && data.success === true) {
      return {
        success: true,
        count: Number(data.count ?? pesertaList.length),
        message: apiError(data, 'Sinkronisasi peserta berhasil.'),
      };
    }

    return {
      success: false,
      count: 0,
      message: apiError(data, 'Sinkronisasi peserta gagal.'),
    };
  } catch {
    return {
      success: false,
      count: 0,
      message: 'Tidak dapat menghubungi API D1 untuk sinkronisasi peserta.',
    };
  }
}

// 4. Catat satu absensi ke D1.
export async function recordAbsensiToD1(
  absensi: Absensi,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await d1Request('/sync', {
      method: 'POST',
      body: JSON.stringify({ absensi: [absensi] }),
    });

    const data = await readJson(res);

    if (res.ok && data.success === true) {
      return {
        success: true,
        message: apiError(data, 'Absensi berhasil dicatat di D1.'),
      };
    }

    return {
      success: false,
      message: apiError(data, 'Absensi gagal dicatat di D1.'),
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat menghubungi D1. Absensi belum dikonfirmasi tersimpan.',
    };
  }
}

// 5. Sinkronisasi riwayat absensi ke D1.
export async function syncAbsensiToD1(
  absensiList: Absensi[],
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await d1Request('/sync', {
      method: 'POST',
      body: JSON.stringify({ absensi: absensiList }),
    });

    const data = await readJson(res);

    if (res.ok && data.success === true) {
      return {
        success: true,
        count: Number(data.count ?? absensiList.length),
        message: apiError(data, 'Riwayat absensi berhasil disinkronkan.'),
      };
    }

    return {
      success: false,
      count: 0,
      message: apiError(data, 'Sinkronisasi riwayat absensi gagal.'),
    };
  } catch {
    return {
      success: false,
      count: 0,
      message: 'Tidak dapat menghubungi API D1.',
    };
  }
}

// 6. Ambil snapshot data dari D1.
// Backend harus mengembalikan data sesuai peran dan identitas sesi.
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
  try {
    const res = await d1Request('/sync', { method: 'GET' });
    const result = await readJson(res);

    if (res.ok && result.success === true && result.data) {
      return {
        success: true,
        data: result.data,
        message: 'Snapshot D1 berhasil diambil.',
      };
    }

    return {
      success: false,
      message: apiError(result, 'Tidak dapat mengambil data dari D1.'),
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat menghubungi API D1.',
    };
  }
}

// 7. Ambil daftar akun. Backend wajib mengecualikan password dan hash.
export async function d1FetchUsers(): Promise<{
  success: boolean;
  users?: UserAccount[];
  message: string;
}> {
  try {
    const res = await d1Request('/users', { method: 'GET' });
    const data = await readJson(res);

    if (res.ok && data.success === true) {
      return {
        success: true,
        users: data.users ?? [],
        message: 'Daftar akun berhasil dimuat.',
      };
    }

    return {
      success: false,
      message: apiError(data, 'Gagal memuat daftar akun.'),
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat menghubungi API akun D1.',
    };
  }
}

// 8. Buat/perbarui akun.
// Kata sandi baru harus dikirim melalui HTTPS dan di-hash di server.
// Jangan gunakan passwordHash lama sebagai pengganti kata sandi.
export async function d1SaveUser(
  user: UserAccount,
): Promise<{ success: boolean; message: string }> {
  if (!user.password?.trim()) {
    return {
      success: false,
      message: 'Kata sandi baru wajib diisi untuk operasi ini.',
    };
  }

  try {
    const res = await d1Request('/users', {
      method: 'POST',
      body: JSON.stringify({
        id: user.id,
        username: user.username,
        password: user.password,
        namaLengkap: user.namaLengkap,
        role: user.role,
        gender: user.gender,
        statusAktif: user.statusAktif,
      }),
    });

    const data = await readJson(res);

    if (res.ok && data.success === true) {
      return {
        success: true,
        message: apiError(data, 'Akun berhasil disimpan.'),
      };
    }

    return {
      success: false,
      message: apiError(data, 'Gagal menyimpan akun.'),
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat menghubungi API akun D1.',
    };
  }
}

// 9. Hapus akun. Backend wajib memeriksa sesi dan peran admin.
export async function d1DeleteUser(
  id: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await d1Request('/users/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });

    const data = await readJson(res);

    if (res.ok && data.success === true) {
      return {
        success: true,
        message: apiError(data, 'Akun berhasil dihapus.'),
      };
    }

    return {
      success: false,
      message: apiError(data, 'Gagal menghapus akun.'),
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat menghubungi API akun D1.',
    };
  }
}

// 10. Login admin/petugas melalui D1.
export async function d1LoginStaff(
  key: string,
  password: string,
): Promise<{ success: boolean; user?: User; message: string }> {
  try {
    const res = await d1Request('/login', {
      method: 'POST',
      body: JSON.stringify({
        key: key.trim(),
        password,
      }),
    });

    const data = await readJson(res);

    if (!res.ok || !data.success || !data.user || !data.token) {
      return {
        success: false,
        message: apiError(data, 'Kredensial tidak valid.'),
      };
    }

    saveD1SessionToken(data.token);

    return {
      success: true,
      user: data.user,
      message: 'Login berhasil diverifikasi oleh server D1.',
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat menghubungi API login D1.',
    };
  }
}
