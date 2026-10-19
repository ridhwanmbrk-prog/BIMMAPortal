import { getBusinessDateString } from '../utils/date';
import { isScheduleApplicableOnDate } from '../utils/schedule';
import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileQuestion,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Camera,
  Check,
  X,
  Search,
  Filter,
  Edit2,
  RotateCcw,
  UserCheck,
  AlertTriangle,
  FileCheck2,
  Bell,
} from 'lucide-react';
import {
  Peserta,
  JadwalKegiatan,
  Izin,
  Pembenaran,
  Absensi,
  Musyrif,
  Batch,
} from '../types';
import {
  getItems,
  setItems,
  getCurrentUser,
  getActiveMusyrif,
  isWithinScheduleTime,
  getKegiatanSedangBerlangsung,
  addAuditLog,
  updateAbsensiRecord,
  getActiveBatchToday,
  getBatchStatusInfo,
  approveIzin,
  rejectIzin,
  verifyKedatanganSantri,
  getPendingKedatanganIzin,
} from '../storage';
import { generateSuratIzinPdf } from '../utils/suratIzinPdf';
import { PageId } from '../components/Layout';
import { QuickStudentPicker } from '../components/QuickStudentPicker';

interface DashboardProps {
  onNavigate: (page: PageId) => void;
  onOpenScanner: (mode?: 'PRESENSI' | 'SURAT_IZIN') => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ onNavigate, onOpenScanner }) => {
  const user = getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  // Sub-tab Dashboard (Utamanya: Live Overview, Absen Harian/Kegiatan, Per Santri)
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'harian-kegiatan' | 'per-santri'>(() => {
    const saved = localStorage.getItem('bimma_dashboard_tab');
    if (saved === 'overview' || saved === 'harian-kegiatan' || saved === 'per-santri') return saved;
    return 'overview';
  });

  const handleSetDashboardTab = (tab: 'overview' | 'harian-kegiatan' | 'per-santri') => {
    setDashboardTab(tab);
    localStorage.setItem('bimma_dashboard_tab', tab);
  };

  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalKegiatan[]>([]);
  const [izinList, setIzinList] = useState<Izin[]>([]);
  const [pembenaranList, setPembenaranList] = useState<Pembenaran[]>([]);
  const [absensiList, setAbsensiList] = useState<Absensi[]>([]);
  const [musyrifList, setMusyrifList] = useState<Musyrif[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Batch Filter (Menyesuaikan Batch Aktif Hari Ini & Jadwal Tenggat)
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  // Kegiatan Terpilih / Sedang Berlangsung
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>('');
  const todayStr = getBusinessDateString();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return localStorage.getItem('bimma_selected_date') || todayStr;
  });



  // State untuk Tab Absen Per Santri
  const [selectedSantriId, setSelectedSantriId] = useState<string>('');
  const [searchSantriQuery, setSearchSantriQuery] = useState('');
  const [hoveredGraphIdx, setHoveredGraphIdx] = useState<number | null>(null);

  // Modal Koreksi/Edit Status Absensi oleh Admin / Pengajuan oleh Petugas
  const [editStatusModal, setEditStatusModal] = useState<{
    open: boolean;
    peserta: Peserta | null;
    jadwal: JadwalKegiatan | null;
    tanggal: string;
    currentStatus: 'HADIR' | 'IZIN' | 'ALPA';
  }>({
    open: false,
    peserta: null,
    jadwal: null,
    tanggal: todayStr,
    currentStatus: 'ALPA',
  });
  const [alasanKoreksiInput, setAlasanKoreksiInput] = useState('');

  // Santri Izin yang perlu verifikasi kedatangan kembali ke asrama
  const [pendingKedatangan, setPendingKedatangan] = useState<ReturnType<typeof getPendingKedatanganIzin>>([]);
  const [verifikasiModal, setVerifikasiModal] = useState<{
    open: boolean;
    izin: Izin | null;
    peserta: Peserta | null;
    kodeInput: string;
    catatan: string;
  }>({
    open: false,
    izin: null,
    peserta: null,
    kodeInput: '',
    catatan: '',
  });
  const [verifNotification, setVerifNotification] = useState<string | null>(null);

  const loadData = () => {
    const p = getItems<Peserta>('PESERTA').filter((item) => item.statusPeserta === 'AKTIF');
    const j = getItems<JadwalKegiatan>('JADWAL');
    const i = getItems<Izin>('IZIN');
    const pb = getItems<Pembenaran>('PEMBENARAN');
    const a = getItems<Absensi>('ABSENSI');
    const m = getItems<Musyrif>('MUSYRIF');
    const b = getItems<Batch>('BATCH');

    setPesertaList(p);
    setJadwalList(j);
    setIzinList(i);
    setPembenaranList(pb);
    setAbsensiList(a);
    setMusyrifList(m);
    setBatches(b);
    setPendingKedatangan(getPendingKedatanganIzin());

    if (p.length > 0 && !selectedSantriId) {
      setSelectedSantriId(p[0].pesertaId);
    }

    // Deteksi kegiatan yang sedang berlangsung secara realtime
    const detected = getKegiatanSedangBerlangsung(j);
    if (!selectedJadwalId && detected.kegiatan) {
      setSelectedJadwalId(detected.kegiatan.jadwalId);
    } else if (!selectedJadwalId && j.length > 0) {
      setSelectedJadwalId(j[0].jadwalId);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);

    const handleDateUpdate = (e: any) => {
      if (e.detail?.date) {
        setSelectedDate(e.detail.date);
      }
    };
    window.addEventListener('bimma_date_changed', handleDateUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('bimma_date_changed', handleDateUpdate);
    };
  }, []);

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const isTodaySelected = selectedDate === todayStr;

  const hadirTepatCount = absensiList.filter(
    (a) => a.tanggal === selectedDate && a.statusAbsensi === 'HADIR' && a.keteranganWaktu !== 'TERLAMBAT'
  ).length;
  const hadirLateCount = absensiList.filter(
    (a) => a.tanggal === selectedDate && a.statusAbsensi === 'HADIR' && a.keteranganWaktu === 'TERLAMBAT'
  ).length;
  const izinHariIniCount = absensiList.filter(
    (a) => a.tanggal === selectedDate && a.statusAbsensi === 'IZIN'
  ).length;

  // Evaluasi Batch Aktif Hari Ini & Jadwal Tenggat
  const activeBatchToday = getActiveBatchToday(batches, selectedDate);
  const currentBatch = (selectedBatchId ? batches.find((b) => b.batchId === selectedBatchId) : null) || activeBatchToday || null;
  const currentBatchStatus = getBatchStatusInfo(currentBatch, selectedDate);

  // Santri yang difokuskan pada Dashboard adalah santri di Batch yang terpilih/aktif hari ini
  const pesertaInBatch = currentBatch ? pesertaList.filter((p) => p.batchId === currentBatch.batchId) : pesertaList;
  const totalSantriAktif = pesertaInBatch.length;
  const jadwalAktif = jadwalList.filter(
    (j) => j.statusAktif && isScheduleApplicableOnDate(j, selectedDate),
  );

  // Deteksi jadwal kegiatan yang strictly sedang berlangsung saat ini sesuai jamnya
  const activeOngoingJadwal = jadwalList.find((j) => j.statusAktif && isWithinScheduleTime(j).valid) || null;
  const ongoingKegiatan = activeOngoingJadwal;

  // Cek apakah jadwal ini benar-benar pas dalam rentang jam saat ini
  const ongoingStatusCheck = ongoingKegiatan
    ? isWithinScheduleTime(ongoingKegiatan)
    : { valid: false, reason: 'Tidak ada kegiatan' };

  // Hitung jumlah santri hadir hari ini untuk kegiatan yang sedang berlangsung di batch terpilih
  const absensiOngoingToday = ongoingKegiatan
    ? absensiList.filter(
        (a) =>
          a.tanggal === selectedDate &&
          a.statusAbsensi === 'HADIR' &&
          (a.jadwalId === ongoingKegiatan.jadwalId ||
            a.namaKegiatan.toLowerCase() === ongoingKegiatan.namaKegiatan.toLowerCase()) &&
          pesertaInBatch.some((p) => p.pesertaId === a.pesertaId)
      )
    : [];

  const hadirOngoingCount = absensiOngoingToday.length;
  const progressOngoingPct = totalSantriAktif > 0 && hadirOngoingCount > 0
    ? Math.round((hadirOngoingCount / totalSantriAktif) * 100)
    : 0;

  // Total hadir seluruh kegiatan hari ini untuk santri di batch terpilih
  const hadirHariIniSemua = absensiList.filter(
    (a) =>
      a.tanggal === selectedDate &&
      a.statusAbsensi === 'HADIR' &&
      pesertaInBatch.some((p) => p.pesertaId === a.pesertaId)
  ).length;

  const totalTargetSemua = totalSantriAktif * Math.max(1, jadwalAktif.length);
  const kedisiplinanPct = totalTargetSemua > 0 && hadirHariIniSemua > 0
    ? Math.min(100, Math.round((hadirHariIniSemua / totalTargetSemua) * 100))
    : 0;

  // Pending ACC Data (Izin & Pembenaran yang statusnya MENUNGGU)
  const pendingIzin = izinList.filter((i) => i.statusPersetujuan === 'MENUNGGU');
  const pendingPembenaran = pembenaranList.filter((p) => p.statusPersetujuan === 'MENUNGGU');
  const totalPendingACC = pendingIzin.length + pendingPembenaran.length;

  // Handler ACC Cepat Izin Langsung dari Dashboard (HANYA ADMIN)
  const handleDecideIzinQuick = (izinId: string, status: 'DISETUJUI' | 'DITOLAK') => {
    if (!isAdmin) return;
    if (status === 'DISETUJUI') {
      approveIzin(izinId, user?.id || 'U001');
    } else {
      rejectIzin(izinId, user?.id || 'U001');
    }
    loadData();
  };

  // Handler Verifikasi Kedatangan Santri Kembali ke Asrama
  const handleConfirmVerifikasiKedatangan = (e: React.FormEvent) => {
    e.preventDefault();
    const activeMusyrif = getActiveMusyrif();
    const petugasNama = activeMusyrif?.nama || user?.namaLengkap || 'Petugas Musyrif';
    const key =
      verifikasiModal.kodeInput.trim() ||
      verifikasiModal.izin?.kodeVerifikasi ||
      verifikasiModal.izin?.izinId ||
      verifikasiModal.peserta?.nim ||
      '';

    if (!key) return;
    const res = verifyKedatanganSantri(key, petugasNama, verifikasiModal.catatan);
    if (res.success) {
      setVerifNotification(res.message);
      setTimeout(() => setVerifNotification(null), 5000);
      setVerifikasiModal({ open: false, izin: null, peserta: null, kodeInput: '', catatan: '' });
      loadData();
    } else {
      alert(res.message);
    }
  };

  // Handler ACC Cepat Pembenaran Langsung dari Dashboard (HANYA ADMIN)
  const handleDecidePembenaranQuick = (pbId: string, status: 'DISETUJUI' | 'DITOLAK') => {
    if (!isAdmin) return;
    const target = pembenaranList.find((p) => p.pembenaranId === pbId);
    if (!target) return;

    if (status === 'DISETUJUI') {
      const aList = getItems<Absensi>('ABSENSI');
      const idx = aList.findIndex(
        (a) => a.jadwalId === target.jadwalId && a.pesertaId === target.pesertaId && a.tanggal === target.tanggalKejadian
      );
      if (idx !== -1) {
        aList[idx].statusAbsensi = 'HADIR';
        aList[idx].sumberAbsensi = 'PEMBENARAN_ADMIN';
        aList[idx].alasanKoreksi = `ACC Dashboard: ${target.alasan}`;
        setItems('ABSENSI', aList);
      } else {
        const newAbsensi: Absensi = {
          absensiId: `A${String(aList.length + 1).padStart(6, '0')}`,
          jadwalId: target.jadwalId,
          namaKegiatan: target.namaKegiatan,
          tanggal: target.tanggalKejadian,
          pesertaId: target.pesertaId,
          statusAbsensi: 'HADIR',
          waktuScan: `${target.tanggalKejadian}T18:00:00`,
          waktuServer: new Date().toISOString(),
          penggunaId: user?.id || 'U001',
          musyrifBertugas: 'Disetujui Admin',
          sumberAbsensi: 'PEMBENARAN_ADMIN',
          statusValidasi: 'SAH',
          alasanKoreksi: target.alasan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        aList.push(newAbsensi);
        setItems('ABSENSI', aList);
      }
    }

    const updated = pembenaranList.map((p) =>
      p.pembenaranId === pbId
        ? {
            ...p,
            statusPersetujuan: status,
            diputuskanOleh: user?.id || 'U001',
            waktuKeputusan: new Date().toISOString(),
          }
        : p
    );
    setItems('PEMBENARAN', updated);
    setPembenaranList(updated);
    loadData();
  };

  // Simpan Koreksi Status Absensi oleh Admin / Pengajuan Telat oleh Petugas
  const handleSaveKoreksiStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStatusModal.peserta || !editStatusModal.jadwal) return;

    const p = editStatusModal.peserta;
    const j = editStatusModal.jadwal;
    const tgl = editStatusModal.tanggal;
    const newStatus = editStatusModal.currentStatus;

    if (!isAdmin) {
      // Petugas tidak bisa langsung ACC kehadiran, melainkan membuat pengajuan ke Pembenaran untuk di-ACC Admin
      const pbList = getItems<Pembenaran>('PEMBENARAN');
      const newPbId = `PB${String(pbList.length + 1).padStart(4, '0')}`;
      const newPb: Pembenaran = {
        pembenaranId: newPbId,
        pesertaId: p.pesertaId,
        jadwalId: j.jadwalId,
        namaKegiatan: j.namaKegiatan,
        tanggalKejadian: tgl,
        alasan: alasanKoreksiInput || 'Pengajuan kehadiran telat kegiatan oleh petugas piket',
        diajukanOleh: user?.id || 'U002',
        waktuPengajuan: new Date().toISOString(),
        statusPersetujuan: 'MENUNGGU',
        statusAbsensiSebelum: editStatusModal.currentStatus,
        statusAbsensiSesudah: newStatus,
      };
      setItems('PEMBENARAN', [newPb, ...pbList]);
      addAuditLog({
        penggunaId: user?.id || 'U002',
        aksi: 'PENGAJUAN_TELAT_PETUGAS',
        jenisEntitas: 'PEMBENARAN',
        entitasId: newPbId,
        nilaiSesudah: `Pengajuan ${newStatus} untuk ${p.namaLengkap} (${j.namaKegiatan})`,
        alasan: alasanKoreksiInput,
        statusAksi: 'BERHASIL',
      });
      alert('Pengajuan kehadiran telat berhasil dikirim ke Admin untuk ditinjau dan di-ACC.');
      setEditStatusModal({ open: false, peserta: null, jadwal: null, tanggal: todayStr, currentStatus: 'ALPA' });
      setAlasanKoreksiInput('');
      loadData();
      return;
    }

    // Jika Admin: langsung perbarui record absensi
    const aList = getItems<Absensi>('ABSENSI');
    const existingIdx = aList.findIndex(
      (a) => a.pesertaId === p.pesertaId && a.jadwalId === j.jadwalId && a.tanggal === tgl
    );

    if (existingIdx !== -1) {
      aList[existingIdx].statusAbsensi = newStatus;
      aList[existingIdx].sumberAbsensi = 'PEMBENARAN_ADMIN';
      aList[existingIdx].alasanKoreksi = alasanKoreksiInput || 'Koreksi langsung oleh Admin';
      aList[existingIdx].updatedAt = new Date().toISOString();
      setItems('ABSENSI', aList);
    } else {
      const nowIso = new Date().toISOString();
      const newRec: Absensi = {
        absensiId: `A${String(aList.length + 1).padStart(6, '0')}`,
        jadwalId: j.jadwalId,
        namaKegiatan: j.namaKegiatan,
        tanggal: tgl,
        pesertaId: p.pesertaId,
        statusAbsensi: newStatus,
        waktuScan: nowIso,
        waktuServer: nowIso,
        penggunaId: user?.id || 'U001',
        musyrifBertugas: 'Koreksi Admin',
        sumberAbsensi: 'PEMBENARAN_ADMIN',
        statusValidasi: 'SAH',
        alasanKoreksi: alasanKoreksiInput || 'Diinput manual oleh Admin',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      aList.push(newRec);
      setItems('ABSENSI', aList);
    }

    addAuditLog({
      penggunaId: user?.id || 'U001',
      aksi: 'KOREKSI_ABSENSI_ADMIN',
      jenisEntitas: 'ABSENSI',
      entitasId: p.pesertaId,
      nilaiSesudah: `${newStatus} - ${p.namaLengkap} (${j.namaKegiatan})`,
      alasan: alasanKoreksiInput,
      statusAksi: 'BERHASIL',
    });

    setEditStatusModal({ open: false, peserta: null, jadwal: null, tanggal: todayStr, currentStatus: 'ALPA' });
    setAlasanKoreksiInput('');
    loadData();
  };

  // Santri Terpilih untuk Tab Absen Per Santri
  const selectedSantri = pesertaInBatch.find((p) => p.pesertaId === selectedSantriId) || pesertaInBatch[0];
  const absensiSelectedSantri = selectedSantri
    ? absensiList.filter((a) => a.pesertaId === selectedSantri.pesertaId)
    : [];
  const santriHadirCount = absensiSelectedSantri.filter((a) => a.statusAbsensi === 'HADIR').length;
  const santriIzinCount = absensiSelectedSantri.filter((a) => a.statusAbsensi === 'IZIN').length;
  const santriAlpaCount = absensiSelectedSantri.filter((a) => a.statusAbsensi === 'ALPA').length;
  const santriTotalSesi = santriHadirCount + santriIzinCount + santriAlpaCount;
  const santriPct = santriTotalSesi > 0 ? Math.round((santriHadirCount / santriTotalSesi) * 100) : 0;
  // Pending Items untuk Notifikasi & ACC
  const pendingItems: Array<{
    id: string;
    type: 'IZIN' | 'PEMBENARAN' | 'KEDATANGAN';
    santriName: string;
    nim?: string;
    badgeLabel: string;
    badgeColor: string;
    description: string;
    dateInfo: string;
    data: any;
  }> = [];

  // 1. Pengajuan Izin Menunggu ACC
  pendingIzin.forEach((iz) => {
    const snt = pesertaList.find((p) => p.pesertaId === iz.pesertaId);
    pendingItems.push({
      id: iz.izinId,
      type: 'IZIN',
      santriName: snt?.namaLengkap || iz.pesertaId,
      nim: snt?.nim,
      badgeLabel: iz.jenisIzin.replace('_', ' '),
      badgeColor: iz.jenisIzin === 'SAKIT' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800',
      description: iz.alasan || 'Permohonan izin meninggalkan asrama',
      dateInfo: iz.waktuMulai ? iz.waktuMulai.split('T')[0] : 'Hari ini',
      data: iz,
    });
  });

  // 2. Pengajuan Koreksi Hadir Telat / Lupa Scan Menunggu ACC
  pendingPembenaran.forEach((pb) => {
    const snt = pesertaList.find((p) => p.pesertaId === pb.pesertaId);
    pendingItems.push({
      id: pb.pembenaranId,
      type: 'PEMBENARAN',
      santriName: snt?.namaLengkap || pb.pesertaId,
      nim: snt?.nim,
      badgeLabel: `Telat: ${pb.namaKegiatan}`,
      badgeColor: 'bg-blue-100 text-blue-800',
      description: pb.alasan || 'Koreksi kehadiran santri',
      dateInfo: pb.tanggalKejadian,
      data: pb,
    });
  });

  // 3. Santri Sedang Izin yang Perlu Verifikasi Kedatangan ke Asrama
  pendingKedatangan.forEach(({ izin, peserta: snt, isOverdue, deadlineString }) => {
    pendingItems.push({
      id: `kedatangan-${izin.izinId}`,
      type: 'KEDATANGAN',
      santriName: snt?.namaLengkap || izin.pesertaId,
      nim: snt?.nim,
      badgeLabel: isOverdue ? 'Terlambat Kembali' : 'Kembali Asrama',
      badgeColor: isOverdue ? 'bg-rose-500 text-white font-black animate-pulse' : 'bg-emerald-100 text-emerald-800',
      description: `Batas: ${deadlineString}`,
      dateInfo: deadlineString,
      data: { izin, peserta: snt },
    });
  });



  // HELPER 2: Petugas Musyrif Piket
  const renderMusyrifCard = () => (
    <div className="bg-white rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-[8px_12px_24px_rgba(180,205,190,0.35)] border border-slate-100">
      <div className="flex items-center justify-between mb-3.5 sm:mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#059669]" />
          <h3 className="font-extrabold text-sm text-slate-800">Petugas Musyrif Piket</h3>
        </div>
        {isAdmin && (
          <button
            onClick={() => onNavigate('petugas' as PageId)}
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Edit Petugas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-3 sm:space-y-3.5">
        {musyrifList.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2">
            Belum ada petugas musyrif terdaftar.
          </p>
        ) : (
          musyrifList.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#10b981] to-[#047857] p-0.5 shadow-xs flex items-center justify-center shrink-0">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-xs text-[#059669]">
                    {m.nama.slice(5, 7) || 'US'}
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-slate-800 leading-tight truncate">{m.nama}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-semibold flex items-center gap-1.5 truncate">
                    <span className="font-mono text-emerald-800 font-bold">{m.nim || '200125016'}</span>
                    <span className="text-slate-300">•</span>
                    <span>{m.jurusan || 'S1 DKV'}</span>
                  </p>
                </div>
              </div>

              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  );

  // HELPER 3: Overview Kehadiran Kegiatan & 3 Dynamic Stats Tiles
  const renderOverviewSection = () => {
    const graphPoints = jadwalList
      .filter((j) => isScheduleApplicableOnDate(j, selectedDate))
      .map((j, idx) => {
      const records = absensiList.filter(
        (a) =>
          a.tanggal === selectedDate &&
          a.statusAbsensi === 'HADIR' &&
          (a.jadwalId === j.jadwalId || a.namaKegiatan.toLowerCase() === j.namaKegiatan.toLowerCase())
      );
      const hadir = records.length;
      const pct = totalSantriAktif > 0 ? Math.round((hadir / totalSantriAktif) * 100) : 0;
      const isNow = isWithinScheduleTime(j).valid;
      const totalItems = Math.max(1, jadwalList.length);
      const x = totalItems === 1 ? 200 : 40 + (idx / (totalItems - 1)) * 320;
      const y = 68 - (pct / 100) * 44;
      return { j, idx, hadir, pct, isNow, x, y };
    });

    let graphLinePath = '';
    let graphAreaPath = '';

    if (graphPoints.length === 0) {
      graphLinePath = 'M 0 68 L 400 68';
      graphAreaPath = 'M 0 68 L 400 68 L 400 88 L 0 88 Z';
    } else if (graphPoints.length === 1) {
      graphLinePath = `M 0 ${graphPoints[0].y} L 400 ${graphPoints[0].y}`;
      graphAreaPath = `M 0 ${graphPoints[0].y} L 400 ${graphPoints[0].y} L 400 88 L 0 88 Z`;
    } else {
      graphLinePath = `M ${graphPoints[0].x} ${graphPoints[0].y}`;
      for (let i = 0; i < graphPoints.length - 1; i++) {
        const p0 = graphPoints[i];
        const p1 = graphPoints[i + 1];
        const cpx = (p0.x + p1.x) / 2;
        graphLinePath += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      graphAreaPath = `${graphLinePath} L ${graphPoints[graphPoints.length - 1].x} 88 L ${graphPoints[0].x} 88 Z`;
    }

    const activeGraphPoint =
      hoveredGraphIdx !== null
        ? graphPoints[hoveredGraphIdx]
        : graphPoints.find((p) => p.j.jadwalId === ongoingKegiatan?.jadwalId) || graphPoints[0];

    return (
      <div className="space-y-6">
        {/* TOP ROW: DYNAMIC HERO CARD (UPDATED TO ONGOING ACTIVITY) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Emerald Gradient Curve Card */}
          <div className="lg:col-span-7 hero-emerald-card rounded-[32px] p-5 sm:p-6 text-white relative overflow-hidden flex flex-col justify-between min-h-[270px]">
            <div className="flex items-center justify-between z-10">
              <div>
                <h2 className="text-base font-bold tracking-tight text-white/95">
                  Overview Kehadiran Kegiatan
                </h2>
                <p className="text-[11px] text-emerald-200 mt-0.5">
                  {ongoingKegiatan ? ongoingKegiatan.namaKegiatan : 'Tidak ada kegiatan'}
                </p>
              </div>

              {ongoingKegiatan ? (
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold text-white border border-white/25 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  <span>{ongoingKegiatan.jamMulai} - {ongoingKegiatan.jamSelesai} WIB</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold text-emerald-100 border border-white/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-300" />
                  <span>Tidak ada kegiatan</span>
                </span>
              )}
            </div>

            {/* INTERACTIVE DATA-DRIVEN GRAPH */}
            <div className="my-auto py-2 relative z-10">
              <div className="relative h-24 w-full flex items-center">
                <svg viewBox="0 0 400 90" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="interactiveEmeraldWave" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  <line x1="20" y1="68" x2="380" y2="68" stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="20" y1="46" x2="380" y2="46" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" strokeWidth="1" />
                  <path d={graphAreaPath} fill="url(#interactiveEmeraldWave)" />
                  <path d={graphLinePath} fill="none" stroke="#a7f3d0" strokeWidth="3" strokeLinecap="round" />

                  {graphPoints.map((pt) => {
                    const isSelected = pt.j.jadwalId === ongoingKegiatan?.jadwalId;
                    const isHovered = hoveredGraphIdx === pt.idx;
                    return (
                      <g key={pt.j.jadwalId} className="cursor-pointer">
                        {(isSelected || isHovered || pt.isNow) && (
                          <circle cx={pt.x} cy={pt.y} r="11" fill="none" stroke="#6ee7b7" strokeWidth="2" opacity="0.8" className="animate-ping" />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected || isHovered ? 7 : 5}
                          fill={isSelected || isHovered ? '#ffffff' : '#a7f3d0'}
                          stroke="#047857"
                          strokeWidth={isSelected || isHovered ? 3.5 : 2}
                          className="transition-all duration-150"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="22"
                          fill="transparent"
                          onMouseEnter={() => setHoveredGraphIdx(pt.idx)}
                          onMouseLeave={() => setHoveredGraphIdx(null)}
                          onClick={() => {
                            setSelectedJadwalId(pt.j.jadwalId);
                            setHoveredGraphIdx(pt.idx);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>

                {activeGraphPoint && (
                  <div
                    className="absolute -top-3 transform -translate-x-1/2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/25 text-center shadow-2xl transition-all duration-200 z-20 pointer-events-none"
                    style={{ left: `${(activeGraphPoint.x / 400) * 100}%` }}
                  >
                    <div className="text-[11px] font-black text-white leading-tight flex items-center justify-center gap-1.5">
                      <span>{activeGraphPoint.hadir} Hadir</span>
                      <span className="text-emerald-400 font-bold">({activeGraphPoint.pct}%)</span>
                    </div>
                    <div className="text-[8px] font-bold text-emerald-200 uppercase tracking-wider mt-0.5 whitespace-nowrap">
                      {activeGraphPoint.j.namaKegiatan} {activeGraphPoint.isNow ? '• LIVE' : ''}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-[10px] text-white/75 font-semibold px-1 mt-1 overflow-x-auto gap-1">
                {graphPoints.map((pt) => {
                  const isSelected = pt.j.jadwalId === ongoingKegiatan?.jadwalId;
                  return (
                    <button
                      key={pt.j.jadwalId}
                      type="button"
                      onClick={() => {
                        setSelectedJadwalId(pt.j.jadwalId);
                        setHoveredGraphIdx(pt.idx);
                      }}
                      onMouseEnter={() => setHoveredGraphIdx(pt.idx)}
                      onMouseLeave={() => setHoveredGraphIdx(null)}
                      className={`px-2.5 py-1 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isSelected
                          ? 'text-emerald-950 font-black bg-white shadow-md scale-102'
                          : 'text-white/80 hover:text-white hover:bg-white/15'
                      }`}
                    >
                      <span>{pt.j.namaKegiatan}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-white/20 text-white'}`}>
                        {pt.pct}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom 3 Stats Cluster */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15 z-10 text-center">
              <div>
                <p className="text-[10px] font-semibold text-emerald-100">Total Hadir Sesi Ini</p>
                <p className="text-lg font-black tracking-tight text-white">{hadirOngoingCount}</p>
                <span className="text-[9px] text-emerald-200">{progressOngoingPct}% dari Santri</span>
              </div>
              <div className="border-x border-white/15">
                <p className="text-[10px] font-semibold text-emerald-100">Santri Aktif</p>
                <p className="text-lg font-black tracking-tight text-white">{totalSantriAktif}</p>
                <span className="text-[9px] text-emerald-200">Mahasantri BIMMA</span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-emerald-100">Kedisiplinan</p>
                <p className="text-lg font-black tracking-tight text-white">{kedisiplinanPct}%</p>
                <span className="text-[9px] text-emerald-200">Target 95%</span>
              </div>
            </div>
          </div>

          {/* Right Two Cards: Kamera Action + Live Status Card */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div
              onClick={() => onOpenScanner('PRESENSI')}
              className="hidden md:flex bg-[#059669] rounded-[28px] p-5 text-white items-center justify-between shadow-[0_12px_24px_rgba(5,150,105,0.3)] hover:scale-[1.02] active:scale-98 transition cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white">Buka Kamera Scan</h3>
                  <p className="text-[11px] text-emerald-100 mt-0.5">Validasi QR Code Santri</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition" />
            </div>

            <div className="hero-teal-card rounded-[32px] p-5 text-white flex flex-col justify-between flex-1 min-h-[140px] shadow-[0_14px_28px_rgba(13,148,136,0.35)] relative overflow-hidden">
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center text-white">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white leading-tight">
                      {ongoingKegiatan ? ongoingKegiatan.namaKegiatan : 'Kegiatan Hari Ini'}
                    </h3>
                    <p className="text-[10px] text-teal-100 font-medium">
                      {ongoingKegiatan ? `${ongoingKegiatan.jamMulai} - ${ongoingKegiatan.jamSelesai} WIB` : 'Jadwal'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('jadwal')}
                  className="w-8 h-8 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center text-white transition cursor-pointer"
                  title="Kelola Jadwal Kegiatan"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/20 flex items-baseline justify-between z-10">
                <div>
                  <p className="text-[10px] text-teal-100 font-semibold">Status Waktu</p>
                  <p className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                    {ongoingStatusCheck.valid ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                        <span>Sedang Berlangsung</span>
                      </>
                    ) : (
                      <span>Sesuai Jam Terjadwal</span>
                    )}
                  </p>
                </div>
                <span className="text-[11px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full text-white">
                  {hadirOngoingCount} Hadir
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: 3 DYNAMIC STATS TILES */}
        <div className="grid grid-cols-3 gap-2 sm:gap-5">
          {/* TILE 1: PRESENSI KEGIATAN */}
          <div className="bg-white rounded-xl sm:rounded-[28px] p-2.5 sm:p-5 shadow-[4px_8px_16px_rgba(180,205,190,0.25)] border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-2xl bg-[#059669] text-white flex items-center justify-center shadow-xs">
                <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <span className="hidden sm:inline text-[11px] font-bold text-slate-400">Target 100%</span>
              <span className="sm:hidden text-[10px] font-black text-emerald-700">{progressOngoingPct}%</span>
            </div>

            <div className="mt-2 sm:mt-4">
              <h4 className="font-extrabold text-[11px] sm:text-sm text-slate-800 leading-tight truncate">
                Presensi {ongoingKegiatan ? ongoingKegiatan.namaKegiatan : 'Sesi'}
              </h4>
              <p className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                {ongoingKegiatan ? `${ongoingKegiatan.jamMulai} - ${ongoingKegiatan.jamSelesai}` : 'Absensi QR'}
              </p>
            </div>

            <div className="mt-2 sm:mt-4 space-y-1 sm:space-y-2">
              <div className="hidden sm:flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500">Progress</span>
                <span className="text-[#059669]">{progressOngoingPct}%</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#059669] to-[#10b981] rounded-full transition-all duration-500"
                  style={{ width: `${progressOngoingPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-0.5 sm:pt-1 text-[9px] sm:text-[10px] font-semibold text-slate-500">
                <span className="font-bold text-slate-800">{hadirOngoingCount} Santri</span>
                <span className="hidden sm:inline bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                  {ongoingStatusCheck.valid ? 'Berlangsung' : 'Sesi Wajib'}
                </span>
              </div>
            </div>
          </div>

          {/* TILE 2: PENGAJUAN IZIN & ACC REVIEW */}
          <div className="bg-white rounded-xl sm:rounded-[28px] p-2.5 sm:p-5 shadow-[4px_8px_16px_rgba(180,205,190,0.25)] border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-2xl bg-[#f59e0b] text-white flex items-center justify-center shadow-xs">
                <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[9px] sm:text-[11px] font-bold text-amber-600 truncate max-w-[70px] sm:max-w-none">
                {totalPendingACC} Antre
              </span>
            </div>

            <div className="mt-2 sm:mt-4">
              <h4 className="font-extrabold text-[11px] sm:text-sm text-slate-800 leading-tight truncate">
                ACC Perizinan
              </h4>
              <p className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Izin & Telat</p>
            </div>

            <div className="mt-2 sm:mt-4 space-y-1 sm:space-y-2">
              <div className="hidden sm:flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500">Verifikasi ACC</span>
                <span className="text-amber-600 font-bold">
                  {totalPendingACC > 0 ? `${totalPendingACC} Antrean` : 'Tuntas'}
                </span>
              </div>
              <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${totalPendingACC > 0 ? 40 : 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-0.5 sm:pt-1 text-[9px] sm:text-[10px] font-semibold text-slate-500">
                <span className="font-bold text-slate-800">{totalPendingACC} Pending</span>
                <span className="hidden sm:inline bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  {isAdmin ? 'Admin ACC' : 'Review'}
                </span>
              </div>
            </div>
          </div>

          {/* TILE 3: FASE BIMBINGAN BATCH AKTIF */}
          <div className="bg-white rounded-xl sm:rounded-[28px] p-2.5 sm:p-5 shadow-[4px_8px_16px_rgba(180,205,190,0.25)] border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-2xl bg-[#0d9488] text-white flex items-center justify-center shadow-xs">
                <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[9px] sm:text-[11px] font-bold text-teal-600 truncate">
                {batches[0]?.namaBatch.split(' - ')[0] || 'Batch 1'}
              </span>
            </div>

            <div className="mt-2 sm:mt-4">
              <h4 className="font-extrabold text-[11px] sm:text-sm text-slate-800 leading-tight truncate">
                Fase Bimbingan
              </h4>
              <p className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                {batches[0]?.agendaKalender[2]?.namaAgenda || 'Masa Pesma'}
              </p>
            </div>

            <div className="mt-2 sm:mt-4 space-y-1 sm:space-y-2">
              <div className="hidden sm:flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500">Kelulusan</span>
                <span className="text-[#0d9488]">94%</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#0d9488] rounded-full w-[94%]" />
              </div>
              <div className="flex items-center justify-between pt-0.5 sm:pt-1 text-[9px] sm:text-[10px] font-semibold text-slate-500">
                <span className="font-bold text-slate-800">Target 95%</span>
                <span className="hidden sm:inline bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                  Syahadah
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL ACC TERPADU UNTUK ADMIN (ACC IZIN & ACC PEMBENARAN TELAT) */}
        {isAdmin && totalPendingACC > 0 && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-[28px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-amber-900 leading-tight">
                    Panel Persetujuan Cepat (ACC Data Admin)
                  </h3>
                  <p className="text-[11px] text-amber-700">
                    {totalPendingACC} permohonan menunggu keputusan Anda langsung dari dashboard
                  </p>
                </div>
              </div>

              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-200 text-amber-900">
                Perlu Keputusan
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Izin yang menunggu */}
              {pendingIzin.map((iz) => {
                const santri = pesertaList.find((p) => p.pesertaId === iz.pesertaId);
                return (
                  <div
                    key={iz.izinId}
                    className="p-3.5 rounded-2xl bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-800">
                          {santri?.namaLengkap || 'Santri'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                          {iz.jenisIzin}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{iz.alasan}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDecideIzinQuick(iz.izinId, 'DISETUJUI')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>ACC Setujui</span>
                      </button>
                      <button
                        onClick={() => handleDecideIzinQuick(iz.izinId, 'DITOLAK')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition border border-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pembenaran yang menunggu */}
              {pendingPembenaran.map((pb) => {
                const santri = pesertaList.find((p) => p.pesertaId === pb.pesertaId);
                return (
                  <div
                    key={pb.pembenaranId}
                    className="p-3.5 rounded-2xl bg-white border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-800">
                          {santri?.namaLengkap || 'Santri'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px]">
                          Koreksi Telat: {pb.namaKegiatan}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{pb.alasan}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDecidePembenaranQuick(pb.pembenaranId, 'DISETUJUI')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>ACC Hadirkan</span>
                      </button>
                      <button
                        onClick={() => handleDecidePembenaranQuick(pb.pembenaranId, 'DITOLAK')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition border border-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // HELPER 4: Perlu Verifikasi & ACC Card
  const renderPerluVerifAccCard = () => (
    <div className="bg-white rounded-[28px] sm:rounded-[32px] p-4 sm:p-5 shadow-[8px_12px_24px_rgba(180,205,190,0.35)] border border-amber-200/80 space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 leading-tight">
              Perlu Verifikasi &amp; ACC
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Perizinan, telat, &amp; kedatangan
            </p>
          </div>
        </div>

        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
          pendingItems.length > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800'
        }`}>
          {pendingItems.length} Antrean
        </span>
      </div>

      {pendingItems.length === 0 ? (
        <div className="py-4 px-3 text-center space-y-1.5 bg-[#f4f8f5] rounded-2xl border border-emerald-100">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
          <p className="font-bold text-xs text-slate-700">Semua Data Terverifikasi</p>
          <p className="text-[10px] text-slate-500">
            Tidak ada antrean ACC perizinan atau konfirmasi telat saat ini.
          </p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-[#fafcfb] border border-slate-200/80 hover:border-emerald-300 transition shadow-2xs space-y-2"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-xs text-slate-900 truncate" title={item.santriName}>
                    {item.santriName}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {item.nim ? `NIM: ${item.nim}` : item.dateInfo}
                  </p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase shrink-0 ${item.badgeColor}`}>
                  {item.badgeLabel}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 line-clamp-1 italic bg-white px-2 py-1 rounded-lg border border-slate-100">
                "{item.description}"
              </p>

              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                {item.type === 'IZIN' && (
                  isAdmin ? (
                    <>
                      <button
                        onClick={() => handleDecideIzinQuick(item.id, 'DISETUJUI')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        title="ACC Setujui Izin Santri"
                      >
                        <Check className="w-3 h-3" />
                        <span>ACC Setujui</span>
                      </button>
                      <button
                        onClick={() => handleDecideIzinQuick(item.id, 'DITOLAK')}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-rose-600 text-[11px] font-bold transition border border-slate-200 cursor-pointer"
                        title="Tolak Izin"
                      >
                        <X className="w-3 h-3" />
                        <span>Tolak</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onNavigate('izin')}
                      className="w-full px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Tinjau Perizinan</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )
                )}

                {item.type === 'PEMBENARAN' && (
                  isAdmin ? (
                    <>
                      <button
                        onClick={() => handleDecidePembenaranQuick(item.id, 'DISETUJUI')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        title="ACC Hadirkan Mahasantri"
                      >
                        <Check className="w-3 h-3" />
                        <span>ACC Hadir</span>
                      </button>
                      <button
                        onClick={() => handleDecidePembenaranQuick(item.id, 'DITOLAK')}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-rose-600 text-[11px] font-bold transition border border-slate-200 cursor-pointer"
                        title="Tolak Koreksi"
                      >
                        <X className="w-3 h-3" />
                        <span>Tolak</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onNavigate('pembenaran')}
                      className="w-full px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Tinjau Koreksi</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )
                )}

                {item.type === 'KEDATANGAN' && (
                  <button
                    onClick={() =>
                      setVerifikasiModal({
                        open: true,
                        izin: item.data.izin,
                        peserta: item.data.peserta || null,
                        kodeInput: item.data.izin.kodeVerifikasi || item.data.izin.izinId,
                        catatan: 'Santri telah kembali ke asrama dengan selamat.',
                      })
                    }
                    className="w-full px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verifikasi Hadir di Asrama</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // HELPER 5: Integrasi 3 Batch Card
  const renderBatchCard = () => (
    <div className="bg-white rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-[8px_12px_24px_rgba(180,205,190,0.35)] border border-emerald-100 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-emerald-50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#059669]" />
          <h3 className="font-extrabold text-sm text-slate-800">Integrasi 3 Batch</h3>
        </div>
        <button
          onClick={() => onNavigate('batch')}
          className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Kalender</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2.5">
        {batches.map((b) => {
          const count = pesertaList.filter((p) => p.batchId === b.batchId).length;
          return (
            <div
              key={b.batchId}
              onClick={() => onNavigate('batch')}
              className="p-3 rounded-2xl bg-[#f4f8f5] hover:bg-emerald-50/70 border border-emerald-100/60 transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900">{b.namaBatch}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {b.statusBatch}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{b.keterangan}</p>
              </div>

              <div className="text-right">
                <span className="text-base font-black text-emerald-800 font-mono">{count}</span>
                <span className="text-[10px] text-slate-500 block">Santri</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-emerald-50 flex items-center justify-between text-xs font-bold text-slate-600">
        <span>Total Santri Terdaftar:</span>
        <span className="text-emerald-800 font-black font-mono">{totalSantriAktif} Mahasantri</span>
      </div>
    </div>
  );

  // HELPER 6: SUB-TABS NAVIGASI (ADMIN) - IKON AJA DI MOBILE, LABEL LENGKAP DI DESKTOP
  const renderSubTabs = (mode: 'mobile' | 'desktop') => {
    if (!isAdmin) return null;

    if (mode === 'mobile') {
      return (
        <div className="flex items-center justify-between px-1 py-0.5">
          <div className="flex items-center gap-1 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              onClick={() => handleSetDashboardTab('overview')}
              title="Monitoring Kegiatan (Overview)"
              aria-label="Monitoring Kegiatan"
              className={`p-2 rounded-xl transition cursor-pointer ${
                dashboardTab === 'overview'
                  ? 'bg-emerald-700 text-white shadow-xs font-black'
                  : 'bg-transparent text-slate-500 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSetDashboardTab('harian-kegiatan')}
              title="Absen Harian & Kegiatan"
              aria-label="Absen Harian & Kegiatan"
              className={`p-2 rounded-xl transition cursor-pointer ${
                dashboardTab === 'harian-kegiatan'
                  ? 'bg-emerald-700 text-white shadow-xs font-black'
                  : 'bg-transparent text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSetDashboardTab('per-santri')}
              title="Absen Per Santri (Dossier)"
              aria-label="Absen Per Santri"
              className={`p-2 rounded-xl transition cursor-pointer ${
                dashboardTab === 'per-santri'
                  ? 'bg-emerald-700 text-white shadow-xs font-black'
                  : 'bg-transparent text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-100/90 px-2.5 py-1 rounded-full border border-slate-200/60">
            {dashboardTab === 'overview'
              ? 'Monitoring'
              : dashboardTab === 'harian-kegiatan'
              ? 'Absen Harian'
              : 'Per Santri'}
          </span>
        </div>
      );
    }

    return (
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl sm:rounded-[24px] border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => handleSetDashboardTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              dashboardTab === 'overview'
                ? 'bg-emerald-700 text-white shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Monitoring Kegiatan</span>
          </button>
          <button
            onClick={() => handleSetDashboardTab('harian-kegiatan')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              dashboardTab === 'harian-kegiatan'
                ? 'bg-emerald-700 text-white shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Absen Harian &amp; Kegiatan</span>
          </button>
          <button
            onClick={() => handleSetDashboardTab('per-santri')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              dashboardTab === 'per-santri'
                ? 'bg-emerald-700 text-white shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Absen Per Santri (Dossier)</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative pb-12">
      {/* FLOATING ACTION BUTTON (CTA) KAMERA SCAN - HANYA DI MOBILE TELEPON (< md) */}
      <button
        onClick={() => onOpenScanner('PRESENSI')}
        title="Buka Kamera Scan QR Presensi"
        aria-label="Scan Presensi Mahasantri"
        className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-[0_12px_28px_rgba(4,120,87,0.6)] hover:shadow-[0_16px_36px_rgba(4,120,87,0.75)] hover:scale-108 active:scale-95 transition-all duration-200 border-2 border-white/70 cursor-pointer backdrop-blur-md group"
      >
        <div className="relative flex items-center justify-center">
          <Camera className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
        </div>
      </button>

      {/* Toast Notifikasi Verifikasi Kedatangan */}
      {verifNotification && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{verifNotification}</span>
          </div>
          <button
            onClick={() => setVerifNotification(null)}
            className="text-emerald-700 hover:underline cursor-pointer text-[11px]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & KEGIATAN YANG SEDANG BERLANGSUNG                        */}
      {/* ========================================================================= */}
      {dashboardTab === 'overview' && (
        <>
          {/* MOBILE VIEWPORT SPECIFIC SEQUENCE (< md):                                  */}
          {/* 1. Paling atas: Petugas Musyrif                                           */}
          {/* 2. Nempel di atas overview: Sub-tabs ikon aja                             */}
          {/* 3. Bawahnya: Overview                                                     */}
          {/* 4. Bawahnya: Yang perlu verif dan ACC                                     */}
          {/* 5. Kamera scan: Ikon mengambang CTA di pojok kanan bawah                  */}
          {/* 6. Sisanya ke bawah (3 Batch)                                             */}
          <div className="md:hidden space-y-5">
            {/* 1. PALING ATAS: PETUGAS MUSYRIF */}
            {renderMusyrifCard()}

            {/* 2. NEMPEL DI ATAS OVERVIEW: SUB-TABS IKON AJA & OVERVIEW */}
            <div className="space-y-2">
              {renderSubTabs('mobile')}
              {renderOverviewSection()}
            </div>

            {/* 3. BAWAHNYA: YANG PERLU VERIFIKASI DAN ACC */}
            {renderPerluVerifAccCard()}

            {/* 4. SISANYA KE BAWAH: BATCH */}
            {renderBatchCard()}
          </div>

          {/* DESKTOP VIEWPORT: 2-COLUMNS GRID (>= md)                                   */}
          <div className="hidden md:block space-y-6">
            {renderSubTabs('desktop')}
            <div className="grid grid-cols-12 gap-6 items-start">
              {/* Left 8 columns: Overview & Activity Graphs */}
              <div className="col-span-12 xl:col-span-8 space-y-6">
                {renderOverviewSection()}
              </div>

              {/* Right 4 columns: Musyrif, Perlu Verifikasi & ACC, Integrasi 3 Batch */}
              <div className="col-span-12 xl:col-span-4 space-y-6">
                {renderMusyrifCard()}
                {renderPerluVerifAccCard()}
                {renderBatchCard()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ABSEN HARIAN & KEGIATAN (ADMIN PRIORITY FEATURE)                     */}
      {/* ========================================================================= */}
      {dashboardTab === 'harian-kegiatan' && (
        <div className="space-y-5">
          {/* Sub-Tabs Navigasi: Ikon aja di mobile, lengkap di desktop */}
          <div className="md:hidden">{renderSubTabs('mobile')}</div>
          <div className="hidden md:block">{renderSubTabs('desktop')}</div>

          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-[26px] border border-slate-200/70 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-800">
                Tabel Absensi Harian Per Kegiatan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pantau kehadiran setiap santri untuk kegiatan tertentu dan edit/koreksi status langsung di tempat.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Tanggal */}
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-bold bg-transparent text-slate-700 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Filter Kegiatan */}
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <Clock className="w-4 h-4 text-emerald-700" />
                <select
                  value={selectedJadwalId}
                  onChange={(e) => setSelectedJadwalId(e.target.value)}
                  className="text-xs font-bold bg-transparent text-slate-700 focus:outline-none cursor-pointer"
                >
                  {jadwalList.map((j) => (
                    <option key={j.jadwalId} value={j.jadwalId}>
                      {j.namaKegiatan} ({j.jamMulai} - {j.jamSelesai} WIB)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table Santri for This Activity & Date */}
          <div className="bg-white rounded-[26px] shadow-sm border border-slate-200/70 overflow-hidden">
            <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
              <span className="font-extrabold text-xs text-emerald-900">
                Kegiatan: {ongoingKegiatan ? ongoingKegiatan.namaKegiatan : ''} • Tanggal: {selectedDate}
              </span>
              <span className="text-xs font-bold text-emerald-800">
                {absensiOngoingToday.length} dari {totalSantriAktif} Santri Hadir
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f2f7f4] text-slate-700 font-black border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 pl-5">NIM</th>
                    <th className="p-3.5">Nama Santri</th>
                    <th className="p-3.5">Prodi & Batch</th>
                    <th className="p-3.5">Waktu Scan</th>
                    <th className="p-3.5">Petugas Musyrif</th>
                    <th className="p-3.5">Status Kehadiran</th>
                    <th className="p-3.5 pr-5 text-right">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {pesertaList.map((p) => {
                    const record = absensiList.find(
                      (a) =>
                        a.tanggal === selectedDate &&
                        a.pesertaId === p.pesertaId &&
                        (a.jadwalId === ongoingKegiatan?.jadwalId ||
                          a.namaKegiatan.toLowerCase() === ongoingKegiatan?.namaKegiatan.toLowerCase())
                    );

                    const status: 'HADIR' | 'IZIN' | 'ALPA' = record ? record.statusAbsensi : 'ALPA';

                    return (
                      <tr key={p.pesertaId} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 pl-5 font-mono font-bold text-slate-600">{p.nim}</td>
                        <td className="p-3.5 font-bold text-slate-800">{p.namaLengkap}</td>
                        <td className="p-3.5 text-slate-500">
                          {p.programStudi} • <span className="font-semibold text-emerald-700">{p.batchId}</span>
                        </td>
                        <td className="p-3.5 font-mono text-emerald-800 font-bold">
                          {record?.waktuScan ? record.waktuScan.split('T')[1]?.slice(0, 8) : '-'}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {record?.musyrifBertugas || '-'}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              status === 'HADIR'
                                ? 'bg-emerald-100 text-emerald-800'
                                : status === 'IZIN'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {status === 'ALPA' ? 'BELUM ABSEN' : status}
                          </span>
                        </td>
                        <td className="p-3.5 pr-5 text-right">
                          <button
                            onClick={() => {
                              setEditStatusModal({
                                open: true,
                                peserta: p,
                                jadwal: ongoingKegiatan,
                                tanggal: selectedDate,
                                currentStatus: status,
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] transition inline-flex items-center gap-1 cursor-pointer border border-emerald-200"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{isAdmin ? 'Koreksi Status' : 'Ajukan Telat'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ABSEN PER SANTRI (DOSSIER / INDIVIDUAL RECAP FEATURE)              */}
      {/* ========================================================================= */}
      {dashboardTab === 'per-santri' && (
        <div className="space-y-6">
          {/* Sub-Tabs Navigasi: Ikon aja di mobile, lengkap di desktop */}
          <div className="md:hidden">{renderSubTabs('mobile')}</div>
          <div className="hidden md:block">{renderSubTabs('desktop')}</div>

          {/* Santri Selector & Search Header with QuickStudentPicker */}
          <div className="bg-white p-5 rounded-[26px] border border-slate-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-800">
                Pencarian & Rekap Kehadiran Per Mahasantri
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cari dengan mengetik nama/NIM atau scan QR code santri untuk melihat riwayat kehadiran lengkap.
              </p>
            </div>

            <div className="w-full sm:w-80">
              <QuickStudentPicker
                selectedPesertaId={selectedSantriId}
                onSelectPeserta={(p) => setSelectedSantriId(p ? p.pesertaId : '')}
                pesertaList={pesertaList}
                placeholder="Tulis Nama / NIM atau Scan QR..."
              />
            </div>
          </div>

          {/* Individual Dossier Card */}
          {selectedSantri && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Santri Profile & Stats Card */}
              <div className="lg:col-span-4 bg-white rounded-[28px] p-6 border border-slate-200/70 shadow-xs space-y-5">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-linear-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center font-black text-2xl shadow-md">
                    {selectedSantri.namaLengkap.slice(0, 2).toUpperCase()}
                  </div>
                  <h3 className="font-black text-base text-slate-800 mt-3">
                    {selectedSantri.namaLengkap}
                  </h3>
                  <p className="text-xs font-mono font-bold text-emerald-700">
                    NIM: {selectedSantri.nim}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedSantri.programStudi} • {selectedSantri.batchId}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">Kehadiran</p>
                    <p className="text-base font-black text-emerald-700">{santriPct}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">Hadir</p>
                    <p className="text-base font-black text-slate-800">{santriHadirCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">Izin</p>
                    <p className="text-base font-black text-amber-600">{santriIzinCount}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">WhatsApp:</span>
                    <span className="font-bold text-slate-800">{selectedSantri.nomorWhatsApp || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Email:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[180px]">{selectedSantri.email || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Alamat:</span>
                    <span className="font-bold text-slate-800">{selectedSantri.alamat || 'Bandung'}</span>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('kartu-peserta')}
                  className="w-full py-2.5 rounded-xl glass-btn-emerald text-white font-bold text-xs shadow-sm cursor-pointer"
                >
                  Lihat / Cetak Kartu QR
                </button>
              </div>

              {/* Santri Complete Attendance Log Table */}
              <div className="lg:col-span-8 bg-white rounded-[28px] p-6 border border-slate-200/70 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-extrabold text-sm text-slate-800">
                    Riwayat Seluruh Presensi: {selectedSantri.namaLengkap}
                  </h4>
                  <span className="text-xs font-bold text-emerald-700">
                    Total {absensiSelectedSantri.length} Sesi Terdata
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f2f7f4] text-slate-700 font-black border-b border-slate-200">
                      <tr>
                        <th className="p-3 pl-4">Tanggal</th>
                        <th className="p-3">Kegiatan</th>
                        <th className="p-3">Waktu Scan</th>
                        <th className="p-3">Musyrif</th>
                        <th className="p-3">Sumber</th>
                        <th className="p-3 pr-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {absensiSelectedSantri.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            Belum ada rekam jejak absensi untuk santri ini.
                          </td>
                        </tr>
                      ) : (
                        absensiSelectedSantri.map((a) => (
                          <tr key={a.absensiId} className="hover:bg-slate-50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-700">{a.tanggal}</td>
                            <td className="p-3 font-bold text-slate-800">{a.namaKegiatan}</td>
                            <td className="p-3 font-mono text-emerald-700 font-bold">
                              {a.waktuScan ? a.waktuScan.split('T')[1]?.slice(0, 8) : '-'} WIB
                            </td>
                            <td className="p-3 text-slate-600">{a.musyrifBertugas || '-'}</td>
                            <td className="p-3 text-[10px] text-slate-500">{a.sumberAbsensi}</td>
                            <td className="p-3 pr-4 text-right">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                  a.statusAbsensi === 'HADIR'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : a.statusAbsensi === 'IZIN'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {a.statusAbsensi}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL KOREKSI / EDIT STATUS ABSENSI ADMIN */}
      {editStatusModal.open && editStatusModal.peserta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-800">
                Koreksi Status Absensi (Admin)
              </h3>
              <button
                onClick={() => setEditStatusModal({ open: false, peserta: null, jadwal: null, tanggal: todayStr, currentStatus: 'ALPA' })}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveKoreksiStatus} className="space-y-4 pt-4 text-xs font-semibold">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-[11px]">Mahasantri:</p>
                <p className="text-slate-800 font-extrabold text-sm">
                  {editStatusModal.peserta.namaLengkap} ({editStatusModal.peserta.nim})
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Kegiatan: {editStatusModal.jadwal?.namaKegiatan} • Tanggal: {editStatusModal.tanggal}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Pilih Status Baru *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['HADIR', 'IZIN', 'ALPA'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditStatusModal({ ...editStatusModal, currentStatus: st })}
                      className={`py-2 rounded-xl font-bold border transition cursor-pointer text-center ${
                        editStatusModal.currentStatus === st
                          ? st === 'HADIR'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : st === 'IZIN'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-rose-600 text-white border-rose-600'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {st === 'ALPA' ? 'BELUM/ALPA' : st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Alasan Koreksi / Catatan *</label>
                <input
                  type="text"
                  required
                  value={alasanKoreksiInput}
                  onChange={(e) => setAlasanKoreksiInput(e.target.value)}
                  placeholder="Misal: Hadir terlambat karena piket / izin lisan ke ustadz"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditStatusModal({ open: false, peserta: null, jadwal: null, tanggal: todayStr, currentStatus: 'ALPA' })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  Simpan Perubahan Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Verifikasi Kedatangan Santri Kembali ke Asrama */}
      {verifikasiModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Verifikasi Kedatangan Santri</h3>
                  <p className="text-[11px] text-slate-500">Konfirmasi santri telah kembali ke asrama</p>
                </div>
              </div>
              <button
                onClick={() => setVerifikasiModal({ open: false, izin: null, peserta: null, kodeInput: '', catatan: '' })}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmVerifikasiKedatangan} className="space-y-3.5 text-xs">
              {verifikasiModal.peserta ? (
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 space-y-1">
                  <div className="font-black text-emerald-950 text-sm">
                    {verifikasiModal.peserta.namaLengkap}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-mono">
                    NIM: {verifikasiModal.peserta.nim} • {verifikasiModal.peserta.programStudi} ({verifikasiModal.peserta.batchId})
                  </div>
                  {verifikasiModal.izin && (
                    <div className="text-[10px] text-emerald-700 pt-1 border-t border-emerald-200/60 mt-1 space-y-0.5">
                      <div>Jenis: <span className="font-bold">{verifikasiModal.izin.jenisIzin.replace('_', ' ')}</span></div>
                      <div>Nomor Surat: <span className="font-bold font-mono">{verifikasiModal.izin.nomorSurat || '-'}</span></div>
                      <div>Kode Unik: <span className="font-bold font-mono">{verifikasiModal.izin.kodeVerifikasi || '-'}</span></div>
                      <div>Batas Kembali: <span className="font-bold text-rose-700">{verifikasiModal.izin.waktuSelesai.replace('T', ' ')} WIB</span></div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kode Unik Verifikasi Surat / NIM Santri *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: VRF-IZN-0001-K9X2 atau NIM..."
                    value={verifikasiModal.kodeInput}
                    onChange={(e) => setVerifikasiModal({ ...verifikasiModal, kodeInput: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Ketik kode unik dari surat izin resmi santri atau scan QR code yang tertera pada surat.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan / Kondisi Santri Saat Tiba
                </label>
                <input
                  type="text"
                  placeholder="Misal: Tiba tepat waktu, kondisi sehat walafiat"
                  value={verifikasiModal.catatan}
                  onChange={(e) => setVerifikasiModal({ ...verifikasiModal, catatan: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                <strong>Catatan Sistem:</strong> Setelah kedatangan diverifikasi, status santri akan <strong>kembali AKTIF</strong> dan santri <strong>tidak akan kena sanksi ALPA</strong> untuk kegiatan selanjutnya.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVerifikasiModal({ open: false, izin: null, peserta: null, kodeInput: '', catatan: '' })}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Konfirmasi Santri Telah Kembali</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
