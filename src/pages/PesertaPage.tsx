import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit2,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { Peserta, Batch } from '../types';
import { getItems, setItems, getCurrentUser, addAuditLog, getConfig, syncDatabaseState } from '../storage';
import { fetchSantriFromSheet, pushSantriToSheet } from '../sheetApi';
import { downloadStudentTemplate } from '../utils/studentImportExport';

export const PesertaPage: React.FC = () => {
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJurusan, setFilterJurusan] = useState<string>('ALL');
  const [filterBatch, setFilterBatch] = useState<string>('ALL');

  // Modal Form Tambah Data Baru (Sheet Style)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPeserta, setEditingPeserta] = useState<Peserta | null>(null);

  // Form Fields
  const [nim, setNim] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [programStudi, setProgramStudi] = useState('DKV');
  const [batchId, setBatchId] = useState('Batch 1');
  const [email, setEmail] = useState('');
  const [nomorWhatsApp, setNomorWhatsApp] = useState('');
  const [alamat, setAlamat] = useState('');
  const [statusPeserta, setStatusPeserta] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF');

  // Loading & Notification State
  const [syncLoading, setSyncLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentUser = getCurrentUser();
  const config = getConfig();

  const loadData = () => {
    syncDatabaseState();
    setPesertaList(getItems<Peserta>('PESERTA'));
    setBatches(getItems<Batch>('BATCH'));
  };

  useEffect(() => {
    loadData();

    const handleRefresh = () => {
      loadData();
    };

    window.addEventListener('bimma_refresh_peserta', handleRefresh);
    return () => window.removeEventListener('bimma_refresh_peserta', handleRefresh);
  }, []);

  const jurusanList = Array.from(new Set(pesertaList.map((p) => p.programStudi)));

  const filtered = pesertaList.filter((p) => {
  const namaLengkap = String(p.namaLengkap ?? "");
  const nim = String(p.nim ?? "");
  const pesertaId = String(p.pesertaId ?? "");
  const programStudi = String(p.programStudi ?? "");
  const batchId = String(p.batchId ?? "");

  const query = searchTerm.toLowerCase();

  const matchQuery =
    namaLengkap.toLowerCase().includes(query) ||
    nim.includes(searchTerm) ||
    pesertaId.toLowerCase().includes(query);

  const matchJurusan =
    filterJurusan === "ALL" || programStudi === filterJurusan;

  const matchBatch =
    filterBatch === "ALL" || batchId === filterBatch;

  return matchQuery && matchJurusan && matchBatch;
});

  const handleOpenAdd = () => {
    setEditingPeserta(null);
    setNim('');
    setNamaLengkap('');
    setProgramStudi('DKV');
    setBatchId('Batch 1');
    setEmail('');
    setNomorWhatsApp('');
    setAlamat('');
    setStatusPeserta('AKTIF');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Peserta) => {
    setEditingPeserta(p);
    setNim(p.nim);
    setNamaLengkap(p.namaLengkap);
    setProgramStudi(p.programStudi);
    setBatchId(p.batchId);
    setEmail(p.email || '');
    setNomorWhatsApp(p.nomorWhatsApp || '');
    setAlamat(p.alamat || '');
    setStatusPeserta(p.statusPeserta as any);
    setModalOpen(true);
  };

  // Simpan santri baru -> Otomatis dibuatkan QR dan kartu siap cetak
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNim = nim.trim();

    if (!cleanNim || !namaLengkap.trim()) {
      alert('NIM dan Nama Lengkap wajib diisi!');
      return;
    }

    if (!editingPeserta) {
      const exists = pesertaList.some((p) => p.nim === cleanNim);
      if (exists) {
        alert(`NIM ${cleanNim} sudah terdaftar!`);
        return;
      }
    }

    let updated: Peserta[];
    if (editingPeserta) {
      updated = pesertaList.map((p) =>
        p.pesertaId === editingPeserta.pesertaId
          ? {
              ...p,
              nim: cleanNim,
              namaLengkap: namaLengkap.trim(),
              programStudi,
              batchId,
              email: email.trim(),
              nomorWhatsApp: nomorWhatsApp.trim(),
              alamat: alamat.trim(),
              statusPeserta,
              updatedAt: new Date().toISOString(),
            }
          : p
      );
    } else {
      // Auto Generate ID pola B001, B002, dll
      const nextNum = pesertaList.length + 1;
      const newId = `B${String(nextNum).padStart(3, '0')}`;

      const newP: Peserta = {
        pesertaId: newId,
        nim: cleanNim,
        namaLengkap: namaLengkap.trim(),
        batchId,
        programStudi,
        email: email.trim(),
        nomorWhatsApp: nomorWhatsApp.trim(),
        alamat: alamat.trim(),
        tanggalMasuk: new Date().toISOString().split('T')[0],
        statusPeserta,
        createdAt: new Date().toISOString(),
      };
      updated = [...pesertaList, newP];

      // Auto-generate QR code data URL untuk kartu santri
      try {
        await QRCode.toDataURL(`${newP.pesertaId}-${newP.nim}`, { width: 200, margin: 1 });
      } catch (err) {
        console.warn('QR auto-generation ready in memory:', err);
      }
    }

    setItems('PESERTA', updated);
    setPesertaList(updated);
    setModalOpen(false);

    addAuditLog({
      penggunaId: currentUser?.id || 'U001',
      aksi: editingPeserta ? 'EDIT_PESERTA' : 'TAMBAH_PESERTA_AUTO_QR',
      jenisEntitas: 'PESERTA',
      entitasId: cleanNim,
      nilaiSesudah: `${namaLengkap} (${cleanNim}) - ${batchId}`,
      statusAksi: 'BERHASIL',
    });

    setNotification({
      type: 'success',
      message: editingPeserta ? 'Data santri berhasil diperbarui!' : 'Santri baru berhasil didaftarkan dan QR ID otomatis dibuat!',
    });
    setTimeout(() => setNotification(null), 3500);
  };

  const [deletingPesertaId, setDeletingPesertaId] = useState<string | null>(null);

  const handleDelete = (id: string, nama: string) => {
    const current = getItems<Peserta>('PESERTA');
    const updated = current.filter((p) => p.pesertaId !== id && p.nim !== id);
    setItems('PESERTA', updated);
    setPesertaList(updated);
    setDeletingPesertaId(null);
    setNotification({
      type: 'success',
      message: `Santri ${nama} berhasil dihapus dari database.`,
    });
    setTimeout(() => setNotification(null), 3500);
  };

  // 1. UPLOAD SPREADSHEET (Membaca file Excel / CSV dan Mengintegrasikannya)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          alert('Spreadsheet kosong atau format tidak sesuai.');
          return;
        }

        let addedCount = 0;
        const currentList = [...pesertaList];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawNim = String(row.NIM || row.nim || row.Nim || '').trim();
          const rawNama = String(
            row['Nama Lengkap'] || row.Nama || row.nama || row.namaLengkap || ''
          ).trim();

          if (!rawNim || !rawNama) continue;

          // Cek jika NIM sudah ada, lewati atau perbarui
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
        setPesertaList(currentList);

        setNotification({
          type: 'success',
          message: `Berhasil mengimpor & mengintegrasikan ${addedCount} santri baru dari spreadsheet!`,
        });
        setTimeout(() => setNotification(null), 4000);
      } catch (err: any) {
        alert('Gagal membaca file spreadsheet: ' + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // 2. UNDUH TEMPLATE SPREADSHEET
  const handleDownloadTemplate = () => {
    downloadStudentTemplate();
    setNotification({
      type: 'success',
      message: 'Template Excel (Template_Upload_Santri_BIMMA.xlsx) berhasil diunduh! Silakan gunakan untuk pengisian data santri.',
    });
    setTimeout(() => setNotification(null), 3500);
  };

  // 3. TARIK DATA DARI GOOGLE SHEET (APPS SCRIPT API)
  const handleFetchFromGoogleSheet = async () => {
    if (!config.backendUrl) {
      alert('URL Google Apps Script belum diisi di menu Pengaturan!');
      return;
    }

    setSyncLoading(true);
    const res = await fetchSantriFromSheet(config.backendUrl);
    setSyncLoading(false);

    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      // Gabungkan dengan data lokal
      const mergedMap: Record<string, Peserta> = {};
      pesertaList.forEach((p) => {
        mergedMap[p.nim] = p;
      });
      res.data.forEach((p: Peserta) => {
        mergedMap[p.nim] = {
          ...mergedMap[p.nim],
          ...p,
        };
      });

      const updated = Object.values(mergedMap);
      setItems('PESERTA', updated);
      setPesertaList(updated);

      setNotification({
        type: 'success',
        message: `Berhasil menarik ${res.data.length} santri dari Google Sheet dan disinkronkan!`,
      });
    } else {
      setNotification({
        type: 'error',
        message: res.message || 'Gagal mengambil data dari Google Sheet.',
      });
    }
    setTimeout(() => setNotification(null), 4000);
  };

  // 4. KIRIM DATA KE GOOGLE SHEET (APPS SCRIPT API)
  const handlePushToGoogleSheet = async () => {
    if (!config.backendUrl) {
      alert('URL Google Apps Script belum diisi di menu Pengaturan!');
      return;
    }

    setSyncLoading(true);
    const res = await pushSantriToSheet(config.backendUrl, pesertaList);
    setSyncLoading(false);

    if (res.success) {
      setNotification({
        type: 'success',
        message: res.message,
      });
    } else {
      setNotification({
        type: 'error',
        message: res.message,
      });
    }
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hidden File Input untuk Spreadsheet */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="hover:underline cursor-pointer text-[11px]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) Tambah Santri Satuan (Ikon Plus Aja) */}
      <button
        onClick={handleOpenAdd}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-btn-emerald text-white flex items-center justify-center cursor-pointer shadow-2xl hover:scale-110 active:scale-95 transition"
        title="Tambah Santri Baru"
      >
        <Plus className="w-6 h-6 shrink-0" />
      </button>

      {/* FILTER & STATS CLUSTER */}
      <div className="bg-white p-3.5 sm:p-5 rounded-[24px] shadow-sm border border-emerald-100 flex flex-col gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama santri / NIM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#f4f8f5] border border-emerald-100 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Filter Batch */}
            <div className="flex-1 sm:flex-initial flex items-center gap-2 bg-[#f4f8f5] px-3 py-2 rounded-xl border border-emerald-100">
              <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <select
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="w-full bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL">Semua Batch</option>
                {batches.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.batchId}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Jurusan */}
            <div className="flex-1 sm:flex-initial flex items-center gap-2 bg-[#f4f8f5] px-3 py-2 rounded-xl border border-emerald-100">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filterJurusan}
                onChange={(e) => setFilterJurusan(e.target.value)}
                className="w-full bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL">Semua Jurusan</option>
                {jurusanList.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ringkasan Jumlah Santri (Tombol Aksi Template, Upload & Kirim Sheet berada di Topbar Header) */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 pt-2 border-t border-slate-100 w-full">
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-emerald-900 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200">
            <span>{filtered.length} Santri Ditampilkan</span>
            <span className="text-slate-400">/</span>
            <span>Total {pesertaList.length} Database</span>
          </div>
        </div>
      </div>

      {/* TABEL DATA SANTRI (Format Sheet Rapi) */}
      <div className="bg-white rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
              <tr>
                <th className="p-3.5 pl-5">No</th>
                <th className="p-3.5">NIM</th>
                <th className="p-3.5">Nama Mahasantri</th>
                <th className="p-3.5">Batch</th>
                <th className="p-3.5">Program Studi</th>
                <th className="p-3.5">Kontak WhatsApp</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Tidak ada data santri yang cocok dengan filter atau pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => (
                  <tr key={p.pesertaId} className="hover:bg-emerald-50/50 transition">
                    <td className="p-3.5 pl-5 font-bold text-emerald-700">{idx + 1}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-700">{p.nim}</td>
                    <td className="p-3.5 font-bold text-slate-900">{p.namaLengkap}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">
                        {p.batchId}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 font-semibold">{p.programStudi}</td>
                    <td className="p-3.5 text-slate-600 font-mono text-[11px]">{p.nomorWhatsApp || '-'}</td>
                    <td className="p-3.5 text-slate-600 truncate max-w-xs">{p.email || '-'}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.statusPeserta === 'AKTIF'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.statusPeserta === 'IZIN'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : p.statusPeserta === 'BELUM_AKTIF'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : p.statusPeserta === 'SELESAI'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.statusPeserta === 'BELUM_AKTIF' ? 'BELUM AKTIF' : p.statusPeserta}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      {deletingPesertaId === p.pesertaId ? (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2 py-1 rounded-xl shadow-xs animate-in fade-in">
                          <span className="text-[10px] font-black text-rose-700">Hapus Santri?</span>
                          <button
                            onClick={() => handleDelete(p.pesertaId, p.namaLengkap)}
                            className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer shadow-xs"
                          >
                            Ya
                          </button>
                          <button
                            onClick={() => setDeletingPesertaId(null)}
                            className="px-1.5 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                            title="Edit Biodata"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingPesertaId(p.pesertaId)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="Hapus Santri"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INPUT/EDIT SANTRI (Sheet Form) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-6 shadow-2xl border border-emerald-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>{editingPeserta ? 'Edit Data Mahasantri' : 'Tambah Mahasantri Baru'}</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">NIM Mahasiswa *</label>
                  <input
                    type="text"
                    required
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    placeholder="Contoh: 231234025"
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Batch Kalender *</label>
                  <select
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-bold"
                  >
                    {batches.map((b) => (
                      <option key={b.batchId} value={b.batchId}>
                        {b.batchId} ({b.namaBatch})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Nama Lengkap Mahasantri *</label>
                <input
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Nama Lengkap Sesuai KTM"
                  className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Program Studi</label>
                  <input
                    type="text"
                    value={programStudi}
                    onChange={(e) => setProgramStudi(e.target.value)}
                    placeholder="DKV / Informatika / Keperawatan"
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Nomor WhatsApp</label>
                  <input
                    type="text"
                    value={nomorWhatsApp}
                    onChange={(e) => setNomorWhatsApp(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@unisa.ac.id"
                  className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Alamat Rumah Santri</label>
                <textarea
                  rows={2}
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Alamat asal tempat tinggal..."
                  className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  {editingPeserta ? 'Simpan Perubahan' : 'Daftarkan & Buat QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
