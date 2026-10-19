import { getBusinessDateString } from './utils/date';
import { Peserta, Absensi, JadwalKegiatan, Batch, Izin, Pembenaran, UserAccount } from './types';

export interface SheetSyncResult {
  success: boolean;
  message: string;
  count?: number;
  data?: any;
}

/**
 * Uji koneksi ke endpoint Google Apps Script Web App
 */
export async function testGasConnection(backendUrl: string): Promise<SheetSyncResult> {
  if (!backendUrl || !backendUrl.trim()) {
    return { success: false, message: 'URL Google Apps Script belum dikonfigurasi!' };
  }

  try {
    const cleanUrl = backendUrl.trim();
    const targetUrl = cleanUrl.includes('?') ? `${cleanUrl}&action=ping` : `${cleanUrl}?action=ping`;
    const res = await fetch(targetUrl, { method: 'GET' });
    const json = await res.json();
    if (json.success) {
      return {
        success: true,
        message: `Terhubung dengan Google Apps Script! (Waktu Server: ${json.serverTime || 'Online'})`,
      };
    }
    return { success: false, message: json.message || 'Respons Apps Script tidak valid' };
  } catch (err: any) {
    return { success: false, message: 'Gagal terhubung ke Apps Script: ' + err.message };
  }
}

/**
 * Tarik data Santri dari Google Sheets via Apps Script Web App API
 * API action: 'get_peserta'
 */
export async function fetchSantriFromSheet(backendUrl: string): Promise<SheetSyncResult> {
  if (!backendUrl || !backendUrl.trim()) {
    return { success: false, message: 'URL Google Apps Script belum diatur di menu Pengaturan!' };
  }

  try {
    const cleanUrl = backendUrl.trim();
    const targetUrl = cleanUrl.includes('?')
      ? `${cleanUrl}&action=get_peserta`
      : `${cleanUrl}?action=get_peserta`;

    const res = await fetch(targetUrl, { method: 'GET' });
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      const parsedPeserta: Peserta[] = json.data.map((row: any, idx: number) => ({
        pesertaId: row.pesertaId || row.ID || `B${String(idx + 1).padStart(3, '0')}`,
        nim: String(row.nim || row.NIM || '').trim(),
        namaLengkap: String(row.namaLengkap || row.Nama || row['Nama Lengkap'] || '').trim(),
        batchId: String(row.batchId || row.Batch || 'Batch 1').trim(),
        programStudi: String(row.programStudi || row.Prodi || row['Program Studi'] || 'DKV').trim(),
        email: String(row.email || row.Email || '').trim(),
        nomorWhatsApp: String(row.nomorWhatsApp || row.NoWA || row['No WhatsApp'] || '').trim(),
        alamat: String(row.alamat || row.Alamat || '').trim(),
        tanggalMasuk: String(row.tanggalMasuk || getBusinessDateString()),
        statusPeserta: row.statusPeserta === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',
      }));

      return {
        success: true,
        count: parsedPeserta.length,
        message: `Berhasil mengimpor ${parsedPeserta.length} santri dari Google Sheet!`,
        data: parsedPeserta,
      };
    }

    return {
      success: false,
      message: json.message || 'Format data dari Google Sheet tidak sesuai.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal mengambil data dari Google Sheet: ' + err.message,
    };
  }
}

/**
 * Kirim / Simpan data Santri ke Google Sheets via Apps Script Web App API
 * API action: 'sync_peserta'
 */
export async function pushSantriToSheet(backendUrl: string, pesertaList: Peserta[]): Promise<SheetSyncResult> {
  if (!backendUrl || !backendUrl.trim()) {
    return { success: false, message: 'URL Google Apps Script belum diatur!' };
  }

  try {
    const cleanUrl = backendUrl.trim();
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // hindari CORS preflight OPTIONS pada Apps Script
      },
      body: JSON.stringify({
        action: 'sync_peserta',
        peserta: pesertaList,
      }),
    });

    const json = await res.json();
    if (json.success) {
      return {
        success: true,
        count: pesertaList.length,
        message: json.message || `Berhasil mengekspor ${pesertaList.length} santri ke Google Sheet!`,
      };
    }
    return { success: false, message: json.message || 'Gagal menyimpan ke Google Sheet.' };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal mengirim data santri ke Google Sheet: ' + err.message,
    };
  }
}

/**
 * Kirim hasil presensi ke database Google Sheets via Apps Script Web App API
 * API action: 'sync_absensi'
 */
export async function pushAbsensiToSheet(backendUrl: string, absensiList: Absensi[]): Promise<SheetSyncResult> {
  if (!backendUrl || !backendUrl.trim()) {
    return { success: false, message: 'URL Google Apps Script belum diatur di menu Pengaturan!' };
  }

  try {
    const cleanUrl = backendUrl.trim();
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'sync_absensi',
        absensi: absensiList,
      }),
    });

    const json = await res.json();
    if (json.success) {
      return {
        success: true,
        count: absensiList.length,
        message: json.message || `Berhasil menyinkronkan ${absensiList.length} rekaman presensi ke Google Sheet!`,
      };
    }
    return { success: false, message: json.message || 'Gagal menyinkronkan presensi ke Google Sheet.' };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal mengirim absensi ke Google Sheet: ' + err.message,
    };
  }
}


export interface SheetSyncPayload {
  tanggalLaporan: string;
  pengguna: Array<Pick<UserAccount, 'id' | 'gender' | 'role' | 'namaLengkap' | 'statusAktif'>>;
  peserta: Peserta[];
  absensi: Absensi[];
  jadwal: JadwalKegiatan[];
  batch: Batch[];
  izin: Izin[];
  pembenaran: Pembenaran[];
}

/**
 * Sinkronkan seluruh data BIMMA dalam satu permintaan.
 * Apps Script akan menangani upsert berdasarkan ID dan membangun output.
 */
export async function pushAllDataToSheet(
  backendUrl: string,
  payload: SheetSyncPayload
): Promise<SheetSyncResult> {
  if (!backendUrl || !backendUrl.trim()) {
    return { success: false, message: 'URL Google Apps Script belum diatur!' };
  }

  try {
    const res = await fetch(backendUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sync_all_data',
        ...payload,
      }),
    });

    const json = await res.json();

    if (json.success) {
      return {
        success: true,
        count:
          payload.peserta.length +
          payload.absensi.length +
          payload.jadwal.length +
          payload.batch.length +
          payload.izin.length +
          payload.pembenaran.length,
        message:
          json.message ||
          'Seluruh data BIMMA berhasil dikirim ke Google Spreadsheet.',
      };
    }

    return {
      success: false,
      message: json.message || 'Sinkronisasi seluruh data gagal.',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message:
        'Gagal menyinkronkan seluruh data: ' +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

/**
 * Buat dan perbarui 4 sheet formula rekapan otomatis di Google Sheets:
 * 1. REKAP_PER_ORANG
 * 2. REKAP_HARIAN_KEGIATAN
 * 3. REKAP_BATCH
 * 4. REKAP_MINGGUAN
 */
export async function initRekapFormulasInSheet(backendUrl: string): Promise<SheetSyncResult> {
  if (!backendUrl || !backendUrl.trim()) {
    return { success: false, message: 'URL Google Apps Script belum diatur!' };
  }

  try {
    const cleanUrl = backendUrl.trim();
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'init_rekap_formulas',
      }),
    });

    const json = await res.json();
    if (json.success) {
      return {
        success: true,
        message: json.message || 'Formula rekapan otomatis berhasil dipasang di Google Sheets!',
      };
    }
    return { success: false, message: json.message || 'Gagal memasang formula rekapan ke Google Sheets.' };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal memasang formula ke Google Sheets: ' + err.message,
    };
  }
}

/**
 * Ambil data rekapan yang telah dihitung oleh Google Sheets
 */
export async function fetchRekapSummaryFromSheet(backendUrl: string): Promise<SheetSyncResult> {
  if (!backendUrl || !backendUrl.trim()) {
    return { success: false, message: 'URL Google Apps Script belum diatur!' };
  }

  try {
    const cleanUrl = backendUrl.trim();
    const targetUrl = cleanUrl.includes('?')
      ? `${cleanUrl}&action=get_rekap_summary`
      : `${cleanUrl}?action=get_rekap_summary`;

    const res = await fetch(targetUrl, { method: 'GET' });
    const json = await res.json();
    if (json.success) {
      return {
        success: true,
        data: json,
        message: 'Berhasil memuat data rekapan dari Google Sheets!',
      };
    }
    return { success: false, message: json.message || 'Gagal memuat rekapan dari Google Sheets.' };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal memuat rekapan: ' + err.message,
    };
  }
}
