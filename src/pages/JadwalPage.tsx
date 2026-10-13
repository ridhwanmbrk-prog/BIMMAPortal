import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import { JadwalKegiatan } from '../types';
import { getItems, setItems, getCurrentUser, addAuditLog } from '../storage';

export const JadwalPage: React.FC = () => {
  const [jadwalList, setJadwalList] = useState<JadwalKegiatan[]>([]);

  // Modal Tambah/Edit Jadwal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<JadwalKegiatan | null>(null);

  // In-app Delete Confirmation (Inline & Modal)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    jadwal: JadwalKegiatan | null;
  }>({ open: false, jadwal: null });

  // Form Fields
  const [namaKegiatan, setNamaKegiatan] = useState('');
  const [jamMulai, setJamMulai] = useState('17:45');
  const [jamSelesai, setJamSelesai] = useState('18:30');
  const [toleransiAwal, setToleransiAwal] = useState(20);
  const [toleransiAkhir, setToleransiAkhir] = useState(15);
  const [keterangan, setKeterangan] = useState('');
  const [statusAktif, setStatusAktif] = useState(true);

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  const loadData = () => {
    setJadwalList(getItems<JadwalKegiatan>('JADWAL'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    if (!isAdmin) return;
    setEditingJadwal(null);
    setNamaKegiatan('');
    setJamMulai('17:45');
    setJamSelesai('18:30');
    setToleransiAwal(20);
    setToleransiAkhir(15);
    setKeterangan('');
    setStatusAktif(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (j: JadwalKegiatan) => {
    if (!isAdmin) return;
    setEditingJadwal(j);
    setNamaKegiatan(j.namaKegiatan);
    setJamMulai(j.jamMulai);
    setJamSelesai(j.jamSelesai);
    setToleransiAwal(j.toleransiBukaAwal || 15);
    setToleransiAkhir(j.toleransiTutupAkhir || 15);
    setKeterangan(j.keterangan || '');
    setStatusAktif(j.statusAktif);
    setModalOpen(true);
  };

  // Toggle Aktif / Nonaktif
  const handleToggleAktif = (j: JadwalKegiatan) => {
    if (!isAdmin) return;
    const updated = jadwalList.map((item) =>
      item.jadwalId === j.jadwalId ? { ...item, statusAktif: !item.statusAktif } : item
    );
    setItems('JADWAL', updated);
    setJadwalList(updated);

    addAuditLog({
      penggunaId: currentUser?.id || 'U001',
      aksi: 'TOGGLE_STATUS_JADWAL',
      jenisEntitas: 'JADWAL',
      entitasId: j.jadwalId,
      nilaiSebelum: String(j.statusAktif),
      nilaiSesudah: String(!j.statusAktif),
      alasan: `Kegiatan ${j.namaKegiatan} diubah statusnya menjadi ${!j.statusAktif ? 'AKTIF' : 'NONAKTIF'}`,
      statusAksi: 'BERHASIL',
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!namaKegiatan.trim()) return;

    let updated: JadwalKegiatan[];
    if (editingJadwal) {
      updated = jadwalList.map((j) =>
        j.jadwalId === editingJadwal.jadwalId
          ? {
              ...j,
              namaKegiatan: namaKegiatan.trim(),
              jamMulai,
              jamSelesai,
              toleransiBukaAwal: Number(toleransiAwal),
              toleransiTutupAkhir: Number(toleransiAkhir),
              statusAktif,
              keterangan,
            }
          : j
      );
    } else {
      const newId = `J${String(jadwalList.length + 1).padStart(3, '0')}`;
      const newJadwal: JadwalKegiatan = {
        jadwalId: newId,
        namaKegiatan: namaKegiatan.trim(),
        jamMulai,
        jamSelesai,
        toleransiBukaAwal: Number(toleransiAwal),
        toleransiTutupAkhir: Number(toleransiAkhir),
        wajib: true,
        statusAktif: true,
        keterangan,
      };
      updated = [...jadwalList, newJadwal];
    }

    setItems('JADWAL', updated);
    setJadwalList(updated);
    setModalOpen(false);

    addAuditLog({
      penggunaId: currentUser?.id || 'U001',
      aksi: editingJadwal ? 'EDIT_JADWAL' : 'TAMBAH_JADWAL',
      jenisEntitas: 'JADWAL',
      entitasId: editingJadwal ? editingJadwal.jadwalId : namaKegiatan,
      nilaiSesudah: `${namaKegiatan} (${jamMulai} - ${jamSelesai})`,
      statusAksi: 'BERHASIL',
    });
  };

  const handleDeleteDirect = (jadwalId: string, namaKegiatan: string) => {
    if (!isAdmin) return;
    const current = getItems<JadwalKegiatan>('JADWAL');
    const updated = current.filter((j) => j.jadwalId !== jadwalId);
    setItems('JADWAL', updated);
    setJadwalList(updated);
    setDeletingId(null);
    setDeleteModal({ open: false, jadwal: null });

    addAuditLog({
      penggunaId: currentUser?.id || 'U001',
      aksi: 'HAPUS_JADWAL',
      jenisEntitas: 'JADWAL',
      entitasId: jadwalId,
      nilaiSebelum: namaKegiatan,
      nilaiSesudah: 'DIHAPUS_PERMANEN',
      statusAksi: 'BERHASIL',
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-16">
      {/* Floating Action Button (FAB) Tambah Kegiatan di Pojok Kanan Bawah */}
      {isAdmin && (
        <button
          onClick={handleOpenAdd}
          className="fixed bottom-6 right-6 z-40 h-12 sm:h-14 px-4 sm:px-6 rounded-full glass-btn-emerald text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-2xl hover:scale-105 active:scale-95 transition"
          title="Tambah Kegiatan Baru"
        >
          <Plus className="w-5 h-5 shrink-0" />
          <span>+ Tambah Kegiatan Baru</span>
        </button>
      )}

      {/* TABLE DAFTAR JADWAL KEGIATAN */}
      <div className="bg-white rounded-2xl sm:rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
              <tr>
                <th className="p-3 pl-4 sm:pl-5">ID</th>
                <th className="p-3">Nama Kegiatan</th>
                <th className="p-3">Jam (WIB)</th>
                <th className="p-3">Rentang Scan Dibuka</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3">Aksi</th>
                <th className="p-3 pr-4 sm:pr-5 text-right">Status Aktif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50 font-medium">
              {jadwalList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                    Belum ada jadwal kegiatan.
                  </td>
                </tr>
              ) : (
                jadwalList.map((j) => {
                  const [sH, sM] = j.jamMulai.split(':').map(Number);
                  const [eH, eM] = j.jamSelesai.split(':').map(Number);
                  const startWindow = sH * 60 + sM - (j.toleransiBukaAwal || 15);
                  const endWindow = eH * 60 + eM + (j.toleransiTutupAkhir || 15);

                  const windowStr = `${Math.floor(startWindow / 60).toString().padStart(2, '0')}:${(startWindow % 60).toString().padStart(2, '0')} - ${Math.floor(endWindow / 60).toString().padStart(2, '0')}:${(endWindow % 60).toString().padStart(2, '0')} WIB`;

                  return (
                    <tr
                      key={j.jadwalId}
                      className={`hover:bg-emerald-50/50 transition ${
                        !j.statusAktif ? 'opacity-50 bg-slate-50' : ''
                      }`}
                    >
                      <td className="p-3 pl-4 sm:pl-5 font-mono font-bold text-emerald-800">
                        {j.jadwalId}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {j.namaKegiatan}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {j.jamMulai} - {j.jamSelesai}
                      </td>
                      <td className="p-3">
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold border border-emerald-200/50">
                          {windowStr}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{j.keterangan || '-'}</td>
                      <td className="p-3">
                        {isAdmin ? (
                          deletingId === j.jadwalId ? (
                            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2 py-1 rounded-xl shadow-xs animate-in fade-in">
                              <span className="text-[10px] font-black text-rose-700">Yakin?</span>
                              <button
                                onClick={() => handleDeleteDirect(j.jadwalId, j.namaKegiatan)}
                                className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer shadow-xs"
                              >
                                Hapus
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-1.5 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(j)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                                title="Edit Jadwal"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(j.jadwalId)}
                                className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-600 transition cursor-pointer"
                                title="Hapus Kegiatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold italic">
                            Hanya Admin
                          </span>
                        )}
                      </td>

                      {/* Tombol Aktif / Nonaktif di paling ujung tabel */}
                      <td className="p-3 pr-4 sm:pr-5 text-right">
                        {isAdmin ? (
                          <button
                            onClick={() => handleToggleAktif(j)}
                            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                              j.statusAktif
                                ? 'bg-emerald-100 text-emerald-800 shadow-xs'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${j.statusAktif ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span>{j.statusAktif ? 'Aktif' : 'Nonaktif'}</span>
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            j.statusAktif ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${j.statusAktif ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span>{j.statusAktif ? 'Aktif' : 'Nonaktif'}</span>
                          </span>
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

      {/* MODAL INPUT / EDIT KEGIATAN */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-6 shadow-2xl border border-emerald-100 space-y-4">
            <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <span>{editingJadwal ? 'Edit Jadwal Kegiatan' : 'Tambah Kegiatan Baru'}</span>
            </h3>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 mb-1">Nama Kegiatan *</label>
                <input
                  type="text"
                  required
                  value={namaKegiatan}
                  onChange={(e) => setNamaKegiatan(e.target.value)}
                  placeholder="Contoh: Kegiatan Pagi, Kegiatan Malam, Bimbingan BTAQ"
                  className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Jam Mulai (WIB) *</label>
                  <input
                    type="time"
                    required
                    value={jamMulai}
                    onChange={(e) => setJamMulai(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Jam Selesai (WIB) *</label>
                  <input
                    type="time"
                    required
                    value={jamSelesai}
                    onChange={(e) => setJamSelesai(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Toleransi Buka Awal (Menit)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={toleransiAwal}
                    onChange={(e) => setToleransiAwal(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Toleransi Tutup Akhir (Menit)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={toleransiAkhir}
                    onChange={(e) => setToleransiAkhir(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Keterangan Tambahan</label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Keterangan singkat kegiatan"
                  className="w-full p-2.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="statusAktifCheck"
                  checked={statusAktif}
                  onChange={(e) => setStatusAktif(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="statusAktifCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Jadikan Kegiatan Aktif untuk Presensi
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full glass-btn-emerald text-white font-bold shadow-md cursor-pointer"
                >
                  Simpan Kegiatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP DELETE CONFIRMATION MODAL (BENAR-BENAR DIHAPUS) */}
      {deleteModal.open && deleteModal.jadwal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-rose-100 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="font-black text-base text-slate-800">
                Hapus Kegiatan Ini?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Kegiatan <span className="font-extrabold text-slate-900">"{deleteModal.jadwal.namaKegiatan}"</span> ({deleteModal.jadwal.jamMulai} - {deleteModal.jadwal.jamSelesai} WIB) akan benar-benar dihapus secara permanen dari sistem.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, jadwal: null })}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDirect(deleteModal.jadwal!.jadwalId, deleteModal.jadwal!.namaKegiatan)}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-md active:scale-95"
              >
                Ya, Hapus Kegiatan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
