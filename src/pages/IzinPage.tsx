import { getBusinessDateString } from '../utils/date';
import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  User,
  Download,
  QrCode,
  UserCheck,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Check,
  X,
} from 'lucide-react';
import { Izin, Peserta, JenisIzin } from '../types';
import {
  getItems,
  setItems,
  getCurrentUser,
  getActiveMusyrif,
  addAuditLog,
  approveIzin,
  rejectIzin,
  verifyKedatanganSantri,
} from '../storage';
import { QuickStudentPicker } from '../components/QuickStudentPicker';
import { generateSuratIzinPdf } from '../utils/suratIzinPdf';

interface IzinPageProps {
  onOpenScanner?: (mode?: 'PRESENSI' | 'SURAT_IZIN') => void;
}

export const IzinPage: React.FC<IzinPageProps> = ({ onOpenScanner }) => {
  const [izinList, setIzinList] = useState<Izin[]>([]);
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'MENUNGGU' | 'SEDANG_IZIN' | 'KEMBALI'>(() => {
    return (localStorage.getItem('bimma_izin_filter_tab') as any) || 'ALL';
  });
  const [searchQuery, setSearchQuery] = useState('');

  const handleSetFilterTab = (tab: 'ALL' | 'MENUNGGU' | 'SEDANG_IZIN' | 'KEMBALI') => {
    setFilterTab(tab);
    localStorage.setItem('bimma_izin_filter_tab', tab);
  };

  // Form Modal Ajukan Izin
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPesertaId, setSelectedPesertaId] = useState('');
  const [jenisIzin, setJenisIzin] = useState<JenisIzin>('IZIN_PULANG');
  const [waktuMulai, setWaktuMulai] = useState(getBusinessDateString() + 'T08:00');
  const [waktuSelesai, setWaktuSelesai] = useState(getBusinessDateString() + 'T21:00');
  const [alasanIzin, setAlasanIzin] = useState('');

  // Modal Verifikasi Kedatangan Santri
  const [verifikasiModalOpen, setVerifikasiModalOpen] = useState(false);
  const [targetIzinVerifikasi, setTargetIzinVerifikasi] = useState<Izin | null>(null);
  const [verifikasiInputKey, setVerifikasiInputKey] = useState('');
  const [verifikasiCatatan, setVerifikasiCatatan] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  const loadData = () => {
    setIzinList(getItems<Izin>('IZIN'));
    setPesertaList(getItems<Peserta>('PESERTA'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const pesertaMap = pesertaList.reduce((acc, p) => {
    acc[p.pesertaId] = p;
    return acc;
  }, {} as Record<string, Peserta>);

  const now = new Date();

  const handleSaveIzin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPesertaId || !alasanIzin.trim()) return;

    const newId = `IZ${String(izinList.length + 1).padStart(4, '0')}`;
    const newIzin: Izin = {
      izinId: newId,
      pesertaId: selectedPesertaId,
      jenisIzin,
      waktuMulai,
      waktuSelesai,
      alasan: alasanIzin.trim(),
      diajukanOleh: currentUser?.id || 'U002',
      waktuPengajuan: new Date().toISOString(),
      statusPersetujuan: 'MENUNGGU',
    };

    const updated = [newIzin, ...izinList];
    setItems('IZIN', updated);
    setIzinList(updated);
    setModalOpen(false);
    setAlasanIzin('');

    setToastMessage(`Pengajuan ${jenisIzin.replace('_', ' ')} untuk ${pesertaMap[selectedPesertaId]?.namaLengkap} berhasil diajukan.`);
    setTimeout(() => setToastMessage(null), 4000);

    addAuditLog({
      penggunaId: currentUser?.id || 'U002',
      aksi: 'AJUKAN_IZIN',
      jenisEntitas: 'IZIN',
      entitasId: newId,
      nilaiSesudah: `${jenisIzin} - ${pesertaMap[selectedPesertaId]?.namaLengkap}`,
      alasan: alasanIzin,
      statusAksi: 'BERHASIL',
    });
  };

  const handleDecideIzin = (izinId: string, status: 'DISETUJUI' | 'DITOLAK') => {
    if (status === 'DISETUJUI') {
      const res = approveIzin(izinId, currentUser?.id || 'U001');
      if (res.success) {
        setToastMessage(res.message);
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        window.alert(res.message);
      }
    } else {
      rejectIzin(izinId, currentUser?.id || 'U001');
      setToastMessage('Izin telah ditolak.');
      setTimeout(() => setToastMessage(null), 4000);
    }
    loadData();
  };

  const handleOpenVerifikasiModal = (iz?: Izin) => {
    if (iz) {
      setTargetIzinVerifikasi(iz);
      setVerifikasiInputKey(iz.kodeVerifikasi || iz.izinId);
    } else {
      setTargetIzinVerifikasi(null);
      setVerifikasiInputKey('');
    }
    setVerifikasiCatatan('Santri telah kembali ke asrama tepat waktu.');
    setVerifikasiModalOpen(true);
  };

  const handleConfirmVerifikasi = (e: React.FormEvent) => {
    e.preventDefault();
    const activeMusyrif = getActiveMusyrif();
    const petugasNama = activeMusyrif?.nama || currentUser?.namaLengkap || 'Petugas Musyrif';
    const key = verifikasiInputKey.trim() || targetIzinVerifikasi?.kodeVerifikasi || targetIzinVerifikasi?.izinId || '';

    if (!key) return;
    const res = verifyKedatanganSantri(key, petugasNama, verifikasiCatatan);
    if (res.success) {
      setToastMessage(res.message);
      setTimeout(() => setToastMessage(null), 5000);
      setVerifikasiModalOpen(false);
      setTargetIzinVerifikasi(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Filter list
  const filteredList = izinList.filter((iz) => {
    const santri = pesertaMap[iz.pesertaId];
    const matchSearch =
      (santri?.namaLengkap || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (santri?.nim || '').includes(searchQuery) ||
      (iz.nomorSurat || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (iz.kodeVerifikasi || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (filterTab === 'MENUNGGU') return iz.statusPersetujuan === 'MENUNGGU';
    if (filterTab === 'SEDANG_IZIN')
      return iz.statusPersetujuan === 'DISETUJUI' && iz.statusKedatangan !== 'SUDAH_KEMBALI' && iz.statusKedatangan !== 'TERLAMBAT';
    if (filterTab === 'KEMBALI')
      return iz.statusPersetujuan === 'DISETUJUI' && (iz.statusKedatangan === 'SUDAH_KEMBALI' || iz.statusKedatangan === 'TERLAMBAT');

    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:underline cursor-pointer text-[11px]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) Ajukan Izin (Ikon Plus Aja di Pojok Bawah Kanan) */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-btn-emerald text-white flex items-center justify-center cursor-pointer shadow-2xl hover:scale-110 active:scale-95 transition"
        title="Ajukan Izin Mahasantri"
      >
        <Plus className="w-6 h-6 shrink-0" />
      </button>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-[20px] sm:rounded-[24px] border border-emerald-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 w-full sm:w-auto">
          <button
            onClick={() => handleSetFilterTab('ALL')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-bold cursor-pointer transition shrink-0 text-[11px] sm:text-xs ${
              filterTab === 'ALL'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-[#f4f8f5] text-slate-700 hover:bg-emerald-100'
            }`}
          >
            Semua ({izinList.length})
          </button>
          <button
            onClick={() => handleSetFilterTab('MENUNGGU')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-bold cursor-pointer transition shrink-0 text-[11px] sm:text-xs ${
              filterTab === 'MENUNGGU'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-[#f4f8f5] text-slate-700 hover:bg-emerald-100'
            }`}
          >
            Menunggu ACC ({izinList.filter((i) => i.statusPersetujuan === 'MENUNGGU').length})
          </button>
          <button
            onClick={() => handleSetFilterTab('SEDANG_IZIN')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-bold cursor-pointer transition shrink-0 text-[11px] sm:text-xs ${
              filterTab === 'SEDANG_IZIN'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            Sedang Izin ({
              izinList.filter(
                (i) => i.statusPersetujuan === 'DISETUJUI' && i.statusKedatangan !== 'SUDAH_KEMBALI' && i.statusKedatangan !== 'TERLAMBAT'
              ).length
            })
          </button>
          <button
            onClick={() => handleSetFilterTab('KEMBALI')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-bold cursor-pointer transition shrink-0 text-[11px] sm:text-xs ${
              filterTab === 'KEMBALI'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-[#f4f8f5] text-slate-700 hover:bg-emerald-100'
            }`}
          >
            Kembali ({
              izinList.filter(
                (i) => i.statusPersetujuan === 'DISETUJUI' && (i.statusKedatangan === 'SUDAH_KEMBALI' || i.statusKedatangan === 'TERLAMBAT')
              ).length
            })
          </button>
        </div>

        <div className="relative w-full sm:w-60 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, NIM, no surat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
          />
        </div>
      </div>

      {/* Tabel Data Izin Santri */}
      <div className="bg-white rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
              <tr>
                <th className="p-3.5 pl-5">NIM & Mahasantri</th>
                <th className="p-3.5">Jenis Izin</th>
                <th className="p-3.5">Waktu Mulai s/d Batas Kembali</th>
                <th className="p-3.5">Alasan Keterangan</th>
                <th className="p-3.5">Status ACC & Kedatangan</th>
                <th className="p-3.5">Surat Bukti Digital</th>
                <th className="p-3.5 pr-5 text-right">Aksi Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50 font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Tidak ada data pengajuan izin pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((iz) => {
                  const santri = pesertaMap[iz.pesertaId];
                  const deadline = new Date(iz.waktuSelesai);
                  const isOverdue =
                    iz.statusPersetujuan === 'DISETUJUI' &&
                    iz.statusKedatangan !== 'SUDAH_KEMBALI' &&
                    iz.statusKedatangan !== 'TERLAMBAT' &&
                    now > deadline;

                  return (
                    <tr key={iz.izinId} className="hover:bg-emerald-50/50 transition">
                      <td className="p-3.5 pl-5">
                        <div className="font-bold text-slate-900">{santri?.namaLengkap || iz.pesertaId}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {santri?.nim || '-'} • {santri?.batchId || '-'}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            iz.jenisIzin === 'IZIN_PULANG'
                              ? 'bg-blue-100 text-blue-800'
                              : iz.jenisIzin === 'SAKIT'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {iz.jenisIzin.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="p-3.5 text-[11px]">
                        <div className="text-slate-700 font-medium">
                          Mulai: {iz.waktuMulai.replace('T', ' ')} WIB
                        </div>
                        <div
                          className={`font-bold mt-0.5 ${
                            isOverdue ? 'text-rose-700' : 'text-slate-600'
                          }`}
                        >
                          Batas: {iz.waktuSelesai.replace('T', ' ')} WIB
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-600 max-w-xs truncate" title={iz.alasan}>
                        {iz.alasan}
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              iz.statusPersetujuan === 'DISETUJUI'
                                ? 'bg-emerald-100 text-emerald-800'
                                : iz.statusPersetujuan === 'DITOLAK'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            ACC: {iz.statusPersetujuan}
                          </span>

                          {iz.statusPersetujuan === 'DISETUJUI' && (
                            <div>
                              {iz.statusKedatangan === 'SUDAH_KEMBALI' || iz.statusKedatangan === 'TERLAMBAT' ? (
                                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black flex items-center gap-1 w-max ${iz.statusKedatangan === 'TERLAMBAT' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                  <Check className="w-2.5 h-2.5" />
                                  <span>{iz.statusKedatangan === 'TERLAMBAT' ? 'TELAH KEMBALI TERLAMBAT' : 'TELAH KEMBALI'}</span>
                                </span>
                              ) : isOverdue ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center gap-1 w-max animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>BELUM HADIR (ALPA)</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold w-max block">
                                  SEDANG DI LUAR ASRAMA
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Surat Resmi PDF Output */}
                      <td className="p-3.5">
                        {iz.statusPersetujuan === 'DISETUJUI' && santri ? (
                          <div className="space-y-1">
                            <button
                              onClick={() => generateSuratIzinPdf(iz, santri, currentUser?.namaLengkap)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition"
                              title="Unduh PDF Surat Izin"
                            >
                              <Download className="w-3 h-3 text-emerald-700 shrink-0" />
                              <span className="hidden sm:inline">Unduh PDF</span>
                            </button>
                            {iz.kodeVerifikasi && (
                              <div className="font-mono text-[9px] text-slate-500 truncate max-w-[130px]">
                                {iz.kodeVerifikasi}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Menunggu ACC</span>
                        )}
                      </td>

                      {/* Aksi Tindakan */}
                      <td className="p-3.5 pr-5 text-right">
                        {isAdmin && iz.statusPersetujuan === 'MENUNGGU' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDecideIzin(iz.izinId, 'DISETUJUI')}
                              className="px-2.5 sm:px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs flex items-center gap-1"
                              title="Setujui Pengajuan Izin"
                            >
                              <Check className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline">Setujui</span>
                            </button>
                            <button
                              onClick={() => handleDecideIzin(iz.izinId, 'DITOLAK')}
                              className="px-2 sm:px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="Tolak Pengajuan Izin"
                            >
                              <X className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline">Tolak</span>
                            </button>
                          </div>
                        ) : iz.statusPersetujuan === 'DISETUJUI' && iz.statusKedatangan !== 'SUDAH_KEMBALI' && iz.statusKedatangan !== 'TERLAMBAT' ? (
                          <button
                            onClick={() => handleOpenVerifikasiModal(iz)}
                            className="px-2.5 sm:px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs flex items-center gap-1"
                            title="Verifikasi Kedatangan Kembali"
                          >
                            <UserCheck className="w-3 h-3 shrink-0" />
                            <span className="hidden sm:inline">Verifikasi Tiba</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold">Tuntas</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajukan Izin */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>+ Ajukan Surat Izin Santri</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIzin} className="space-y-3 text-xs">
              <div>
                <QuickStudentPicker
                  selectedPesertaId={selectedPesertaId}
                  onSelectPeserta={(p) => setSelectedPesertaId(p ? p.pesertaId : '')}
                  pesertaList={pesertaList}
                  label="Pilih Mahasantri *"
                  placeholder="Ketik Nama atau NIM..."
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jenis Izin *</label>
                <select
                  value={jenisIzin}
                  onChange={(e) => setJenisIzin(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="IZIN_PULANG">Izin Pulang ke Rumah / Keluarga</option>
                  <option value="SAKIT">Izin Sakit (Klinik / Dokter)</option>
                  <option value="KEPERLUAN_SYARI">Keperluan Syar'i / Takziah</option>
                  <option value="IZIN_KHUSUS">Izin Khusus / Dispensasi Kuliah</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Waktu Mulai *</label>
                  <input
                    type="datetime-local"
                    required
                    value={waktuMulai}
                    onChange={(e) => setWaktuMulai(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 text-slate-800 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batas Waktu Kembali *</label>
                  <input
                    type="datetime-local"
                    required
                    value={waktuSelesai}
                    onChange={(e) => setWaktuSelesai(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 text-slate-800 text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alasan Lengkap Izin *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Keterangan keperluan pulang / kondisi medis sakit..."
                  value={alasanIzin}
                  onChange={(e) => setAlasanIzin(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                <strong>Alur Surat & Verifikasi:</strong> Setelah di-ACC oleh Admin/Musyrif, surat izin resmi ber-QR code unik akan langsung dapat diunduh (PDF) dan status santri menjadi <strong>IZIN</strong>.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Verifikasi Kedatangan Santri */}
      {verifikasiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Verifikasi Kedatangan Santri</h3>
                  <p className="text-[11px] text-slate-500">Konfirmasi kepulangan kembali ke asrama</p>
                </div>
              </div>
              <button
                onClick={() => setVerifikasiModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmVerifikasi} className="space-y-3.5 text-xs">
              {targetIzinVerifikasi ? (
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 space-y-1">
                  <div className="font-black text-emerald-950 text-sm">
                    {pesertaMap[targetIzinVerifikasi.pesertaId]?.namaLengkap || targetIzinVerifikasi.pesertaId}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-mono">
                    NIM: {pesertaMap[targetIzinVerifikasi.pesertaId]?.nim} • {targetIzinVerifikasi.jenisIzin.replace('_', ' ')}
                  </div>
                  <div className="text-[10px] text-emerald-700 pt-1 border-t border-emerald-200 mt-1 space-y-0.5">
                    <div>No Surat: <span className="font-bold font-mono">{targetIzinVerifikasi.nomorSurat || '-'}</span></div>
                    <div>Kode Verifikasi: <span className="font-bold font-mono">{targetIzinVerifikasi.kodeVerifikasi || '-'}</span></div>
                    <div>Batas Waktu: <span className="font-bold text-rose-700">{targetIzinVerifikasi.waktuSelesai.replace('T', ' ')} WIB</span></div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      Kode Unik Surat Verifikasi / NIM Santri *
                    </label>
                    {onOpenScanner && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifikasiModalOpen(false);
                          onOpenScanner('SURAT_IZIN');
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Buka Scan Kamera</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: VRF-IZN-0001-K9X2 atau NIM Santri..."
                    value={verifikasiInputKey}
                    onChange={(e) => setVerifikasiInputKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Ketik kode unik dari surat izin santri atau klik tombol Buka Scan Kamera di atas untuk scan QR surat.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Musyrif Penerima
                </label>
                <input
                  type="text"
                  placeholder="Misal: Tiba tepat waktu, kondisi sehat walafiat"
                  value={verifikasiCatatan}
                  onChange={(e) => setVerifikasiCatatan(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                <strong>Ketentuan Kehadiran:</strong> Setelah diverifikasi kedatangannya, status santri di database otomatis <strong>kembali AKTIF</strong> dan <strong>tidak akan kena sanksi ALPA</strong>. Jika santri belum hadir melewati batas waktu, status akan ditandai Alpa.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVerifikasiModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Verifikasi Kedatangan Santri</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
