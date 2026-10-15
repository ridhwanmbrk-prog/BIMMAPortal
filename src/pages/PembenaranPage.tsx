import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  Clock,
  AlertCircle,
  Users,
} from 'lucide-react';
import { Pembenaran, Peserta, JadwalKegiatan, Absensi } from '../types';
import { getItems, setItems, getCurrentUser, addAuditLog } from '../storage';
import { QuickStudentPicker } from '../components/QuickStudentPicker';

export const PembenaranPage: React.FC = () => {
  const [pembenaranList, setPembenaranList] = useState<Pembenaran[]>([]);
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalKegiatan[]>([]);

  // Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPesertaId, setSelectedPesertaId] = useState('');
  const [selectedJadwalId, setSelectedJadwalId] = useState('');
  const [tanggalKejadian, setTanggalKejadian] = useState(new Date().toISOString().split('T')[0]);
  const [alasanPembenaran, setAlasanPembenaran] = useState('');

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  const loadData = () => {
    setPembenaranList(getItems<Pembenaran>('PEMBENARAN'));
    setPesertaList(getItems<Peserta>('PESERTA').filter((p) => p.statusPeserta === 'AKTIF'));
    setJadwalList(getItems<JadwalKegiatan>('JADWAL'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const pesertaMap = pesertaList.reduce((acc, p) => {
    acc[p.pesertaId] = p;
    return acc;
  }, {} as Record<string, Peserta>);

  const handleSavePembenaran = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPesertaId || !selectedJadwalId || !alasanPembenaran.trim()) return;

    const newId = `PB${String(pembenaranList.length + 1).padStart(4, '0')}`;
    const targetJadwal = jadwalList.find((j) => j.jadwalId === selectedJadwalId);

    const newPb: Pembenaran = {
      pembenaranId: newId,
      pesertaId: selectedPesertaId,
      jadwalId: selectedJadwalId,
      namaKegiatan: targetJadwal?.namaKegiatan || 'Kegiatan Pesma',
      tanggalKejadian: tanggalKejadian,
      alasan: alasanPembenaran.trim(),
      diajukanOleh: currentUser?.id || 'U002',
      waktuPengajuan: new Date().toISOString(),
      statusPersetujuan: 'MENUNGGU',
      statusAbsensiSebelum: 'ALPA',
      statusAbsensiSesudah: 'HADIR',
    };

    const updated = [newPb, ...pembenaranList];
    setItems('PEMBENARAN', updated);
    setPembenaranList(updated);
    setModalOpen(false);
    setAlasanPembenaran('');

    addAuditLog({
      penggunaId: currentUser?.id || 'U002',
      aksi: 'AJUKAN_PEMBENARAN',
      jenisEntitas: 'PEMBENARAN',
      entitasId: newId,
      nilaiSesudah: `Koreksi Santri: ${pesertaMap[selectedPesertaId]?.namaLengkap} - ${newPb.namaKegiatan}`,
      alasan: alasanPembenaran,
      statusAksi: 'BERHASIL',
    });
  };

  const handleDecidePembenaran = (pbId: string, status: 'DISETUJUI' | 'DITOLAK') => {
    const target = pembenaranList.find((p) => p.pembenaranId === pbId);
    if (!target) return;

    if (status === 'DISETUJUI') {
      const absensiList = getItems<Absensi>('ABSENSI');
      const idx = absensiList.findIndex(
        (a) => a.jadwalId === target.jadwalId && a.pesertaId === target.pesertaId && a.tanggal === target.tanggalKejadian
      );
      if (idx !== -1) {
        absensiList[idx].statusAbsensi = 'HADIR';
        absensiList[idx].sumberAbsensi = 'PEMBENARAN_ADMIN';
        absensiList[idx].alasanKoreksi = `Pembenaran disetujui: ${target.alasan}`;
        setItems('ABSENSI', absensiList);
      } else {
        // Buat record hadir baru jika sebelumnya belum ada
        const newAbsensi: Absensi = {
          absensiId: `A${String(absensiList.length + 1).padStart(6, '0')}`,
          jadwalId: target.jadwalId,
          namaKegiatan: target.namaKegiatan,
          tanggal: target.tanggalKejadian,
          pesertaId: target.pesertaId,
          statusAbsensi: 'HADIR',
          waktuScan: `${target.tanggalKejadian}T18:00:00.000Z`,
          waktuServer: new Date().toISOString(),
          penggunaId: currentUser?.id || 'U001',
          musyrifBertugas: 'Disetujui Admin',
          sumberAbsensi: 'PEMBENARAN_ADMIN',
          statusValidasi: 'SAH',
          alasanKoreksi: target.alasan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        absensiList.push(newAbsensi);
        setItems('ABSENSI', absensiList);
      }
    }

    const updated = pembenaranList.map((p) => {
      if (p.pembenaranId === pbId) {
        return {
          ...p,
          statusPersetujuan: status,
          diputuskanOleh: currentUser?.id || 'U001',
          waktuKeputusan: new Date().toISOString(),
        };
      }
      return p;
    });

    setItems('PEMBENARAN', updated);
    setPembenaranList(updated);

    addAuditLog({
      penggunaId: currentUser?.id || 'U001',
      aksi: status === 'DISETUJUI' ? 'SETUJUI_PEMBENARAN' : 'TOLAK_PEMBENARAN',
      jenisEntitas: 'PEMBENARAN',
      entitasId: pbId,
      nilaiSebelum: 'MENUNGGU',
      nilaiSesudah: status,
      statusAksi: 'BERHASIL',
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Floating Action Button (FAB) Ajukan Verifikasi (Ikon Plus Aja di Pojok Bawah Kanan) */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-btn-emerald text-white flex items-center justify-center cursor-pointer shadow-2xl hover:scale-110 active:scale-95 transition"
        title="Ajukan Verifikasi Telat/Lupa"
      >
        <Plus className="w-6 h-6 shrink-0" />
      </button>

      {/* Tabel Data Verifikasi Telat (Tanpa QR ID) */}
      <div className="bg-white dark:bg-[#16261e] rounded-[28px] shadow-sm border border-slate-200/60 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] dark:bg-emerald-950/40 text-slate-700 dark:text-emerald-300 font-black border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="p-3.5 pl-5">NIM</th>
                <th className="p-3.5">Nama Mahasantri</th>
                <th className="p-3.5">Kegiatan</th>
                <th className="p-3.5">Tanggal</th>
                <th className="p-3.5">Alasan / Keterangan Telat</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-5 text-right">Aksi Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
              {pembenaranList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Belum ada pengajuan verifikasi telat/lupa absen.
                  </td>
                </tr>
              ) : (
                pembenaranList.map((pb) => {
                  const santri = pesertaMap[pb.pesertaId];
                  return (
                    <tr key={pb.pembenaranId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                      <td className="p-3.5 pl-5 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {santri?.nim || '-'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        {santri?.namaLengkap || pb.pesertaId}
                      </td>
                      <td className="p-3.5">
                        <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                          {pb.namaKegiatan}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                        {pb.tanggalKejadian}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {pb.alasan}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            pb.statusPersetujuan === 'DISETUJUI'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : pb.statusPersetujuan === 'DITOLAK'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {pb.statusPersetujuan}
                        </span>
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        {isAdmin && pb.statusPersetujuan === 'MENUNGGU' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDecidePembenaran(pb.pembenaranId, 'DISETUJUI')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleDecidePembenaran(pb.pembenaranId, 'DITOLAK')}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold">Selesai</span>
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

      {/* Modal Ajukan Pembenaran */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16261e] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
            <h3 className="text-base font-black text-slate-800 dark:text-white">+ Form Verifikasi Lupa Absen / Telat</h3>
            <form onSubmit={handleSavePembenaran} className="space-y-3 text-xs">
              <div>
                <QuickStudentPicker
                  selectedPesertaId={selectedPesertaId}
                  onSelectPeserta={(p) => setSelectedPesertaId(p ? p.pesertaId : '')}
                  pesertaList={pesertaList}
                  label="Pilih Mahasantri *"
                  placeholder="Ketik Nama atau NIM / Scan QR..."
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Jadwal Kegiatan *
                </label>
                <select
                  required
                  value={selectedJadwalId}
                  onChange={(e) => setSelectedJadwalId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white"
                >
                  <option value="">-- Pilih Kegiatan --</option>
                  {jadwalList.map((j) => (
                    <option key={j.jadwalId} value={j.jadwalId}>
                      {j.namaKegiatan} ({j.jamMulai} - {j.jamSelesai} WIB)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Kejadian *
                </label>
                <input
                  type="date"
                  required
                  value={tanggalKejadian}
                  onChange={(e) => setTanggalKejadian(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alasan / Bukti Kehadiran *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Misal: Hadir di saf 2, kartu tertinggal di asrama / kendala perangkat saat scan"
                  value={alasanPembenaran}
                  onChange={(e) => setAlasanPembenaran(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer"
                >
                  Kirim Verifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
