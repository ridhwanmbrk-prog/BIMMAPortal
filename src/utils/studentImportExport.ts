import * as XLSX from 'xlsx';
import { Peserta } from '../types';
import { getItems, setItems, addAuditLog, getCurrentUser } from '../storage';

export async function importStudentsFromSpreadsheet(file: File): Promise<{ success: boolean; count: number; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          resolve({ success: false, count: 0, message: 'Spreadsheet kosong atau format tidak sesuai.' });
          return;
        }

        const currentList = getItems<Peserta>('PESERTA');
        let addedCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawNim = String(row.NIM || row.nim || row.Nim || '').trim();
          const rawNama = String(
            row['Nama Lengkap'] || row.Nama || row.nama || row.namaLengkap || ''
          ).trim();

          if (!rawNim || !rawNama) continue;

          const existsIdx = currentList.findIndex((p) => p.nim === rawNim);
          const rawBatch = String(row.Batch || row.batchId || row.batch || 'Batch 1').trim();
          const rawProdi = String(row.Prodi || row.programStudi || row['Program Studi'] || 'DKV').trim();
          const rawEmail = String(row.Email || row.email || '').trim();
          const rawWa = String(row['No WhatsApp'] || row.NoWA || row.nomorWhatsApp || row.Telepon || '').trim();
          const rawAlamat = String(row.Alamat || row.alamat || '').trim();

          if (existsIdx >= 0) {
            currentList[existsIdx] = {
              ...currentList[existsIdx],
              namaLengkap: rawNama,
              batchId: rawBatch,
              programStudi: rawProdi,
              email: rawEmail || currentList[existsIdx].email,
              nomorWhatsApp: rawWa || currentList[existsIdx].nomorWhatsApp,
              alamat: rawAlamat || currentList[existsIdx].alamat,
            };
          } else {
            const nextNum = currentList.length + 1;
            const newId = `B${String(nextNum).padStart(3, '0')}`;
            currentList.push({
              pesertaId: newId,
              nim: rawNim,
              namaLengkap: rawNama,
              batchId: rawBatch,
              programStudi: rawProdi,
              email: rawEmail,
              nomorWhatsApp: rawWa,
              alamat: rawAlamat,
              tanggalMasuk: new Date().toISOString().split('T')[0],
              statusPeserta: 'AKTIF',
              createdAt: new Date().toISOString(),
            });
            addedCount++;
          }
        }

        setItems('PESERTA', currentList);

        addAuditLog({
          penggunaId: getCurrentUser()?.id || 'ADMIN',
          aksi: 'IMPORT_SPREADSHEET',
          jenisEntitas: 'PESERTA',
          entitasId: file.name,
          nilaiSesudah: `Import ${addedCount} santri baru`,
          statusAksi: 'BERHASIL',
        });

        resolve({
          success: true,
          count: addedCount,
          message: `Berhasil mengimpor & mengintegrasikan ${addedCount} santri baru dari spreadsheet!`,
        });
      } catch (err: any) {
        resolve({ success: false, count: 0, message: 'Gagal membaca spreadsheet: ' + err.message });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, count: 0, message: 'Gagal membuka file spreadsheet.' });
    };

    reader.readAsBinaryString(file);
  });
}
