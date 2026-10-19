import { getBusinessDateString } from '../utils/date';
import { isScheduleApplicableOnDate } from '../utils/schedule';
import React, { useState, useEffect } from 'react';
import {
  TableProperties,
  Calendar,
  Download,
  Filter,
  Search,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  Layers,
  Sparkles,
  Users,
  Clock,
  FileSpreadsheet,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Peserta, Absensi, JadwalKegiatan, Izin, Batch, Pembenaran, UserAccount } from '../types';
import { getItems, getConfig } from '../storage';
import { pushAllDataToSheet, initRekapFormulasInSheet } from '../sheetApi';
import { exportAttendancePdf } from '../utils/exportAttendancePdf';

type TabView = 'matriks' | 'per-orang' | 'harian-kegiatan' | 'batch' | 'mingguan';

export const TabelPresensiHarianPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('matriks');
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [absensiList, setAbsensiList] = useState<Absensi[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalKegiatan[]>([]);
  const [izinList, setIzinList] = useState<Izin[]>([]);
  const [batchList, setBatchList] = useState<Batch[]>([]);

  const todayStr = getBusinessDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const jadwalUntukTanggal = jadwalList.filter((j) =>
    isScheduleApplicableOnDate(j, selectedDate)
  );
  const [filterJurusan, setFilterJurusan] = useState<string>('ALL');
  const [filterBatch, setFilterBatch] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [syncLoading, setSyncLoading] = useState(false);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const config = getConfig();

  const loadAll = () => {
    setPesertaList(getItems<Peserta>('PESERTA').filter((p) => p.statusPeserta === 'AKTIF'));
    setAbsensiList(getItems<Absensi>('ABSENSI'));
    setJadwalList(getItems<JadwalKegiatan>('JADWAL').filter((j) => j.statusAktif));
    setIzinList(getItems<Izin>('IZIN'));
    setBatchList(getItems<Batch>('BATCH'));
  };

  useEffect(() => {
    loadAll();

    const onExport = () => {
      handleExportPdf();
    };

    const onSync = () => {
      handlePushToGoogleSheet();
    };

    window.addEventListener('bimma_trigger_export_pdf', onExport);
    window.addEventListener('bimma_trigger_sync_sheet', onSync);

    return () => {
      window.removeEventListener('bimma_trigger_export_pdf', onExport);
      window.removeEventListener('bimma_trigger_sync_sheet', onSync);
    };
  }, [selectedDate, filterBatch, filterJurusan]);

  const jurusanList = Array.from(new Set(pesertaList.map((p) => p.programStudi)));

  const filteredPeserta = pesertaList.filter((p) => {
    const matchJurusan = filterJurusan === 'ALL' || p.programStudi === filterJurusan;
    const matchBatch = filterBatch === 'ALL' || p.batchId === filterBatch;
    const matchQuery =
      p.namaLengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nim.includes(searchQuery) ||
      p.pesertaId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchJurusan && matchBatch && matchQuery;
  });

  // Helper status per kegiatan langsung berdasarkan JadwalKegiatan
  const getCellStatus = (santri: Peserta, jadwal: JadwalKegiatan) => {
    const record = absensiList.find(
      (a) =>
        a.tanggal === selectedDate &&
        (a.jadwalId === jadwal.jadwalId || a.namaKegiatan.toLowerCase() === jadwal.namaKegiatan.toLowerCase()) &&
        a.pesertaId === santri.pesertaId
    );

    if (record) {
      if (record.statusAbsensi === 'HADIR') {
        const time = record.waktuScan ? record.waktuScan.split('T')[1]?.slice(0, 5) : 'H';
        const isLate = record.keteranganWaktu === 'TERLAMBAT';
        return {
          code: isLate ? 'H*' : 'H',
          time,
          isLate,
          lateMinutes: record.menitKeterlambatan || 0,
          reason: record.alasanTerlambat,
          label: isLate ? `Terlambat ${record.menitKeterlambatan || 0}m (${time})` : `Hadir (${time})`,
          color: isLate
            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
            : 'bg-emerald-100 text-emerald-800 font-bold',
        };
      }
      if (record.statusAbsensi === 'IZIN') {
        return {
          code: 'I',
          label: 'Izin Disetujui',
          color: 'bg-amber-100 text-amber-800 font-bold',
        };
      }
      if (record.statusAbsensi === 'ALPA') {
        return {
          code: 'X',
          label: 'Alfa (Tidak Hadir)',
          color: 'bg-rose-100 text-rose-800 font-bold',
        };
      }
    }

    // Cek apakah ada izin santri yang melingkupi tanggal ini
    const hasIzin = izinList.find((iz) => {
      if (iz.pesertaId !== santri.pesertaId) return false;
      const start = iz.waktuMulai.split('T')[0];
      const end = iz.waktuSelesai.split('T')[0];
      return selectedDate >= start && selectedDate <= end;
    });

    if (hasIzin) {
      if (hasIzin.statusPersetujuan === 'DISETUJUI') {
        const isPastDeadline = new Date() > new Date(hasIzin.waktuSelesai) && hasIzin.statusKedatangan !== 'SUDAH_KEMBALI';
        if (isPastDeadline) {
          return { code: 'A', label: 'Terlambat Kembali (Alpa)', color: 'bg-rose-100 text-rose-800 font-bold' };
        }
        return { code: 'I', label: 'Izin Disetujui', color: 'bg-amber-100 text-amber-800 font-bold' };
      }
      return { code: '?', label: 'Izin Perlu Konfirmasi', color: 'bg-amber-100 text-amber-900 font-bold border border-amber-300' };
    }

    const confirmationDeadline = new Date(`${selectedDate}T22:00:00+07:00`);

    if (Date.now() >= confirmationDeadline.getTime()) {
      return {
        code: 'X',
        label: 'Alfa: batas konfirmasi pukul 22.00 WIB telah lewat',
        color: 'bg-rose-100 text-rose-800 font-bold',
      };
    }

    return {
      code: '?',
      label: 'Belum ada presensi — perlu konfirmasi',
      color: 'bg-amber-100 text-amber-900 font-bold border border-amber-300',
    };
  };

  // Evaluasi 1 Hari Penuh: menyelesaikan seluruh rangkaian kegiatan (Pagi & Malam)
  const getDailySummary = (santri: Peserta) => {
    let hadirCount = 0;
    let hadirTepatCount = 0;
    let hadirLateCount = 0;
    let izinCount = 0;
    let needConfirm = false;

    jadwalUntukTanggal.forEach((j) => {
      const res = getCellStatus(santri, j);
      if (res.code === 'H' || res.code === 'H*') {
        hadirCount++;
        if (res.isLate) hadirLateCount++;
        else hadirTepatCount++;
      } else if (res.code === 'I') {
        izinCount++;
      } else if (res.code === '?') {
        needConfirm = true;
      }
    });

    const isFullDayComplete = hadirCount === jadwalUntukTanggal.length && jadwalUntukTanggal.length > 0;

    let badge = {
      label: 'Kurang Absen',
      color: 'bg-rose-100 text-rose-800',
    };

    if (isFullDayComplete) {
      if (hadirLateCount > 0) {
        badge = {
          label: `Lengkap (${hadirLateCount} Telat)`,
          color: 'bg-amber-100 text-amber-900 border border-amber-300',
        };
      } else {
        badge = {
          label: '1 Hari Lengkap (Disiplin)',
          color: 'bg-emerald-100 text-emerald-800',
        };
      }
    } else if (needConfirm) {
      badge = {
        label: 'Perlu Konfirmasi',
        color: 'bg-emerald-100 text-emerald-900 border border-emerald-400',
      };
    } else if (izinCount > 0) {
      badge = {
        label: `${izinCount} Izin`,
        color: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
      };
    } else if (hadirCount > 0) {
      badge = {
        label: `${hadirCount}/${jadwalUntukTanggal.length} Kegiatan`,
        color: 'bg-emerald-100 text-emerald-800',
      };
    }

    return { hadirCount, hadirTepatCount, hadirLateCount, izinCount, badge, isFullDayComplete };
  };

  // DATA REKAPAN 1: Rekapan Per Orang (Hari)
  const perOrangRows = filteredPeserta.map((santri) => {
    const records = absensiList.filter((a) => a.pesertaId === santri.pesertaId);
    const tepatWaktu = records.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu !== 'TERLAMBAT').length;
    const terlambat = records.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu === 'TERLAMBAT').length;
    const totalHadir = tepatWaktu + terlambat;
    const izin = records.filter((a) => a.statusAbsensi === 'IZIN').length;
    const alpa = records.filter((a) => a.statusAbsensi === 'ALPA').length;
    const totalKegiatan = totalHadir + izin + alpa;
    const pct = totalKegiatan > 0 ? Math.round((totalHadir / totalKegiatan) * 100) : 0;
    const statusBimma = pct >= 75 ? 'Lulus / Memenuhi Syarat' : totalKegiatan === 0 ? 'Belum Ada Sesi' : 'Perlu Pembinaan';

    return {
      santri,
      tepatWaktu,
      terlambat,
      totalHadir,
      izin,
      alpa,
      totalKegiatan,
      pct,
      statusBimma,
    };
  });

  // DATA REKAPAN 2: Rekapan Harian (Kegiatan)
  const distinctDates = Array.from(new Set([selectedDate, ...absensiList.map((a) => a.tanggal)])).sort().reverse();
  const harianKegiatanRows: {
    tanggal: string;
    kegiatan: string;
    tepatWaktu: number;
    terlambat: number;
    totalHadir: number;
    izin: number;
    alpa: number;
    totalPeserta: number;
    pct: number;
  }[] = [];

  distinctDates.forEach((tgl) => {
    jadwalList.filter((j) => isScheduleApplicableOnDate(j, tgl))
      .forEach((j) => {
      const dayRecs = absensiList.filter(
        (a) => a.tanggal === tgl && (a.jadwalId === j.jadwalId || a.namaKegiatan.toLowerCase() === j.namaKegiatan.toLowerCase())
      );
      const tepatWaktu = dayRecs.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu !== 'TERLAMBAT').length;
      const terlambat = dayRecs.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu === 'TERLAMBAT').length;
      const totalHadir = tepatWaktu + terlambat;
      const izin = dayRecs.filter((a) => a.statusAbsensi === 'IZIN').length;
      const totalAktif = pesertaList.length || 1;
      const alpa = Math.max(0, totalAktif - (totalHadir + izin));
      const pct = totalAktif > 0 ? Math.round((totalHadir / totalAktif) * 100) : 0;

      if (dayRecs.length > 0 || tgl === selectedDate) {
        harianKegiatanRows.push({
          tanggal: tgl,
          kegiatan: j.namaKegiatan,
          tepatWaktu,
          terlambat,
          totalHadir,
          izin,
          alpa,
          totalPeserta: totalAktif,
          pct,
        });
      }
    });
  });

  // DATA REKAPAN 3: Rekapan Batch
  const batchNames = Array.from(
    new Set(pesertaList.map((p) => p.batchId))
  ).sort();
  const batchRows = batchNames.map((bName) => {
    const santriInBatch = pesertaList.filter((p) => p.batchId === bName);
    const santriIds = new Set(santriInBatch.map((p) => p.pesertaId));
    const batchRecs = absensiList.filter((a) => santriIds.has(a.pesertaId));

    const tepatWaktu = batchRecs.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu !== 'TERLAMBAT').length;
    const terlambat = batchRecs.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu === 'TERLAMBAT').length;
    const totalHadir = tepatWaktu + terlambat;
    const izin = batchRecs.filter((a) => a.statusAbsensi === 'IZIN').length;
    const alpa = batchRecs.filter((a) => a.statusAbsensi === 'ALPA').length;
    const totalSesi = totalHadir + izin + alpa;
    const pct = totalSesi > 0 ? Math.round((totalHadir / totalSesi) * 100) : 0;

    return {
      batchName: batchList.find(
        (b) => b.batchId === bName || b.namaBatch === bName
      )?.namaBatch || bName,
      jumlahSantri: santriInBatch.length,
      tepatWaktu,
      terlambat,
      totalHadir,
      izin,
      alpa,
      totalSesi,
      pct,
    };
  });

  // Sinkronkan ke Google Sheet Output Database via Apps Script API
  const handlePushToGoogleSheet = async () => {
    if (!config.backendUrl) {
      alert('URL Google Apps Script Web App belum diatur di menu Pengaturan!');
      return;
    }

    setSyncLoading(true);
    const payload = {
      tanggalLaporan: selectedDate,
      pengguna: getItems<UserAccount>('USERS_ACCOUNTS').map((user) => ({
        id: user.id,
        gender: user.gender,
        role: user.role,
        namaLengkap: user.namaLengkap,
        statusAktif: user.statusAktif,
      })),
      peserta: getItems<Peserta>('PESERTA'),
      absensi: getItems<Absensi>('ABSENSI'),
      jadwal: getItems<JadwalKegiatan>('JADWAL'),
      batch: getItems<Batch>('BATCH'),
      izin: getItems<Izin>('IZIN'),
      pembenaran: getItems<Pembenaran>('PEMBENARAN'),
    };
    const res = await pushAllDataToSheet(config.backendUrl, payload);
    setSyncLoading(false);

    if (res.success) {
      setNotification({
        type: 'success',
        message: res.message || 'Seluruh data BIMMA berhasil disinkronkan ke Google Spreadsheet!',
      });
    } else {
      setNotification({
        type: 'error',
        message: res.message || 'Gagal mengirim presensi ke Google Sheet.',
      });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  // Buat 4 Sheet Rekapan dengan Rumus Otomatis di Google Sheets
  const handleInitFormulas = async () => {
    if (!config.backendUrl) {
      alert('URL Google Apps Script Web App belum diatur di menu Pengaturan!');
      return;
    }

    setFormulaLoading(true);
    const res = await initRekapFormulasInSheet(config.backendUrl);
    setFormulaLoading(false);

    if (res.success) {
      setNotification({
        type: 'success',
        message: 'Alhamdulillah! 4 Sheet formula otomatis (Per Orang, Harian Kegiatan, Batch, Mingguan) telah terpasang di Google Sheets!',
      });
    } else {
      setNotification({
        type: 'error',
        message: res.message || 'Gagal memasang formula ke Google Sheet.',
      });
    }
    setTimeout(() => setNotification(null), 6000);
  };

  const handleExportPdf = () => {
    exportAttendancePdf({
      targetDate: selectedDate,
      batchFilter: filterBatch,
      jurusanFilter: filterJurusan,
    });
  };

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
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

      {/* MULTI-TAB SWITCHER (Matriks Harian, Rekap Per Orang, Rekap Harian Kegiatan, Rekap Batch, Rekap Mingguan) */}
      <div className="bg-white p-2 rounded-2xl border border-emerald-100 shadow-xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('matriks')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'matriks'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-emerald-50'
          }`}
          title="Matriks Presensi Harian"
        >
          <TableProperties className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Matriks Presensi Harian</span>
          <span className="sm:hidden">Matriks</span>
        </button>

        <button
          onClick={() => setActiveTab('per-orang')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'per-orang'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-emerald-50'
          }`}
          title="Rekapan Per Orang (Hari)"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Rekapan Per Orang (Hari)</span>
          <span className="sm:hidden">Per Orang</span>
        </button>

        <button
          onClick={() => setActiveTab('harian-kegiatan')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'harian-kegiatan'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-emerald-50'
          }`}
          title="Rekapan Harian (Kegiatan)"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Rekapan Harian (Kegiatan)</span>
          <span className="sm:hidden">Harian</span>
        </button>

        <button
          onClick={() => setActiveTab('batch')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'batch'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-emerald-50'
          }`}
          title="Rekapan Batch"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Rekapan Batch</span>
          <span className="sm:hidden">Batch</span>
        </button>

        <button
          onClick={() => setActiveTab('mingguan')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'mingguan'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-emerald-50'
          }`}
          title="Rekapan Per Minggu"
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Rekapan Per Minggu</span>
          <span className="sm:hidden">Mingguan</span>
        </button>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'matriks' && (
            <div className="flex items-center gap-1.5 bg-[#f4f8f5] px-3 py-1.5 rounded-xl border border-emerald-100">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
              />
            </div>
          )}

          {/* Filter Batch */}
          <div className="flex items-center gap-1.5 bg-[#f4f8f5] px-3 py-1.5 rounded-xl border border-emerald-100">
            <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">Semua Batch</option>
              {Array.from(new Set(pesertaList.map((p) => p.batchId))).sort().map((batchId) => {
                const batch = batchList.find(
                  (b) => b.batchId === batchId || b.namaBatch === batchId
                );
                return (
                  <option key={batchId} value={batchId}>
                    {batch?.namaBatch || batchId}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter Jurusan */}
          <div className="flex items-center gap-1.5 bg-[#f4f8f5] px-3 py-1.5 rounded-xl border border-emerald-100">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterJurusan}
              onChange={(e) => setFilterJurusan(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">Semua Jurusan</option>
              {jurusanList.map((j) => (
                <option key={j} value={j} className="text-black">
                  {j}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="relative flex-1 sm:flex-initial min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari santri / NIM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#f4f8f5] border border-emerald-100 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>

        {/* Legend Status Presensi (Tombol Aksi Sinkron & PDF berada di Topbar Header) */}
        {activeTab === 'matriks' && (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[10px] text-slate-600 font-semibold w-full sm:w-auto pt-2 sm:pt-0 sm:border-l sm:border-slate-200 sm:pl-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> ✓ Hadir
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" /> X Alfa
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" /> ? Perlu konfirmasi
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" /> I Izin
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: TABEL MATRIKS HARIAN */}
      {/* ========================================================================= */}
      {activeTab === 'matriks' && (
        <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
                <tr>
                  <th className="p-3 pl-5">NIM & Mahasantri</th>
                  <th className="p-3">Prodi</th>
                  <th className="p-3">Batch</th>
                  {jadwalUntukTanggal.map((j) => (
                    <th key={j.jadwalId} className="p-3 text-center">
                      <div>{j.namaKegiatan}</div>
                      <span className="text-[10px] text-emerald-700/80 font-normal">
                        {j.jamMulai} WIB
                      </span>
                    </th>
                  ))}
                  <th className="p-3 pr-5 text-right">Evaluasi 1 Hari</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50 text-slate-700">
                {filteredPeserta.length === 0 ? (
                  <tr>
                    <td colSpan={4 + jadwalUntukTanggal.length} className="p-8 text-center text-slate-400 italic">
                      Tidak ada data mahasantri ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredPeserta.map((santri) => {
                    const daily = getDailySummary(santri);
                    return (
                      <tr key={santri.pesertaId} className="hover:bg-emerald-50/50 transition">
                        <td className="p-3 pl-5">
                          <div className="font-bold text-slate-900">{santri.namaLengkap}</div>
                          <div className="font-mono text-[10px] text-slate-500">{santri.nim}</div>
                        </td>
                        <td className="p-3 text-[11px] font-semibold text-slate-600">{santri.programStudi}</td>
                        <td className="p-3 text-[11px] font-semibold text-emerald-800">{santri.batchId}</td>

                        {jadwalUntukTanggal.map((j) => {
                          const cell = getCellStatus(santri, j);
                          return (
                            <td key={j.jadwalId} className="p-3 text-center">
                              <span
                                className={`px-2 py-1 rounded-lg text-[10px] inline-block ${cell.color}`}
                                title={cell.label}
                              >
                                {cell.code === 'H*' || cell.code === 'H' ? '✓' : cell.code}
                              </span>
                            </td>
                          );
                        })}

                        <td className="p-3 pr-5 text-right">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${daily.badge.color}`}>
                            {daily.badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: REKAPAN PER ORANG (HARI) */}
      {/* ========================================================================= */}
      {activeTab === 'per-orang' && (
        <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-emerald-950 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>Rekapan Kehadiran & Status Kelulusan Mahasantri BIMMA</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">
              Formula Google Sheets: <code>=COUNTIFS(ABSENSI!$C:$C, $A2, ...)</code>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
                <tr>
                  <th className="p-3 pl-5">NIM & Mahasantri</th>
                  <th className="p-3">Batch & Prodi</th>
                  <th className="p-3 text-center">Tepat Waktu</th>
                  <th className="p-3 text-center">Terlambat</th>
                  <th className="p-3 text-center">Total Hadir</th>
                  <th className="p-3 text-center">Izin</th>
                  <th className="p-3 text-center">Alpa</th>
                  <th className="p-3 text-center">Persentase</th>
                  <th className="p-3 pr-5 text-right">Status Kelulusan BIMMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50 text-slate-700">
                {perOrangRows.map(({ santri, tepatWaktu, terlambat, totalHadir, izin, alpa, pct, statusBimma }) => (
                  <tr key={santri.pesertaId} className="hover:bg-emerald-50/50 transition">
                    <td className="p-3 pl-5">
                      <div className="font-bold text-slate-900">{santri.namaLengkap}</div>
                      <div className="font-mono text-[10px] text-slate-500">{santri.nim}</div>
                    </td>
                    <td className="p-3 text-[11px]">
                      <div>{santri.batchId}</div>
                      <div className="text-slate-400 text-[10px]">{santri.programStudi}</div>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-700">{tepatWaktu}</td>
                    <td className="p-3 text-center font-bold text-amber-600">{terlambat}</td>
                    <td className="p-3 text-center font-black text-slate-900 bg-emerald-50/30">{totalHadir}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{izin}</td>
                    <td className="p-3 text-center font-bold text-rose-600">{alpa}</td>
                    <td className="p-3 text-center">
                      <span className="font-mono font-black text-slate-800">{pct}%</span>
                    </td>
                    <td className="p-3 pr-5 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          pct >= 75
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {statusBimma}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: REKAPAN HARIAN (KEGIATAN) */}
      {/* ========================================================================= */}
      {activeTab === 'harian-kegiatan' && (
        <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-emerald-950 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Rekapan Kehadiran per Tanggal & Kegiatan BIMMA</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">
              Formula Google Sheets: <code>=COUNTIFS(ABSENSI!$E:$E, $A2, ABSENSI!$B:$B, $B2, ...)</code>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
                <tr>
                  <th className="p-3 pl-5">Tanggal</th>
                  <th className="p-3">Nama Kegiatan</th>
                  <th className="p-3 text-center">Tepat Waktu</th>
                  <th className="p-3 text-center">Terlambat</th>
                  <th className="p-3 text-center">Total Hadir</th>
                  <th className="p-3 text-center">Izin</th>
                  <th className="p-3 text-center">Alpa</th>
                  <th className="p-3 text-center">Total Santri</th>
                  <th className="p-3 pr-5 text-right">Tingkat Kehadiran (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50 text-slate-700">
                {harianKegiatanRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/50 transition">
                    <td className="p-3 pl-5 font-mono font-bold text-slate-800">{row.tanggal}</td>
                    <td className="p-3 font-bold text-emerald-800">{row.kegiatan}</td>
                    <td className="p-3 text-center font-bold text-emerald-700">{row.tepatWaktu}</td>
                    <td className="p-3 text-center font-bold text-amber-600">{row.terlambat}</td>
                    <td className="p-3 text-center font-black text-slate-900 bg-emerald-50/30">{row.totalHadir}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{row.izin}</td>
                    <td className="p-3 text-center font-bold text-rose-600">{row.alpa}</td>
                    <td className="p-3 text-center font-bold text-slate-600">{row.totalPeserta}</td>
                    <td className="p-3 pr-5 text-right font-mono font-black text-emerald-800">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: REKAPAN BATCH */}
      {/* ========================================================================= */}
      {activeTab === 'batch' && (
        <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-emerald-950 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Rekapan Evaluasi Kehadiran Seluruh Batch</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">
              Formula Google Sheets: <code>=SUMIFS(REKAP_PER_ORANG!..., ...)</code>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f2f7f4] text-emerald-900 font-black border-b border-emerald-200/60">
                <tr>
                  <th className="p-3 pl-5">Batch ID</th>
                  <th className="p-3">Jumlah Mahasantri</th>
                  <th className="p-3 text-center">Tepat Waktu</th>
                  <th className="p-3 text-center">Terlambat</th>
                  <th className="p-3 text-center">Total Hadir</th>
                  <th className="p-3 text-center">Total Izin</th>
                  <th className="p-3 text-center">Total Alpa</th>
                  <th className="p-3 pr-5 text-right">Rata-Rata Kehadiran Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50 text-slate-700">
                {batchRows.map((b) => (
                  <tr key={b.batchName} className="hover:bg-emerald-50/50 transition">
                    <td className="p-3 pl-5 font-bold text-emerald-900">{b.batchName}</td>
                    <td className="p-3 font-bold text-slate-800">{b.jumlahSantri} Mahasantri</td>
                    <td className="p-3 text-center font-bold text-emerald-700">{b.tepatWaktu}</td>
                    <td className="p-3 text-center font-bold text-amber-600">{b.terlambat}</td>
                    <td className="p-3 text-center font-black text-slate-900 bg-emerald-50/30">{b.totalHadir}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{b.izin}</td>
                    <td className="p-3 text-center font-bold text-rose-600">{b.alpa}</td>
                    <td className="p-3 pr-5 text-right font-mono font-black text-emerald-800 text-sm">{b.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: REKAPAN PER MINGGU */}
      {/* ========================================================================= */}
      {activeTab === 'mingguan' && (
        <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-sm border border-emerald-100 overflow-hidden">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-emerald-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              <span>Rekapan Kehadiran Mingguan (BIMMA Pesma UNISA)</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">
              Formula Google Sheets: <code>=SUM(REKAP_HARIAN_KEGIATAN!...)</code>
            </span>
          </div>

          <div className="p-6 text-center text-xs space-y-4">
            <p className="text-slate-600 max-w-lg mx-auto">
              Rekapan mingguan menghitung agregat seluruh kehadiran tepat waktu, terlambat, izin, dan alpa setiap siklus 7 hari pelaksanaan bimbingan.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] text-emerald-700 font-bold uppercase">Hadir Tepat Waktu</p>
                <p className="text-lg font-black text-emerald-900 mt-1">
                  {absensiList.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu !== 'TERLAMBAT').length}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <p className="text-[10px] text-amber-700 font-bold uppercase">Hadir Terlambat</p>
                <p className="text-lg font-black text-amber-900 mt-1">
                  {absensiList.filter((a) => a.statusAbsensi === 'HADIR' && a.keteranganWaktu === 'TERLAMBAT').length}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                <p className="text-[10px] text-blue-700 font-bold uppercase">Izin Santri</p>
                <p className="text-lg font-black text-blue-900 mt-1">
                  {absensiList.filter((a) => a.statusAbsensi === 'IZIN').length}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <p className="text-[10px] text-rose-700 font-bold uppercase">Alpa</p>
                <p className="text-lg font-black text-rose-900 mt-1">
                  {absensiList.filter((a) => a.statusAbsensi === 'ALPA').length}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleInitFormulas}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold text-xs shadow-md hover:bg-emerald-900 transition cursor-pointer"
              >
                Siapkan Formula Rekap di Google Sheets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
