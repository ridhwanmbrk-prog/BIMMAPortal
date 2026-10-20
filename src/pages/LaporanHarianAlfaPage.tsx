import { getBusinessDateString, getBusinessTimeMinutes } from '../utils/date';
import { isScheduleApplicableOnDate } from '../utils/schedule';
import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Bell,
  Clock,
  Send,
  UserCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  Filter,
  FileSpreadsheet,
  Plus,
  Share2,
  Phone,
} from 'lucide-react';
import { Peserta, JadwalKegiatan, Absensi, Izin, Pembenaran } from '../types';
import {
  getItems,
  setItems,
  getKegiatanSedangBerlangsung,
  getCurrentUser,
  addAuditLog,
  getActiveMusyrif,
} from '../storage';

export const LaporanHarianAlfaPage: React.FC = () => {
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalKegiatan[]>([]);
  const [absensiList, setAbsensiList] = useState<Absensi[]>([]);
  const [izinList, setIzinList] = useState<Izin[]>([]);

  const todayStr = getBusinessDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [reportClock, setReportClock] = useState<Date>(() => new Date());

  // Perbarui status laporan berkala agar otomatis aktif saat jendela scan dibuka.
  useEffect(() => {
    const timer = window.setInterval(() => setReportClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const jadwalUntukTanggal = jadwalList.filter((j) =>
    isScheduleApplicableOnDate(j, selectedDate)
  );
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState<string>('ALL');

  // Quick Action Modal (Ajukan Izin / Tandai Hadir Cepat)
  const [quickActionModal, setQuickActionModal] = useState<{
    open: boolean;
    santri: Peserta | null;
    action: 'IZIN' | 'HADIR';
  }>({ open: false, santri: null, action: 'IZIN' });
  const [alasanInput, setAlasanInput] = useState('');

  const currentUser = getCurrentUser();
  const activeMusyrif = getActiveMusyrif();

  const loadData = () => {
    const pList = getItems<Peserta>('PESERTA').filter((p) => p.statusPeserta === 'AKTIF');
    const jList = getItems<JadwalKegiatan>('JADWAL').filter((j) => j.statusAktif);
    const aList = getItems<Absensi>('ABSENSI');
    const iList = getItems<Izin>('IZIN');

    setPesertaList(pList);
    setJadwalList(jList);
    setAbsensiList(aList);
    setIzinList(iList);

    // Otomatis pilih kegiatan yang sedang berlangsung jika belum dipilih
    if (!selectedJadwalId && jList.length > 0) {
      const activeDetected = getKegiatanSedangBerlangsung(jList);
      if (activeDetected.kegiatan) {
        setSelectedJadwalId(activeDetected.kegiatan.jadwalId);
      } else {
        setSelectedJadwalId(jList[0].jadwalId);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (jadwalUntukTanggal.length === 0) {
      if (selectedJadwalId) setSelectedJadwalId('');
      return;
    }
    if (!jadwalUntukTanggal.some((j) => j.jadwalId === selectedJadwalId)) {
      setSelectedJadwalId(jadwalUntukTanggal[0].jadwalId);
    }
  }, [selectedDate, jadwalList, selectedJadwalId]);

  const selectedJadwal = jadwalUntukTanggal.find((j) => j.jadwalId === selectedJadwalId);

  // Laporan hanya berlaku jika jadwal wajib tersedia dan jendela scan sudah dibuka.
  const attendanceReportReady = (() => {
    if (!selectedJadwal || !selectedJadwal.wajib) return false;

    // Jadwal pada tanggal lampau tetap dapat dilihat sebagai laporan historis.
    if (selectedDate < todayStr) return true;
    if (selectedDate > todayStr) return false;

    const [startHour, startMinute] = selectedJadwal.jamMulai.split(':').map(Number);
    if (
      !Number.isInteger(startHour) || startHour < 0 || startHour > 23 ||
      !Number.isInteger(startMinute) || startMinute < 0 || startMinute > 59
    ) return false;

    const startAt = startHour * 60 + startMinute;
    const configuredTolerance = Number(selectedJadwal.toleransiBukaAwal);
    const openingTolerance = Number.isFinite(configuredTolerance)
      ? Math.max(0, configuredTolerance)
      : 15;
    const scanOpensAt = Math.max(0, startAt - openingTolerance);

    return getBusinessTimeMinutes(reportClock) >= scanOpensAt;
  })();

  // Tanggal lampau diperlakukan sebagai laporan historis yang sudah melewati tenggat.
  // Untuk hari ini, peserta baru diklasifikasikan Alfa mulai pukul 22.00 WIB.
  const alfaDeadlineReached =
    attendanceReportReady &&
    (
      selectedDate < todayStr ||
      (
        selectedDate === todayStr &&
        getBusinessTimeMinutes(reportClock) >= 22 * 60
      )
    );

  // Ambil data absensi dan izin untuk tanggal dan jadwal terpilih
  const absensiHariIni = attendanceReportReady
    ? absensiList.filter(
        (a) => a.tanggal === selectedDate && (
          a.jadwalId === selectedJadwalId ||
          (selectedJadwal && a.namaKegiatan.toLowerCase() === selectedJadwal.namaKegiatan.toLowerCase())
        )
      )
    : [];

  const hadirPesertaIds = new Set(
    absensiHariIni.filter((a) => a.statusAbsensi === 'HADIR').map((a) => a.pesertaId)
  );

  const izinPesertaIds = new Set(
    absensiHariIni.filter((a) => a.statusAbsensi === 'IZIN').map((a) => a.pesertaId)
  );

  // Izin yang mencakup rentang waktu tanggal ini
  const approvedIzinHariIni = izinList.filter((iz) => {
    if (iz.statusPersetujuan !== 'DISETUJUI') return false;
    // Jika batas waktu selesai izin telah lewat dan santri belum diverifikasi kembali, maka tidak exempt -> dianggap alpa
    const isPastDeadline = new Date() > new Date(iz.waktuSelesai) && iz.statusKedatangan !== 'SUDAH_KEMBALI';
    if (isPastDeadline) return false;

    const tglMulai = iz.waktuMulai.split('T')[0];
    const tglSelesai = iz.waktuSelesai.split('T')[0];
    return selectedDate >= tglMulai && selectedDate <= tglSelesai;
  });
  if (attendanceReportReady) {
    approvedIzinHariIni.forEach((iz) => izinPesertaIds.add(iz.pesertaId));
  }

  // Santri yang BELUM ABSEN (Tidak hadir dan tidak izin)
  const belumAbsenList = attendanceReportReady ? pesertaList.filter((p) => {
    const isHadir = hadirPesertaIds.has(p.pesertaId);
    const isIzin = izinPesertaIds.has(p.pesertaId);
    const matchBatch = filterBatch === 'ALL' || p.batchId === filterBatch;
    const matchQuery =
      p.namaLengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nim.includes(searchQuery);

    return !isHadir && !isIzin && matchBatch && matchQuery;
  }) : [];

  const totalSantri = attendanceReportReady ? pesertaList.length : 0;
  const totalHadir = hadirPesertaIds.size;
  const totalIzin = izinPesertaIds.size;
  const totalBelumHadir = belumAbsenList.length;

  const handleSendWhatsAppReminder = (santri: Peserta) => {
    if (!santri.nomorWhatsApp || !santri.nomorWhatsApp.trim()) {
      alert(`Nomor WhatsApp untuk santri ${santri.namaLengkap} (NIM: ${santri.nim}) belum terdaftar di database. Silakan lengkapi nomor WhatsApp pada data santri.`);
      return;
    }
    const cleanPhone = santri.nomorWhatsApp.replace(/\D/g, '').replace(/^0/, '62');
    const namaKeg = selectedJadwal?.namaKegiatan || 'Kegiatan Pesma';
    const namaMusyrif = activeMusyrif?.nama || (currentUser?.namaLengkap || 'Musyrif/ah Piket BIMMA');
    const panggilanMusyrif = activeMusyrif?.gender === 'AKHWAT' ? 'Musyrifah' : 'Musyrif';

    const msg = encodeURIComponent(
      `*PEMBERITAHUAN VERIFIKASI KEHADIRAN KEGIATAN BIMMA*\n` +
      `Universitas 'Aisyiyah (UNISA) Bandung\n\n` +
      `Kepada Yth Mahasantri:\n` +
      `• Nama: *${santri.namaLengkap}*\n` +
      `• NIM: *${santri.nim}*\n` +
      `• Program Studi: *${santri.programStudi}*\n\n` +
      `Anda *PERLU VERIFIKASI KEHADIRAN KEGIATAN* kepada ${panggilanMusyrif} yang bertugas.\n\n` +
      `📋 *Kegiatan Belum Absen:* ${namaKeg}\n` +
      `📅 *Tanggal:* ${selectedDate}\n\n` +
      `⏰ *TENGGAT WAKTU KONFIRMASI:* Diberi tenggat waktu sampai pukul *22:00 WIB (Jam 10 Malam)* hari ini untuk segera menemui musyrif piket atau konfirmasi verifikasi kehadiran.\n\n` +
      `Apabila melewati tenggat waktu tersebut tanpa verifikasi atau bukti izin resmi, status kehadiran Anda akan otomatis dinyatakan *ALPA (ALFA)*.\n\n` +
      `Wassalamu'alaikum Wr. Wb.\n` +
      `Salam,\n` +
      `*${panggilanMusyrif} ${namaMusyrif}*\n` +
      `_Piket BIMMA Pesantren Mahasiswa (PESMA) UNISA Bandung_`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  // Petugas mengajukan permohonan kehadiran telat untuk di-ACC oleh Admin
  const handleQuickSubmitTelat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickActionModal.santri || !selectedJadwal || !alasanInput.trim()) return;

    const santri = quickActionModal.santri;
    const pembenaranList = getItems<Pembenaran>('PEMBENARAN');
    const newId = `PB${String(pembenaranList.length + 1).padStart(4, '0')}`;

    const newRecord: Pembenaran = {
      pembenaranId: newId,
      pesertaId: santri.pesertaId,
      jadwalId: selectedJadwal.jadwalId,
      namaKegiatan: selectedJadwal.namaKegiatan,
      tanggalKejadian: selectedDate,
      alasan: alasanInput.trim(),
      diajukanOleh: currentUser?.id || 'U002',
      waktuPengajuan: new Date().toISOString(),
      statusPersetujuan: 'MENUNGGU',
      statusAbsensiSebelum: 'ALPA',
      statusAbsensiSesudah: 'HADIR',
    };

    const updated = [newRecord, ...pembenaranList];
    setItems('PEMBENARAN', updated);

    addAuditLog({
      penggunaId: currentUser?.id || 'U002',
      aksi: 'PENGAJUAN_TELAT_PETUGAS',
      jenisEntitas: 'PEMBENARAN',
      entitasId: newId,
      nilaiSesudah: `Pengajuan Telat: ${santri.namaLengkap} (${selectedJadwal.namaKegiatan})`,
      alasan: alasanInput,
      statusAksi: 'BERHASIL',
    });

    setQuickActionModal({ open: false, santri: null, action: 'HADIR' });
    setAlasanInput('');
    alert('Pengajuan kehadiran telat berhasil dikirim. Menunggu persetujuan (ACC) dari Admin.');
    loadData();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Selector: Tanggal & Jadwal Kegiatan Yang Sedang Berlangsung */}
      <div className="bg-white p-4.5 rounded-[24px] border border-slate-200/60 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Pilih Tanggal */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-700 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Pilih Kegiatan */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <Clock className="w-4 h-4 text-emerald-700" />
            <select
              value={selectedJadwalId}
              onChange={(e) => setSelectedJadwalId(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-700 focus:outline-none cursor-pointer"
            >
              {jadwalUntukTanggal.length === 0 && (
                <option value="">Tidak ada jadwal untuk tanggal ini</option>
              )}
              {jadwalUntukTanggal.map((j) => (
                <option key={j.jadwalId} value={j.jadwalId}>
                  {j.namaKegiatan} ({j.jamMulai} - {j.jamSelesai} WIB)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Batch & Search */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial min-w-[130px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama santri..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Batch</option>
            <option value="Batch 1">Batch 1</option>
            <option value="Batch 2">Batch 2</option>
            <option value="Batch 3">Batch 3</option>
          </select>
        </div>
      </div>

      {/* 4 Summary Stat Mini Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3.5">
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400">Total Santri</p>
          <p className="text-lg sm:text-xl font-black text-slate-800 mt-0.5">{totalSantri}</p>
          <span className="text-[9px] sm:text-[10px] text-slate-400">Wajib Hadir</span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold text-emerald-600">Sudah Hadir (Scan)</p>
          <p className="text-lg sm:text-xl font-black text-emerald-700 mt-0.5">{totalHadir}</p>
          <span className="text-[9px] sm:text-[10px] text-emerald-600 font-bold">
            {totalSantri > 0 ? `${Math.round((totalHadir / totalSantri) * 100)}%` : '0%'} Selesai
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-xs">
          <p className="text-[10px] sm:text-[11px] font-bold text-amber-600">Izin Disetujui</p>
          <p className="text-lg sm:text-xl font-black text-amber-700 mt-0.5">{totalIzin}</p>
          <span className="text-[9px] sm:text-[10px] text-amber-600">Dispensasi</span>
        </div>

        <div className="bg-rose-50/70 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-200 shadow-xs">
          <p className={`text-[10px] sm:text-[11px] font-bold ${alfaDeadlineReached ? 'text-rose-700' : 'text-amber-700'}`}>
            {alfaDeadlineReached ? 'Belum Hadir (Alfa)' : 'Belum Absen (Verifikasi)'}
          </p>
          <p className={`text-lg sm:text-xl font-black mt-0.5 ${alfaDeadlineReached ? 'text-rose-700' : 'text-amber-700'}`}>
            {totalBelumHadir}
          </p>
          <span className={`text-[9px] sm:text-[10px] font-bold ${alfaDeadlineReached ? 'text-rose-600' : 'text-amber-600'}`}>
            {alfaDeadlineReached ? 'Tenggat verifikasi terlewati' : 'Tenggat verifikasi 22.00 WIB'}
          </span>
        </div>
      </div>

      {/* Tabel Santri Yang Belum Absen */}
      <div className="bg-white rounded-[22px] sm:rounded-[26px] shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">
              Daftar Santri Belum Hadir — {selectedJadwal?.namaKegiatan || 'Belum Ada Jadwal'}
            </h3>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border ${
              alfaDeadlineReached
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}>
              {belumAbsenList.length} {alfaDeadlineReached ? 'Santri Alfa' : 'Belum Absen'}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold font-mono hidden sm:inline">
              ({selectedDate})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-2.5 sm:p-3.5 pl-3 sm:pl-5 text-[11px] sm:text-xs">NIM</th>
                <th className="p-2.5 sm:p-3.5 text-[11px] sm:text-xs">Nama Lengkap Santri</th>
                <th className="p-2.5 sm:p-3.5 text-[11px] sm:text-xs">Program Studi</th>
                <th className="p-2.5 sm:p-3.5 text-[11px] sm:text-xs">Batch</th>
                <th className="p-2.5 sm:p-3.5 text-[11px] sm:text-xs">Status Presensi</th>
                <th className="p-2.5 sm:p-3.5 pr-3 sm:pr-5 text-right text-[11px] sm:text-xs">Tindakan Cepat Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {!selectedJadwal ? (
                <tr>
                  <td colSpan={6} className="p-6 sm:p-10 text-center text-slate-600">
                    <Calendar className="w-8 h-8 mx-auto mb-1.5 text-slate-400" />
                    <p className="font-extrabold text-xs sm:text-sm">Belum Ada Jadwal Presensi</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                      Tidak ada jadwal kegiatan aktif untuk tanggal {selectedDate}.
                      Laporan akan tersedia setelah jadwal yang berlaku dipilih.
                    </p>
                  </td>
                </tr>
              ) : !attendanceReportReady ? (
                <tr>
                  <td colSpan={6} className="p-6 sm:p-10 text-center text-slate-600">
                    <Clock className="w-8 h-8 mx-auto mb-1.5 text-slate-400" />
                    <p className="font-extrabold text-xs sm:text-sm">Pengabsenan Belum Dimulai</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                      Daftar belum hadir akan aktif saat jendela scan dibuka untuk {selectedJadwal.namaKegiatan}.
                    </p>
                  </td>
                </tr>
              ) : belumAbsenList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 sm:p-10 text-center text-emerald-700">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-500" />
                    <p className="font-extrabold text-xs sm:text-sm">Alhamdulillah, Semua Santri Telah Hadir / Terdata!</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                      Tidak ada santri yang alpa pada kegiatan ini ({selectedDate}).
                    </p>
                  </td>
                </tr>
              ) : (
                belumAbsenList.map((s) => (
                  <tr
                    key={s.pesertaId}
                    className={`transition ${
                      alfaDeadlineReached ? 'hover:bg-rose-50/30' : 'hover:bg-amber-50/30'
                    }`}
                  >
                    <td className="p-2.5 sm:p-3.5 pl-3 sm:pl-5 font-mono font-bold text-slate-600 text-[11px] sm:text-xs">{s.nim}</td>
                    <td className="p-2.5 sm:p-3.5 font-bold text-slate-800 text-[11px] sm:text-xs">{s.namaLengkap}</td>
                    <td className="p-2.5 sm:p-3.5 text-slate-600 text-[10px] sm:text-xs">{s.programStudi}</td>
                    <td className="p-2.5 sm:p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[9px] sm:text-[10px]">
                        {s.batchId}
                      </span>
                    </td>
                    <td className="p-2.5 sm:p-3.5">
                      <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full font-black text-[9px] sm:text-[10px] inline-flex items-center gap-1 ${
                        alfaDeadlineReached
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        <AlertCircle className="w-3 h-3" />
                        <span>{alfaDeadlineReached ? 'ALFA' : 'MENUNGGU VERIFIKASI'}</span>
                      </span>
                    </td>
                    <td className="p-2.5 sm:p-3.5 pr-3 sm:pr-5 text-right space-x-1 sm:space-x-1.5 whitespace-nowrap">
                      {/* Tombol Ajukan Kehadiran Telat Kegiatan (Di-ACC Admin) */}
                      <button
                        onClick={() => {
                          setQuickActionModal({ open: true, santri: s, action: 'HADIR' });
                          setAlasanInput('Terlambat hadir di lokasi kegiatan karena ada kendala');
                        }}
                        title="Ajukan Kehadiran Telat (Menunggu ACC Admin)"
                        className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold text-[10px] sm:text-xs transition inline-flex items-center gap-1 cursor-pointer border border-teal-200"
                      >
                        <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Ajukan Telat</span>
                        <span className="sm:hidden">Telat</span>
                      </button>

                      {/* Tombol Kirim WhatsApp */}
                      <button
                        onClick={() => handleSendWhatsAppReminder(s)}
                        title="Kirim Broadcast WhatsApp Pengingat & Tenggat Jam 10 Malam"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] sm:text-xs transition inline-flex items-center gap-1 cursor-pointer border border-emerald-200"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim WA</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Pengajuan Kehadiran Telat - Di-ACC oleh Admin */}
      {quickActionModal.open && quickActionModal.santri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-800">
                Pengajuan Kehadiran Telat Santri (ACC Admin)
              </h3>
              <button
                onClick={() => setQuickActionModal({ open: false, santri: null, action: 'HADIR' })}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleQuickSubmitTelat}
              className="space-y-4 text-xs font-semibold"
            >
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-[11px]">Mahasantri:</p>
                <p className="text-slate-800 font-extrabold text-sm">
                  {quickActionModal.santri.namaLengkap} ({quickActionModal.santri.nim})
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Prodi: {quickActionModal.santri.programStudi} • Kegiatan: <span className="font-bold text-slate-700">{selectedJadwal?.namaKegiatan}</span>
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ℹ️ <b>Pemberitahuan Petugas:</b> Permohonan kehadiran telat akan otomatis dikirimkan ke Admin untuk disetujui (ACC). Jika di-ACC, status kehadiran santri otomatis menjadi Hadir.
              </div>

              <div>
                <label className="block text-slate-700 mb-1">
                  Alasan / Keterangan Keterlambatan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={alasanInput}
                  onChange={(e) => setAlasanInput(e.target.value)}
                  placeholder="Tulis alasan kenapa santri telat hadir di kegiatan..."
                  className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickActionModal({ open: false, santri: null, action: 'HADIR' })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  Kirim Pengajuan Telat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
