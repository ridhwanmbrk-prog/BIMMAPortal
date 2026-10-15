import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  UserCheck,
  Phone,
  Search,
  Filter,
} from 'lucide-react';
import { Musyrif } from '../types';
import {
  getItems,
  saveMusyrif,
  deleteMusyrif,
  getActiveMusyrif,
  setActiveMusyrif,
  getCurrentUser,
  addAuditLog,
} from '../storage';

export const PetugasPage: React.FC = () => {
  const [musyrifList, setMusyrifList] = useState<Musyrif[]>([]);
  const [activeMusyrif, setActiveMusyrifState] = useState<Musyrif | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'ALL' | 'IKHWAN' | 'AKHWAT'>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPetugas, setEditingPetugas] = useState<Musyrif | null>(null);
  const [namaPetugas, setNamaPetugas] = useState('');
  const [nimPetugas, setNimPetugas] = useState('');
  const [jurusanPetugas, setJurusanPetugas] = useState('');
  const [angkatanPetugas, setAngkatanPetugas] = useState('');
  const [noWaPetugas, setNoWaPetugas] = useState('');
  const [emailPetugas, setEmailPetugas] = useState('');
  const [gender, setGender] = useState<'IKHWAN' | 'AKHWAT'>('IKHWAN');
  const [statusAktif, setStatusAktif] = useState(true);
  const [deletingPetugasId, setDeletingPetugasId] = useState<string | null>(null);

  const currentUser = getCurrentUser();

  const loadData = () => {
    setMusyrifList(getItems<Musyrif>('MUSYRIF'));
    setActiveMusyrifState(getActiveMusyrif());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingPetugas(null);
    setNamaPetugas('');
    setNimPetugas('');
    setJurusanPetugas('');
    setAngkatanPetugas('2025');
    setNoWaPetugas('');
    setEmailPetugas('');
    setGender('IKHWAN');
    setStatusAktif(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (m: Musyrif) => {
    setEditingPetugas(m);
    setNamaPetugas(m.nama);
    setNimPetugas(m.nim || '');
    setJurusanPetugas(m.jurusan || '');
    setAngkatanPetugas(m.angkatan || '');
    setNoWaPetugas(m.nomorWhatsApp || '');
    setEmailPetugas(m.email || '');
    setGender(m.gender);
    setStatusAktif(m.status);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPetugas.trim()) return;

    if (editingPetugas) {
      const updated: Musyrif = {
        ...editingPetugas,
        nama: namaPetugas.trim(),
        nim: nimPetugas.trim(),
        jurusan: jurusanPetugas.trim(),
        angkatan: angkatanPetugas.trim(),
        nomorWhatsApp: noWaPetugas.trim(),
        email: emailPetugas.trim(),
        gender,
        status: statusAktif,
      };
      saveMusyrif(updated);
      addAuditLog({
        penggunaId: currentUser?.id || 'U001',
        aksi: 'EDIT_PETUGAS',
        jenisEntitas: 'MUSYRIF',
        entitasId: updated.id,
        nilaiSesudah: `${updated.nama} (${updated.nim} - ${updated.jurusan})`,
        statusAksi: 'BERHASIL',
      });
    } else {
      const newId = `M${String(musyrifList.length + 1).padStart(2, '0')}`;
      const newPetugas: Musyrif = {
        id: newId,
        nama: namaPetugas.trim(),
        nim: nimPetugas.trim(),
        jurusan: jurusanPetugas.trim(),
        angkatan: angkatanPetugas.trim(),
        nomorWhatsApp: noWaPetugas.trim(),
        email: emailPetugas.trim(),
        gender,
        status: statusAktif,
      };
      saveMusyrif(newPetugas);
      addAuditLog({
        penggunaId: currentUser?.id || 'U001',
        aksi: 'TAMBAH_PETUGAS',
        jenisEntitas: 'MUSYRIF',
        entitasId: newId,
        nilaiSesudah: `${newPetugas.nama} (${newPetugas.nim} - ${newPetugas.jurusan})`,
        statusAksi: 'BERHASIL',
      });
    }

    setModalOpen(false);
    loadData();
  };

  const handleDelete = (id: string, nama: string) => {
    deleteMusyrif(id);
    if (activeMusyrif?.id === id) {
      setActiveMusyrif(null);
    }
    setDeletingPetugasId(null);
    addAuditLog({
      penggunaId: currentUser?.id || 'U001',
      aksi: 'HAPUS_PETUGAS',
      jenisEntitas: 'MUSYRIF',
      entitasId: id,
      nilaiSebelum: nama,
      statusAksi: 'BERHASIL',
    });
    loadData();
  };

  const handleSetActiveDuty = (m: Musyrif) => {
    setActiveMusyrif(m);
    setActiveMusyrifState(m);
    addAuditLog({
      penggunaId: currentUser?.id || 'U001',
      aksi: 'SET_MUSYRIF_BERTUGAS',
      jenisEntitas: 'MUSYRIF',
      entitasId: m.id,
      nilaiSesudah: `Piket Aktif: ${m.nama}`,
      statusAksi: 'BERHASIL',
    });
  };

  const filtered = musyrifList.filter((m) => {
    const matchQuery = m.nama.toLowerCase().includes(searchQuery.toLowerCase()) || m.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchGender = filterGender === 'ALL' || m.gender === filterGender;
    return matchQuery && matchGender;
  });

  const ikhwanCount = musyrifList.filter((m) => m.gender === 'IKHWAN').length;
  const akhwatCount = musyrifList.filter((m) => m.gender === 'AKHWAT').length;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      {/* Active Duty Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-2xl sm:rounded-[24px] p-3.5 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner shrink-0">
            <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Petugas Piket Aktif Saat Ini</p>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              {activeMusyrif ? activeMusyrif.nama : 'Belum Dipilih (Pilih Petugas Bertugas)'}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-emerald-100">
              {activeMusyrif ? `Kategori: ${activeMusyrif.gender} • ID: ${activeMusyrif.id}` : 'Petugas ini yang akan otomatis tercatat pada log absensi santri'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats summary row - Kotak-kotak hemat scroll */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-[22px] border border-slate-200/60 shadow-xs flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-1">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400">Total Petugas</p>
            <p className="text-base sm:text-2xl font-black text-slate-800">{musyrifList.length}</p>
          </div>
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-[22px] border border-slate-200/60 shadow-xs flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-1">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400">Ikhwan</p>
            <p className="text-base sm:text-2xl font-black text-emerald-700">{ikhwanCount}</p>
          </div>
          <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-50 text-emerald-700">
            Musyrif
          </span>
        </div>

        <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-[22px] border border-slate-200/60 shadow-xs flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-1">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400">Akhwat</p>
            <p className="text-base sm:text-2xl font-black text-teal-700">{akhwatCount}</p>
          </div>
          <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-teal-50 text-teal-700">
            Musyrifah
          </span>
        </div>
      </div>

      {/* Filter and Search Bar with Tambah Petugas Button */}
      <div className="bg-white p-3.5 sm:p-4 rounded-[22px] border border-slate-200/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau ID petugas..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="h-9 px-3 sm:px-4 rounded-xl glass-btn-emerald text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 hover:scale-102 transition"
            title="Tambah Petugas Baru"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Petugas</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500">Gender:</span>
          {(['ALL', 'IKHWAN', 'AKHWAT'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setFilterGender(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterGender === g
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {g === 'ALL' ? 'Semua' : g}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Petugas */}
      <div className="bg-white rounded-[26px] shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3.5 pl-5">ID</th>
                <th className="p-3.5">Nama Petugas</th>
                <th className="p-3.5">Gender</th>
                <th className="p-3.5">Status Akun</th>
                <th className="p-3.5">Piket Aktif</th>
                <th className="p-3.5 pr-5 text-right">Aksi Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Tidak ada data petugas yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isDuty = activeMusyrif?.id === m.id;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 pl-5 font-bold text-slate-600 font-mono">{m.id}</td>
                      <td className="p-3.5 font-bold text-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {m.gender === 'IKHWAN' ? 'IK' : 'AK'}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-800 text-xs leading-tight">{m.nama}</span>
                            <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="font-mono font-bold text-emerald-800">{m.nim || '200125016'}</span>
                              <span className="text-slate-300">•</span>
                              <span>{m.jurusan || 'S1 DKV'}</span>
                              {m.angkatan && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-500">Angk. {m.angkatan}</span>
                                </>
                              )}
                              {m.nomorWhatsApp && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-emerald-700 font-mono">{m.nomorWhatsApp}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            m.gender === 'IKHWAN'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {m.gender}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {m.status ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {isDuty ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SEDANG PIKET</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetActiveDuty(m)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 transition cursor-pointer"
                          >
                            Set Jadi Piket
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        {deletingPetugasId === m.id ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2 py-1 rounded-xl shadow-xs animate-in fade-in">
                            <span className="text-[10px] font-black text-rose-700">Hapus Petugas?</span>
                            <button
                              onClick={() => handleDelete(m.id, m.nama)}
                              className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer shadow-xs"
                            >
                              Ya
                            </button>
                            <button
                              onClick={() => setDeletingPetugasId(null)}
                              className="px-1.5 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(m)}
                              title="Edit Petugas"
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingPetugasId(m.id)}
                              title="Hapus Petugas"
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Modal Form Tambah / Edit Petugas */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-800">
                {editingPetugas ? 'Edit Biodata Petugas' : 'Tambah Petugas Musyrif / Musyrifah'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 pt-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Nama Lengkap & Gelar *</label>
                <input
                  type="text"
                  required
                  value={namaPetugas}
                  onChange={(e) => setNamaPetugas(e.target.value)}
                  placeholder="Contoh: Mochamad Ridhwan Mubarok"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-700 mb-1">NIM Mahasiswa</label>
                  <input
                    type="text"
                    value={nimPetugas}
                    onChange={(e) => setNimPetugas(e.target.value)}
                    placeholder="200125016"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Jurusan / Prodi</label>
                  <input
                    type="text"
                    value={jurusanPetugas}
                    onChange={(e) => setJurusanPetugas(e.target.value)}
                    placeholder="S1 DKV"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Angkatan</label>
                  <input
                    type="text"
                    value={angkatanPetugas}
                    onChange={(e) => setAngkatanPetugas(e.target.value)}
                    placeholder="2025"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    value={noWaPetugas}
                    onChange={(e) => setNoWaPetugas(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={emailPetugas}
                    onChange={(e) => setEmailPetugas(e.target.value)}
                    placeholder="petugas@unisa.ac.id"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Kategori / Gender *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('IKHWAN')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      gender === 'IKHWAN'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-400/30'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    IKHWAN (Musyrif)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('AKHWAT')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      gender === 'AKHWAT'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-400/30'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    AKHWAT (Musyrifah)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-slate-800 font-bold">Status Keaktifan</p>
                  <p className="text-[11px] text-slate-400 font-normal">Petugas aktif dapat dipilih untuk sesi presensi</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusAktif(!statusAktif)}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center p-0.5 cursor-pointer ${
                    statusAktif ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  Simpan Petugas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
