// Cloudflare D1 SQL Storage Service Client
// Database ID: dd5dbf9a-56c0-4ee0-85df-a698c7c99e56
// Database Name: bimma-absensi-db
// Domain: https://absensi.bimma-uab.my.id/

import { Peserta, Absensi, User, UserAccount } from '../types';

export const D1_CONFIG = {
  databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
  databaseName: 'bimma-absensi-db',
  domain: 'https://absensi.bimma-uab.my.id',
  apiPrefix: '/api/d1',
};

export interface D1Status {
  connected: boolean;
  databaseId: string;
  databaseName: string;
  mode: 'CLOUDFLARE_PAGES_BINDING' | 'LOCAL_ACTIVE_CACHE';
  lastSync?: string;
  message: string;
}

// 1. Cek Koneksi ke Cloudflare D1
export async function checkD1Status(): Promise<D1Status> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        connected: true,
        databaseId: D1_CONFIG.databaseId,
        databaseName: D1_CONFIG.databaseName,
        mode: 'CLOUDFLARE_PAGES_BINDING',
        lastSync: new Date().toISOString(),
        message: 'Terhubung langsung dengan Cloudflare D1 SQL di Cloudflare Pages.',
      };
    }
  } catch {
    // Fallback bila dijalankan di local preview environment tanpa edge D1 binding
  }

  return {
    connected: false,
    databaseId: D1_CONFIG.databaseId,
    databaseName: D1_CONFIG.databaseName,
    mode: 'LOCAL_ACTIVE_CACHE',
    message: 'D1 binding siap aktif begitu dideploy ke Cloudflare Pages / Workers.',
  };
}

// 2. Login Peserta / Mahasantri Langsung ke Cloudflare D1 SQL
export async function d1LoginPeserta(nimOrId: string): Promise<{
  success: boolean;
  user?: User;
  peserta?: Peserta;
  message: string;
}> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: nimOrId.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        return {
          success: true,
          user: data.user,
          peserta: data.peserta,
          message: `Login mahasantri terverifikasi via Cloudflare D1: ${data.user.namaLengkap}`,
        };
      }
      return { success: false, message: data.message || 'Login gagal di Cloudflare D1.' };
    }
  } catch (err: any) {
    console.warn('D1 login remote fallback to local state:', err);
  }

  return { success: false, message: 'D1 endpoint tidak dapat dihubungi secara langsung.' };
}

// 3. Simpan / Sinkronkan Data Santri ke Cloudflare D1
export async function syncSantriToD1(pesertaList: Peserta[]): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peserta: pesertaList }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        count: pesertaList.length,
        message: data.message || `Berhasil menyinkronkan ${pesertaList.length} santri ke Cloudflare D1 SQL!`,
      };
    }
  } catch (err: any) {
    console.warn('Sync santri to D1 error:', err);
  }

  return {
    success: false,
    count: 0,
    message: 'Sinkronisasi santri ke Cloudflare D1 akan dieksekusi saat deploy aktif.',
  };
}

// 4. Catat Kehadiran Absensi ke Cloudflare D1
export async function recordAbsensiToD1(absensi: Absensi): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ absensi: [absensi] }),
    });

    if (res.ok) {
      return {
        success: true,
        message: 'Kehadiran berhasil dicatat permanen ke Cloudflare D1 SQL!',
      };
    }
  } catch (err) {
    console.warn('Push single absensi to D1 warning:', err);
  }

  return {
    success: false,
    message: 'Kehadiran disimpan di cache lokal (antre sinkron D1).',
  };
}

// 5. Sinkronkan Riwayat Absensi ke Cloudflare D1
export async function syncAbsensiToD1(absensiList: Absensi[]): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ absensi: absensiList }),
    });

    if (res.ok) {
      return {
        success: true,
        count: absensiList.length,
        message: `Berhasil mencatat ${absensiList.length} riwayat presensi ke Cloudflare D1 SQL!`,
      };
    }
  } catch (err) {
    console.warn('Sync absensi to D1 error:', err);
  }

  return {
    success: false,
    count: 0,
    message: 'Gagal menghubungi Cloudflare D1.',
  };
}

// 6. Tarik Data Lengkap dari Cloudflare D1
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
    const res = await fetch(`${D1_CONFIG.apiPrefix}/sync`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const result = await res.json();
      return {
        success: true,
        data: result.data,
        message: 'Data berhasil disinkronkan dari Cloudflare D1!',
      };
    }
  } catch (err: any) {
    console.warn('Fetch data from D1 warning:', err);
  }

  return {
    success: false,
    message: 'Tidak dapat mengambil snapshot dari D1 saat ini.',
  };
}

// 7. Ambil Daftar Akun Petugas & Admin dari D1
export async function d1FetchUsers(): Promise<{ success: boolean; users?: UserAccount[]; message: string }> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, users: data.users || [], message: 'Berhasil memuat akun dari Cloudflare D1.' };
    }
  } catch (err: any) {
    console.warn('D1 fetch users warning:', err);
  }
  return { success: false, message: 'Gagal menghubungi endpoint akun Cloudflare D1.' };
}

// 8. Simpan / Perbarui Akun Kredensial ke D1
export async function d1SaveUser(user: UserAccount): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Akun berhasil disimpan ke Cloudflare D1!' };
    }
    const data = await res.json().catch(() => ({}));
    return { success: false, message: data.message || 'Gagal menyimpan akun ke D1.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Kesalahan jaringan D1.' };
  }
}

// 9. Hapus Akun dari D1
export async function d1DeleteUser(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/users/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Akun berhasil dihapus dari Cloudflare D1.' };
    }
    const data = await res.json().catch(() => ({}));
    return { success: false, message: data.message || 'Gagal menghapus akun di D1.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Kesalahan jaringan D1.' };
  }
}

// 10. Login Staff (Admin & Petugas) langsung ke D1
export async function d1LoginStaff(key: string, password: string): Promise<{ success: boolean; user?: User; message: string }> {
  try {
    const res = await fetch(`${D1_CONFIG.apiPrefix}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        return { success: true, user: data.user, message: 'Login berhasil diverifikasi via D1!' };
      }
      return { success: false, message: data.message || 'Kredensial tidak valid di D1.' };
    }
  } catch (err) {
    console.warn('D1 login staff remote error:', err);
  }
  return { success: false, message: 'D1 endpoint tidak dapat dihubungi.' };
}
