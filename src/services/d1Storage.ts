
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
  mode: 'CLOUDFLARE_PAGES_BINDING' | 'LOCAL_ACTIVE_CACHE';
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
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(`${D1_CONFIG.apiPrefix}${path}`, {
    ...init,
    headers,
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
        mode: 'CLOUDFLARE_PAGES_BINDING',
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
    mode: 'LOCAL_ACTIVE_CACHE',
    message: 'Endpoint D1 tidak dapat dihubungi.',
  };
}

// 2. Login peserta
export async function d1LoginPeserta(
  nimOrId: string,
): Promise<{ success: boolean; user?: User; peserta?: Peserta; message: string }> {
  try {
    const res = await d1Request(
      '/login',
      {
        method: 'POST',
        body: JSON.stringify({ key: nimOrId.trim() }),
      },
      false,
    );

    const data = await readResponse(res);

    if (!res.ok || !data.success || !data.user) {
      return {
        success: false,
        message: data.message || 'Login peserta ditolak oleh server.',
      };
    }

    rememberLoginToken(data);

    return {
      success: true,
      user: data.user,
      peserta: data.peserta,
      message: 'Login peserta berhasil diverifikasi server.',
    };
  } catch (err) {
    console.warn('D1 login peserta gagal:', err);
    return {
      success: false,
      message: 'Endpoint login D1 tidak dapat dihubungi.',
    };
  }
}

// 3. Sinkronisasi data peserta
export async function syncSantriToD1(
  pesertaList: Peserta[],
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await d1Request('/sync', {
      method: 'POST',
      body: JSON.stringify({ peserta: pesertaList }),
    });
    const data = await readResponse(res);

    if (res.ok && data.success !== false) {
      return {
        success: true,
        count: pesertaList.length,
        message: data.message || 'Sinkronisasi peserta berhasil.',
      };
    }

    return {
      success: false,
      count: 0,
      message: data.message || `Sinkronisasi ditolak server (${res.status}).`,
    };
  } catch {
    return {
      success: false,
      count: 0,
      message: 'Gagal menghubungi endpoint sinkronisasi D1.',
    };
  }
}

// 4. Catat satu absensi
export async function recordAbsensiToD1(
  absensi: Absensi,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await d1Request('/sync', {
      method: 'POST',
      body: JSON.stringify({ absensi: [absensi] }),
    });
    const data = await readResponse(res);

    if (res.ok && data.success !== false) {
      return {
        success: true,
        message: data.message || 'Permintaan pencatatan absensi berhasil.',
      };
    }

    return {
      success: false,
      message: data.message || `Pencatatan absensi ditolak server (${res.status}).`,
    };
  } catch {
    return {
      success: false,
      message: 'Gagal menghubungi endpoint pencatatan absensi.',
    };
  }
}

// 5. Sinkronisasi riwayat absensi
export async function syncAbsensiToD1(
  absensiList: Absensi[],
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await d1Request('/sync', {
      method: 'POST',
      body: JSON.stringify({ absensi: absensiList }),
    });
    const data = await readResponse(res);

    if (res.ok && data.success !== false) {
      return {
        success: true,
        count: absensiList.length,
        message: data.message || 'Sinkronisasi absensi berhasil.',
      };
    }

    return {
      success: false,
      count: 0,
      message: data.message || `Sinkronisasi absensi ditolak server (${res.status}).`,
    };
  } catch {
    return {
      success: false,
      count: 0,
      message: 'Gagal menghubungi endpoint sinkronisasi absensi.',
    };
  }
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
  try {
    const res = await d1Request('/sync', { method: 'GET' });
    const result = await readResponse(res);

    if (res.ok && result.data) {
      return {
        success: true,
        data: result.data,
        message: 'Snapshot data berhasil diambil dari D1.',
      };
    }

    return {
      success: false,
      message: result.message || `Pengambilan data ditolak server (${res.status}).`,
    };
  } catch {
    return {
      success: false,
      message: 'Tidak dapat menghubungi endpoint snapshot D1.',
    };
  }
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
      return {
        success: true,
        users: data.users || [],
        message: 'Daftar akun berhasil dimuat.',
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
