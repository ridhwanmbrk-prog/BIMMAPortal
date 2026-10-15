import React, { useState, useEffect } from 'react';
import {
  Layers,
  Calendar,
  Clock,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { Batch, Peserta, AgendaBatch } from '../types';
import {
  getItems,
  setItems,
  saveBatch,
  deleteBatch,
  evaluateBatchStatus,
  getBatchStatusInfo,
  getCurrentUser,
} from '../storage';
import { INITIAL_BATCHES } from '../mockData';

export const BatchPage: React.FC = () => {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [batches, setBatches] = useState<Batch[]>([]);
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string>(() => {
    return localStorage.getItem('bimma_active_batch_id') || 'Batch 1';
  });
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'SANTRI'>(() => {
    const saved = localStorage.getItem('bimma_batch_active_tab');
    return saved === 'SANTRI' ? 'SANTRI' : 'AGENDA';
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchSantri, setSearchSantri] = useState('');

  const handleSelectBatch = (id: string) => {
    setActiveBatchId(id);
    localStorage.setItem('bimma_active_batch_id', id);
  };

  const handleSelectTab = (tab: 'AGENDA' | 'SANTRI') => {
    setActiveTab(tab);
    localStorage.setItem('bimma_batch_active_tab', tab);
  };

  // Modal Tambah Batch
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [newBatchId, setNewBatchId] = useState('');
  const [newNamaBatch, setNewNamaBatch] = useState('');
  const [newTahun, setNewTahun] = useState('2026/2027');
  const [newTglMulai, setNewTglMulai] = useState('');
  const [newTglSelesai, setNewTglSelesai] = useState('');
  const [newKeterangan, setNewKeterangan] = useState('');

  // Modal Edit Batch (Khusus Penyesuaian Tanggal Mulai, Tanggal Selesai & Tenggat)
  const [editBatchModalOpen, setEditBatchModalOpen] = useState(false);
  const [editNamaBatch, setEditNamaBatch] = useState('');
  const [editTahun, setEditTahun] = useState('2026/2027');
  const [editTglMulai, setEditTglMulai] = useState('');
  const [editTglSelesai, setEditTglSelesai] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');

  // Modal Agenda Kegiatan (Tambah & Edit)
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [editingAgendaIndex, setEditingAgendaIndex] = useState<number | null>(null);
  const [agendaNama, setAgendaNama] = useState('');
  const [agendaDurasi, setAgendaDurasi] = useState('1 Hari');
  const [agendaTglRentang, setAgendaTglRentang] = useState('');
  const [agendaKeterangan, setAgendaKeterangan] = useState('');

  // Modal Konfirmasi Hapus Batch
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const loadData = () => {
    try {
      const stored = getItems<Batch>('BATCH');
      if (stored && stored.length > 0) {
        setBatches(stored);
        if (!stored.some((b) => b.batchId === activeBatchId)) {
          setActiveBatchId(stored[0].batchId);
        }
      } else {
        setItems('BATCH', INITIAL_BATCHES);
        setBatches(INITIAL_BATCHES);
      }
    } catch {
      setItems('BATCH', INITIAL_BATCHES);
      setBatches(INITIAL_BATCHES);
    }
    setPesertaList(getItems<Peserta>('PESERTA'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const safeBatches = batches && batches.length > 0 ? batches : INITIAL_BATCHES;
  const selectedBatch = safeBatches.find((b) => b.batchId === activeBatchId) || safeBatches[0];
  const safeAgendaList = selectedBatch && Array.isArray(selectedBatch.agendaKalender)
    ? selectedBatch.agendaKalender
    : [];

  const santriBatch = pesertaList.filter((p) => p.batchId === selectedBatch?.batchId);
  const filteredSantri = santriBatch.filter(
    (p) =>
      p.namaLengkap.toLowerCase().includes(searchSantri.toLowerCase()) ||
      p.nim.includes(searchSantri) ||
      p.programStudi.toLowerCase().includes(searchSantri.toLowerCase())
  );

  const handleResetToOfficial = () => {
    if (confirm('Kembalikan konfigurasi ke 3 Batch Kalender Resmi UNISA Bandung?')) {
      setItems('BATCH', INITIAL_BATCHES);
      setBatches(INITIAL_BATCHES);
      setActiveBatchId('Batch 1');
      setNotification({ type: 'success', message: 'Kalender 3 Batch berhasil disinkronkan kembali ke jadwal resmi.' });
      setTimeout(() => setNotification(null), 3500);
      loadData();
    }
  };

  // Simpan Batch Baru
  const handleSaveNewBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchId.trim() || !newNamaBatch.trim() || !newTglMulai || !newTglSelesai) {
      alert('Harap lengkapi semua kolom wajib!');
      return;
    }

    const newBatch: Batch = {
      batchId: newBatchId.trim(),
      namaBatch: newNamaBatch.trim(),
      tahun: newTahun.trim(),
      tanggalMulai: newTglMulai,
      tanggalSelesai: newTglSelesai,
      statusBatch: evaluateBatchStatus({
        batchId: newBatchId,
        namaBatch: newNamaBatch,
        tahun: newTahun,
        tanggalMulai: newTglMulai,
        tanggalSelesai: newTglSelesai,
        statusBatch: 'BELUM_AKTIF',
        agendaKalender: [],
      }),
      keterangan: newKeterangan.trim() || `${newTglMulai} s/d ${newTglSelesai}`,
      agendaKalender: [
        {
          namaAgenda: `Kedatangan Santri ${newBatchId.trim()}`,
          durasi: '1 Hari',
          tanggalRentang: newTglMulai,
          keterangan: 'Pembukaan & check-in asrama',
        },
        {
          namaAgenda: `Kegiatan Bimbingan & Absensi`,
          durasi: '4 Minggu',
          tanggalRentang: `${newTglMulai} s/d ${newTglSelesai}`,
          keterangan: 'Masa aktif pembinaan santri',
        },
        {
          namaAgenda: `Kepulangan Santri ${newBatchId.trim()}`,
          durasi: '1 Hari',
          tanggalRentang: newTglSelesai,
          keterangan: 'Penutupan & kepulangan',
        },
      ],
    };

    const res = saveBatch(newBatch);
    if (res.success) {
      setNotification({ type: 'success', message: res.message });
      setTimeout(() => setNotification(null), 4000);
      setBatchModalOpen(false);
      setActiveBatchId(newBatch.batchId);
      // Reset form
      setNewBatchId('');
      setNewNamaBatch('');
      setNewTglMulai('');
      setNewTglSelesai('');
      setNewKeterangan('');
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Buka Modal Edit Batch
  const handleOpenEditBatch = () => {
    if (!selectedBatch) return;
    setEditNamaBatch(selectedBatch.namaBatch);
    setEditTahun(selectedBatch.tahun || '2026/2027');
    setEditTglMulai(selectedBatch.tanggalMulai);
    setEditTglSelesai(selectedBatch.tanggalSelesai);
    setEditKeterangan(selectedBatch.keterangan || `${selectedBatch.tanggalMulai} s/d ${selectedBatch.tanggalSelesai}`);
    setEditBatchModalOpen(true);
  };

  // Simpan Edit Batch (Tanggal Mulai/Selesai, Nama, Keterangan)
  const handleSaveEditBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !editNamaBatch.trim() || !editTglMulai || !editTglSelesai) {
      alert('Harap isi semua kolom wajib!');
      return;
    }

    const updatedBatch: Batch = {
      ...selectedBatch,
      namaBatch: editNamaBatch.trim(),
      tahun: editTahun.trim(),
      tanggalMulai: editTglMulai,
      tanggalSelesai: editTglSelesai,
      keterangan: editKeterangan.trim(),
      statusBatch: evaluateBatchStatus({
        ...selectedBatch,
        tanggalMulai: editTglMulai,
        tanggalSelesai: editTglSelesai,
      }),
    };

    const res = saveBatch(updatedBatch);
    if (res.success) {
      setNotification({
        type: 'success',
        message: `Perubahan tanggal & data ${updatedBatch.batchId} berhasil disimpan! Sistem otomatis memperbarui status batch & seluruh santri terkait.`,
      });
      setTimeout(() => setNotification(null), 5000);
      setEditBatchModalOpen(false);
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Hapus Batch
  const handleDeleteBatch = () => {
    if (!selectedBatch) return;
    const res = deleteBatch(selectedBatch.batchId);
    if (res.success) {
      setNotification({ type: 'success', message: res.message });
      setTimeout(() => setNotification(null), 4000);
      setDeleteConfirmOpen(false);
      const remaining = batches.filter((b) => b.batchId !== selectedBatch.batchId);
      if (remaining.length > 0) setActiveBatchId(remaining[0].batchId);
      loadData();
    } else {
      alert(res.message);
      setDeleteConfirmOpen(false);
    }
  };

  // Buka Modal Tambah Agenda
  const handleOpenAddAgenda = () => {
    setEditingAgendaIndex(null);
    setAgendaNama('');
    setAgendaDurasi('1 Hari');
    setAgendaTglRentang(selectedBatch ? `${selectedBatch.tanggalMulai}` : '');
    setAgendaKeterangan('');
    setAgendaModalOpen(true);
  };

  // Buka Modal Edit Agenda
  const handleOpenEditAgenda = (idx: number) => {
    if (!selectedBatch || !safeAgendaList[idx]) return;
    const item = safeAgendaList[idx];
    setEditingAgendaIndex(idx);
    setAgendaNama(item.namaAgenda);
    setAgendaDurasi(item.durasi);
    setAgendaTglRentang(item.tanggalRentang);
    setAgendaKeterangan(item.keterangan || '');
    setAgendaModalOpen(true);
  };

  // Simpan Agenda (Tambah Baru atau Edit Yang Ada)
  const handleSaveAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !agendaNama.trim() || !agendaTglRentang.trim()) return;

    const agendaItem: AgendaBatch = {
      namaAgenda: agendaNama.trim(),
      durasi: agendaDurasi.trim(),
      tanggalRentang: agendaTglRentang.trim(),
      keterangan: agendaKeterangan.trim(),
    };

    let updatedAgendas: AgendaBatch[];
    if (editingAgendaIndex !== null) {
      updatedAgendas = safeAgendaList.map((item, i) =>
        i === editingAgendaIndex ? agendaItem : item
      );
    } else {
      updatedAgendas = [...safeAgendaList, agendaItem];
    }

    const updatedBatch: Batch = {
      ...selectedBatch,
      agendaKalender: updatedAgendas,
    };

    saveBatch(updatedBatch);
    setNotification({
      type: 'success',
      message:
        editingAgendaIndex !== null
          ? `Agenda '${agendaNama}' berhasil diperbarui!`
          : `Kegiatan agenda '${agendaNama}' berhasil ditambahkan ke ${selectedBatch.batchId}!`,
    });
    setTimeout(() => setNotification(null), 3500);
    setAgendaModalOpen(false);
    setEditingAgendaIndex(null);
    setAgendaNama('');
    setAgendaTglRentang('');
    setAgendaKeterangan('');
    loadData();
  };

  // Hapus Agenda Kegiatan dari Batch
  const handleDeleteAgenda = (idx: number) => {
    if (!selectedBatch) return;
    const updatedAgendas = safeAgendaList.filter((_, i) => i !== idx);
    const updatedBatch: Batch = {
      ...selectedBatch,
      agendaKalender: updatedAgendas,
    };
    saveBatch(updatedBatch);
    loadData();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:underline cursor-pointer text-[11px]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) Tambah Batch di Pojok Kanan Bawah (Ikon Plus Aja) */}
      <button
        onClick={() => setBatchModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-btn-emerald text-white flex items-center justify-center cursor-pointer shadow-2xl hover:scale-110 active:scale-95 transition"
        title="Tambah Batch Baru"
      >
        <Plus className="w-6 h-6 shrink-0" />
      </button>

      {/* BATCH OVERVIEW CARDS TERINTEGRASI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {safeBatches.map((b) => {
          const isSelected = b.batchId === activeBatchId;
          const agendaCount = Array.isArray(b.agendaKalender) ? b.agendaKalender.length : 0;
          const countSantri = pesertaList.filter((p) => p.batchId === b.batchId).length;
          const bInfo = getBatchStatusInfo(b);

          return (
            <div
              key={b.batchId}
              onClick={() => setActiveBatchId(b.batchId)}
              className={`p-6 rounded-[32px] border transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-br from-[#059669] to-[#047857] text-white shadow-xl shadow-emerald-950/20 border-transparent scale-102'
                  : 'bg-white border-emerald-100 text-slate-800 shadow-sm hover:border-emerald-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isSelected
                        ? bInfo.status === 'AKTIF'
                          ? 'bg-white text-emerald-900'
                          : 'bg-amber-400 text-amber-950'
                        : bInfo.badgeClass
                    }`}
                  >
                    {bInfo.badgeText}
                  </span>
                  <span className={`text-xs font-bold font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    Tahun {b.tahun}
                  </span>
                </div>

                <h3 className="text-lg font-black mt-3">{b.namaBatch}</h3>
                <p className={`text-xs mt-1 font-semibold ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {b.keterangan || `${b.tanggalMulai} s/d ${b.tanggalSelesai}`}
                </p>

                {/* Terintegrasi Jumlah Santri */}
                <div className="mt-4 flex items-center gap-2">
                  <div
                    className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{countSantri} Mahasantri Terdaftar</span>
                  </div>
                </div>
              </div>

              <div
                className={`mt-5 pt-3 border-t text-xs font-bold flex items-center justify-between ${
                  isSelected ? 'border-white/20 text-white' : 'border-emerald-100 text-emerald-700'
                }`}
              >
                <span>{agendaCount} Rangkaian Agenda</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAIL KALENDER BIMMA & DAFTAR SANTRI BATCH */}
      {selectedBatch && (
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 shadow-sm border border-emerald-100 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-emerald-100 gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                  <span className="truncate">Rincian Resmi — {selectedBatch.namaBatch}</span>
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black ${getBatchStatusInfo(selectedBatch).badgeClass}`}>
                  {getBatchStatusInfo(selectedBatch).badgeText}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Rentang: <b className="text-emerald-800">{selectedBatch.tanggalMulai} s.d. {selectedBatch.tanggalSelesai}</b> (Strictly by date today)
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap self-start lg:self-auto">
              {/* Tombol Edit Tanggal & Batch */}
              <button
                onClick={handleOpenEditBatch}
                title={`Edit Tanggal & Data ${selectedBatch.batchId}`}
                className="h-8 px-2.5 sm:px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="hidden sm:inline">Edit Batch</span>
              </button>

              {/* Tombol Hapus Batch */}
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                title={`Hapus ${selectedBatch.batchId}`}
                className="h-8 px-2.5 sm:px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Hapus</span>
              </button>

              {/* Tab Navigasi Kalender vs Santri */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-[#f4f8f5] p-1 rounded-xl sm:rounded-2xl border border-emerald-100">
                <button
                  onClick={() => setActiveTab('AGENDA')}
                  className={`h-7 sm:h-8 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'AGENDA'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Kalender Agenda</span>
                  <span>({safeAgendaList.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('SANTRI')}
                  className={`h-7 sm:h-8 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'SANTRI'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Mahasantri</span>
                  <span>({santriBatch.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: KALENDER AGENDA */}
          {activeTab === 'AGENDA' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  Rangkaian jadwal kegiatan, placement test, dan kepulangan pada {selectedBatch.namaBatch}.
                </p>
                <button
                  onClick={handleOpenAddAgenda}
                  className="self-start sm:self-auto h-8 px-3 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Tambah Agenda</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-emerald-100/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
                    <tr>
                      <th className="p-3.5 pl-5">No</th>
                      <th className="p-3.5">Nama Kegiatan / Agenda</th>
                      <th className="p-3.5">Durasi Waktu</th>
                      <th className="p-3.5">Tanggal Pelaksanaan</th>
                      <th className="p-3.5 pr-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 font-medium">
                    {safeAgendaList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          Belum ada agenda kegiatan dalam batch ini. Klik '+ Tambah Agenda' untuk menambahkan.
                        </td>
                      </tr>
                    ) : (
                      safeAgendaList.map((ag, idx) => (
                        <tr key={idx} className="hover:bg-emerald-50/50 transition">
                          <td className="p-3.5 pl-5 font-bold text-emerald-700">
                            {idx + 1}.
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">
                            {ag.namaAgenda}
                            {ag.keterangan && (
                              <p className="text-[10px] text-slate-400 font-normal">{ag.keterangan}</p>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-600 font-semibold">
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-2.5 py-0.5 rounded-md text-[11px]">
                              {ag.durasi}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-emerald-800 font-mono">
                            {ag.tanggalRentang}
                          </td>
                          <td className="p-3.5 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditAgenda(idx)}
                                title="Edit Agenda"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAgenda(idx)}
                                title="Hapus Agenda"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: DAFTAR MAHASANTRI TERDAFTAR DI BATCH INI */}
          {activeTab === 'SANTRI' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative w-full max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchSantri}
                    onChange={(e) => setSearchSantri(e.target.value)}
                    placeholder="Cari santri di batch ini..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">
                  Total: {santriBatch.length} Mahasantri
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-emerald-100/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
                    <tr>
                      <th className="p-3 pl-4">No</th>
                      <th className="p-3">NIM</th>
                      <th className="p-3">Nama Mahasantri</th>
                      <th className="p-3">Program Studi</th>
                      <th className="p-3">No WhatsApp</th>
                      <th className="p-3 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 font-medium">
                    {filteredSantri.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          Tidak ada santri yang terdaftar dalam batch ini.
                        </td>
                      </tr>
                    ) : (
                      filteredSantri.map((s, idx) => (
                        <tr key={s.pesertaId} className="hover:bg-emerald-50/50 transition">
                          <td className="p-3 pl-4 font-bold text-emerald-700">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">{s.nim}</td>
                          <td className="p-3 font-bold text-slate-900">{s.namaLengkap}</td>
                          <td className="p-3 text-slate-600">{s.programStudi}</td>
                          <td className="p-3 text-slate-600 font-mono text-[11px]">{s.nomorWhatsApp || '-'}</td>
                          <td className="p-3 pr-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.statusPeserta === 'AKTIF'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.statusPeserta === 'IZIN'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {s.statusPeserta}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL TAMBAH BATCH BARU */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Tambah Batch Baru</span>
              </h3>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewBatch} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ID Batch *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Batch 4"
                    value={newBatchId}
                    onChange={(e) => setNewBatchId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran *</label>
                  <input
                    type="text"
                    required
                    placeholder="2026/2027"
                    value={newTahun}
                    onChange={(e) => setNewTahun(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Batch / Periode *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Batch 4 - Periode Matrikulasi"
                  value={newNamaBatch}
                  onChange={(e) => setNewNamaBatch(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={newTglMulai}
                    onChange={(e) => setNewTglMulai(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={newTglSelesai}
                    onChange={(e) => setNewTglSelesai(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Jadwal Tenggat</label>
                <input
                  type="text"
                  placeholder="Contoh: 1 Agustus 2027 – 15 September 2027"
                  value={newKeterangan}
                  onChange={(e) => setNewKeterangan(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Otomatisasi Sistem:</strong> Status batch akan otomatis dievaluasi: jika tanggal mulai belum tiba maka berstatus <strong>BELUM AKTIF</strong>, jika sedang dalam rentang tanggal maka <strong>AKTIF</strong>, dan jika telah lewat maka <strong>SELESAI</strong>.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  Simpan Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT TANGGAL & DATA BATCH */}
      {editBatchModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <span>Edit Tanggal & Data — {selectedBatch.batchId}</span>
              </h3>
              <button
                onClick={() => setEditBatchModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBatch} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ID Batch</label>
                  <input
                    type="text"
                    disabled
                    value={selectedBatch.batchId}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-100 font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran *</label>
                  <input
                    type="text"
                    required
                    placeholder="2026/2027"
                    value={editTahun}
                    onChange={(e) => setEditTahun(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Batch / Periode *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Batch 1 - Periode Taaruf & Bimbingan"
                  value={editNamaBatch}
                  onChange={(e) => setEditNamaBatch(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={editTglMulai}
                    onChange={(e) => setEditTglMulai(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={editTglSelesai}
                    onChange={(e) => setEditTglSelesai(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Jadwal Tenggat</label>
                <input
                  type="text"
                  placeholder="Contoh: 5 Des 2026 – 16 Jan 2027"
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800"
                />
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 leading-relaxed space-y-1">
                <div className="font-black flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Integrasi Otomatisasi Tanggal & Status Mahasantri:</span>
                </div>
                <p>
                  Jika ada penambahan kegiatan di awal sehingga jadwal dimajukan ke hari ini atau sebelumnya, sistem akan langsung mengevaluasi status batch menjadi <strong>AKTIF</strong>. Seluruh status mahasantri di batch ini akan langsung disinkronkan menjadi <strong>AKTIF</strong> di database dan tabel presensi!
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  Simpan Perubahan Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AGENDA KEGIATAN (TAMBAH & EDIT) */}
      {agendaModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                <span>
                  {editingAgendaIndex !== null
                    ? `Edit Agenda di ${selectedBatch.batchId}`
                    : `+ Agenda di ${selectedBatch.batchId}`}
                </span>
              </h3>
              <button
                onClick={() => setAgendaModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgenda} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Kegiatan / Agenda *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Penilaian Praktik Ibadah & BTAQ"
                  value={agendaNama}
                  onChange={(e) => setAgendaNama(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Durasi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: 2 Hari / 4 Minggu"
                    value={agendaDurasi}
                    onChange={(e) => setAgendaDurasi(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rentang Tanggal *</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: 11 Jan – 12 Jan 2027"
                    value={agendaTglRentang}
                    onChange={(e) => setAgendaTglRentang(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan Tambahan</label>
                <input
                  type="text"
                  placeholder="Opsional, keterangan teknis"
                  value={agendaKeterangan}
                  onChange={(e) => setAgendaKeterangan(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAgendaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  {editingAgendaIndex !== null ? 'Simpan Perubahan Agenda' : 'Tambahkan ke Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS BATCH */}
      {deleteConfirmOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Hapus {selectedBatch.namaBatch}?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tindakan ini akan menghapus batch beserta kalender agendanya. Batch yang masih memiliki santri terdaftar tidak dapat dihapus.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer shadow-md text-xs"
              >
                Ya, Hapus Batch Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
