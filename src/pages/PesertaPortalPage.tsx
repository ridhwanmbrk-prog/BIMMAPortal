import { getBusinessDateString } from '../utils/date';
import { isScheduleApplicableOnDate } from '../utils/schedule';
import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  CreditCard,
  FileText,
  FileCheck2,
  Download,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  QrCode,
  Shield,
  Layers,
  X,
  Check,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Peserta, JadwalKegiatan, Absensi, Izin, Batch, JenisIzin } from '../types';
import {
  getItems,
  getCurrentUser,
  updateProfilMahasiswa,
  setItems,
  addAuditLog,
} from '../storage';
import { generateSuratIzinPdf } from '../utils/suratIzinPdf';

export const PesertaPortalPage: React.FC = () => {
  const currentUser = getCurrentUser();

  const [peserta, setPeserta] = useState<Peserta | null>(null);
  const [jadwalList, setJadwalList] = useState<JadwalKegiatan[]>([]);
  const [absensiList, setAbsensiList] = useState<Absensi[]>([]);
  const [izinList, setIzinList] = useState<Izin[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // QR Code Data URL & Modal State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showCardModal, setShowCardModal] = useState<boolean>(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);

  // Form Biodata Fields
  const [email, setEmail] = useState('');
  const [nomorWhatsApp, setNomorWhatsApp] = useState('');
  const [alamat, setAlamat] = useState('');
  const [biodataSuccess, setBiodataSuccess] = useState<string | null>(null);

  // Form Izin Mandiri Fields
  const [jenisIzin, setJenisIzin] = useState<JenisIzin>('IZIN_PULANG');
  const [tglMulai, setTglMulai] = useState(getBusinessDateString() + 'T08:00');
  const [tglSelesai, setTglSelesai] = useState(getBusinessDateString() + 'T21:00');
  const [alasanIzin, setAlasanIzin] = useState('');
  const [izinSuccess, setIzinSuccess] = useState<string | null>(null);

  const todayStr = getBusinessDateString();

  const loadData = () => {
    const pList = getItems<Peserta>('PESERTA');
    const jList = getItems<JadwalKegiatan>('JADWAL').filter((j) => j.statusAktif);
    const aList = getItems<Absensi>('ABSENSI');
    const iList = getItems<Izin>('IZIN');
    const bList = getItems<Batch>('BATCH');

    setJadwalList(jList);
    setAbsensiList(aList);
    setIzinList(iList);
    setBatches(bList);

    // Cari data peserta yang sedang login
    const target = pList.find(
      (p) =>
        (currentUser?.pesertaId && p.pesertaId === currentUser.pesertaId) ||
        (currentUser?.nim && p.nim === currentUser.nim) ||
        (currentUser?.username && p.nim === currentUser.username)
    ) || pList[0];

    if (target) {
      setPeserta(target);
      setEmail(target.email || '');
      setNomorWhatsApp(target.nomorWhatsApp || '');
      setAlamat(target.alamat || '');

      // Generate QR Code untuk Kartu Santri
      // Format QR seragam dengan kartu cetak: ID peserta-NIM.
      QRCode.toDataURL(`${target.pesertaId}-${target.nim}`, {
        margin: 1,
        width: 320,
        color: { dark: '#064e3b', light: '#ffffff' },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((e) => console.error(e));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!peserta) {
    return (
      <div className="bg-white rounded-[28px] p-6 sm:p-8 text-center border border-emerald-100 shadow-sm max-w-lg mx-auto my-8 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto font-black text-xl">
          BM
        </div>
        <h3 className="text-base font-black text-slate-800">
          Data Mahasantri Belum Tersedia
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Akun mahasantri belum terdaftar di database. Silakan isi Formulir Biodata Santri Mandiri atau hubungi Admin Pesma UNISA.
        </p>
      </div>
    );
  }

  // Rekap kehadiran khusus santri ini
  const myAbsensi = absensiList.filter((a) => a.pesertaId === peserta.pesertaId);
  const myHadir = myAbsensi.filter((a) => a.statusAbsensi === 'HADIR').length;
  const myIzin = myAbsensi.filter((a) => a.statusAbsensi === 'IZIN').length;
  const myAlpa = myAbsensi.filter((a) => a.statusAbsensi === 'ALPA').length;

  const totalSesi = myHadir + myIzin + myAlpa;
  const persentaseKehadiran = totalSesi > 0 && myHadir > 0 ? Math.round((myHadir / totalSesi) * 100) : 0;

  // Izin yang diajukan oleh santri ini
  const myIzinList = izinList.filter((i) => i.pesertaId === peserta.pesertaId);

  // Status kegiatan hari ini (Kegiatan Pagi, Kegiatan Malam, dll.)
  const statusKegiatanHariIni = jadwalList
    .filter((j) => isScheduleApplicableOnDate(j, todayStr))
    .map((j) => {
    const record = absensiList.find(
      (a) =>
        a.tanggal === todayStr &&
        a.pesertaId === peserta.pesertaId &&
        (a.jadwalId === j.jadwalId || a.namaKegiatan.toLowerCase() === j.namaKegiatan.toLowerCase())
    );

    const isIzinActive = myIzinList.some((iz) => {
      if (iz.statusPersetujuan !== 'DISETUJUI') return false;
      // Izin yang sudah diverifikasi kembali (tepat waktu maupun terlambat)
      // tidak lagi membebaskan peserta dari presensi kegiatan berikutnya.
      if (iz.statusKedatangan === 'SUDAH_KEMBALI' || iz.statusKedatangan === 'TERLAMBAT') return false;
      const t1 = iz.waktuMulai.split('T')[0];
      const t2 = iz.waktuSelesai.split('T')[0];
      return todayStr >= t1 && todayStr <= t2;
    });

    return {
      jadwal: j,
      record,
      status: record
        ? record.statusAbsensi
        : isIzinActive
        ? 'IZIN'
        : 'BELUM_ABSEN',
    };
  });

  const handleSaveBiodata = async (e: React.FormEvent) => {
    e.preventDefault();
    setBiodataSuccess(null);
    const res = await updateProfilMahasiswa(peserta.nim, { email, nomorWhatsApp, alamat });
    if (res.success && res.peserta) {
      setPeserta(res.peserta);
      setBiodataSuccess('Biodata pribadi Anda berhasil disimpan langsung ke Cloudflare D1.');
      setTimeout(() => setBiodataSuccess(null), 4000);
    } else {
      setBiodataSuccess(res.message);
    }
  };

  const handleSubmitIzin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasanIzin.trim()) return;

    const newId = `IZ${String(izinList.length + 1).padStart(4, '0')}`;
    const newIzin: Izin = {
      izinId: newId,
      pesertaId: peserta.pesertaId,
      jenisIzin,
      waktuMulai: tglMulai,
      waktuSelesai: tglSelesai,
      alasan: alasanIzin.trim(),
      diajukanOleh: currentUser?.id || `USER_${peserta.pesertaId}`,
      waktuPengajuan: new Date().toISOString(),
      statusPersetujuan: 'MENUNGGU',
    };

    const updated = [newIzin, ...izinList];
    setItems('IZIN', updated);
    setIzinList(updated);

    addAuditLog({
      penggunaId: currentUser?.id || `USER_${peserta.pesertaId}`,
      aksi: 'AJUKAN_IZIN_MANDIRI_SANTRI',
      jenisEntitas: 'IZIN',
      entitasId: newId,
      nilaiSesudah: `${jenisIzin} - ${peserta.namaLengkap}`,
      alasan: alasanIzin,
      statusAksi: 'BERHASIL',
    });

    setAlasanIzin('');
    setIzinSuccess('Pengajuan izin berhasil dikirimkan ke Admin dan Musyrif untuk diverifikasi (ACC)!');
    setTimeout(() => setIzinSuccess(null), 4000);
  };


  // Render dan unduh kartu portrait memakai kop kartu resmi.
  const handleDownloadCardImage = async () => {
    if (!qrCodeUrl || !peserta) return;

    setIsDownloadingImage(true);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
        image.src = src;
      });

    try {
      const [kopImg, qrImg] = await Promise.all([
        loadImage('/images/KOP-KARTU-BIMMA.jpg'),
        loadImage(qrCodeUrl),
      ]);

      // Portrait 54 x 85 mm pada resolusi 10 px/mm.
      const canvas = document.createElement('canvas');
      canvas.width = 540;
      canvas.height = 850;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak dapat digunakan.');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Kop memakai rasio asli gambar agar tidak terdistorsi.
      const kopHeight = Math.round(
        (kopImg.naturalHeight / kopImg.naturalWidth) * canvas.width
      );
      ctx.drawImage(kopImg, 0, 0, canvas.width, kopHeight);

      // Bingkai kartu.
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('KARTU TANDA PESERTA BIMMA', 270, 231, 480);

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(
        `STATUS: AKTIF • ${String(peserta.batchId || '').toUpperCase()}`,
        270,
        255,
        480
      );

      ctx.fillStyle = '#64748b';
      ctx.font = '15px sans-serif';
      ctx.fillText('NAMA MAHASANTRI', 270, 290);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 27px sans-serif';
      ctx.fillText(peserta.namaLengkap || '-', 270, 322, 480);

      ctx.fillStyle = '#64748b';
      ctx.font = '15px sans-serif';
      ctx.fillText('NOMOR INDUK MAHASISWA (NIM)', 270, 357);

      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(peserta.nim || '-', 270, 388, 480);

      ctx.fillStyle = '#64748b';
      ctx.font = '15px sans-serif';
      ctx.fillText('PROGRAM STUDI', 270, 423);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 21px sans-serif';
      ctx.fillText(peserta.programStudi || '-', 270, 454, 480);

      ctx.fillStyle = '#64748b';
      ctx.font = '15px sans-serif';
      ctx.fillText('KONTAK / WHATSAPP', 270, 489);

      ctx.fillStyle = '#0f172a';
      ctx.font = '19px sans-serif';
      ctx.fillText(peserta.nomorWhatsApp || '-', 270, 520, 480);

      // QR presensi.
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(185, 546, 170, 170);
      ctx.drawImage(qrImg, 200, 561, 140, 140);

      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('KODE PRESENSI RESMI', 270, 738);

      ctx.font = 'bold 18px monospace';
      ctx.fillText(peserta.nim || '-', 270, 764, 480);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        'Pindai QR saat presensi bersama petugas.',
        270,
        808,
        480
      );

      const imageUri = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download =
        `Kartu_Peserta_${peserta.nim}_${peserta.namaLengkap.replace(/\s+/g, '_')}.png`;
      downloadLink.href = imageUri;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (error) {
      console.error('[BIMMA_CARD_IMAGE]', error);
      window.alert('Gagal membuat gambar kartu peserta. Silakan coba lagi.');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const myApprovedIzin = izinList.find(
    (iz) =>
      iz.pesertaId === peserta.pesertaId &&
      iz.statusPersetujuan === 'DISETUJUI' &&
      iz.statusKedatangan !== 'SUDAH_KEMBALI' &&
      iz.statusKedatangan !== 'TERLAMBAT'
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* NOTIFIKASI SURAT RESMI BUKTI KEDATANGAN (JIKA IZIN SUDAH DI-ACC) */}
      {myApprovedIzin && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border-2 border-emerald-400 rounded-[28px] p-5 shadow-sm space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-emerald-950">
                    Surat Izin Resmi Anda Telah Disetujui!
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-black uppercase">
                    Status: IZIN
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Surat izin resmi dan kode QR unik kedatangan telah diterbitkan oleh pengurus BIMMA.
                </p>
              </div>
            </div>

            <button
              onClick={() => generateSuratIzinPdf(myApprovedIzin, peserta, 'Pengurus BIMMA UNISA')}
              className="px-4 py-2 rounded-xl glass-btn-emerald text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md self-start sm:self-auto shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF Surat Izin</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white/70 p-3.5 rounded-2xl border border-emerald-200/60">
            <div>
              <p className="text-[10px] text-slate-500 font-bold">Jenis Izin:</p>
              <p className="font-black text-slate-800">{myApprovedIzin.jenisIzin.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold">Nomor Surat:</p>
              <p className="font-mono font-bold text-emerald-800">{myApprovedIzin.nomorSurat || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold">Batas Waktu Kedatangan Kembali:</p>
              <p className="font-bold text-rose-700">{myApprovedIzin.waktuSelesai.replace('T', ' ')} WIB</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-emerald-900 bg-emerald-100/60 p-3 rounded-xl border border-emerald-200">
            <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Penting:</strong> Tunjukkan dokumen surat ini (PDF atau kode QR unik <strong>{myApprovedIzin.kodeVerifikasi}</strong>) kepada Musyrif piket saat tiba kembali di asrama agar status kehadiran Anda <strong>kembali AKTIF</strong> dan tidak terkena sanksi alpa.
            </span>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* 1. HEADER PROFIL MAHASANTRI & QUICK STATS BANNER                          */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-[30px] p-6 lg:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl text-white shadow-inner border border-white/20 shrink-0">
              {peserta.namaLengkap.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-200 border border-white/10 uppercase tracking-wider">
                  Mahasantri BIMMA
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {peserta.batchId}
                </span>
              </div>
              <h1 className="text-xl lg:text-2xl font-black text-white mt-1">
                {peserta.namaLengkap}
              </h1>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                NIM: <span className="font-mono font-bold text-white">{peserta.nim}</span> • Prodi: {peserta.programStudi} • Status: <span className="font-bold text-emerald-300">{peserta.statusPeserta}</span>
              </p>
            </div>
          </div>

          {/* CTA UTAMA: TAMPILKAN KARTU QR SAYA */}
          <button
            onClick={() => setShowCardModal(true)}
            className="px-5 py-3 rounded-full bg-white text-emerald-900 font-extrabold text-xs flex items-center gap-2 hover:bg-emerald-50 transition cursor-pointer shadow-lg hover:scale-103 active:scale-98 shrink-0"
          >
            <QrCode className="w-4 h-4 text-emerald-700" />
            <span>Tampilkan Kartu QR Saya</span>
          </button>
        </div>

        {/* Mini stats ribbon responsive untuk mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-white/15 text-center text-xs">
          <div className="bg-white/10 sm:bg-transparent rounded-2xl p-2.5 sm:p-0">
            <p className="text-[10px] text-emerald-200 font-medium">Kehadiran Saya</p>
            <p className="text-lg sm:text-xl font-black text-white">{persentaseKehadiran}%</p>
          </div>
          <div className="bg-white/10 sm:bg-transparent rounded-2xl p-2.5 sm:p-0">
            <p className="text-[10px] text-emerald-200 font-medium">Total Hadir</p>
            <p className="text-lg sm:text-xl font-black text-emerald-200">{myHadir} Sesi</p>
          </div>
          <div className="bg-white/10 sm:bg-transparent rounded-2xl p-2.5 sm:p-0">
            <p className="text-[10px] text-emerald-200 font-medium">Izin Sah</p>
            <p className="text-lg sm:text-xl font-black text-amber-200">{myIzin} Kali</p>
          </div>
          <div className="bg-white/10 sm:bg-transparent rounded-2xl p-2.5 sm:p-0">
            <p className="text-[10px] text-emerald-200 font-medium">Alpa / Belum</p>
            <p className="text-lg sm:text-xl font-black text-rose-200">{myAlpa}</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATUS KEHADIRAN KEGIATAN HARI INI (SUDAH ABSEN ATAU BELUM)           */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 lg:p-6 rounded-[28px] border border-slate-200/70 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Status Kehadiran Kegiatan Hari Ini ({todayStr})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cek secara langsung apakah presensi Anda sudah tercatat oleh petugas pada setiap sesi kegiatan hari ini.
            </p>
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            Realtime Sesi
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statusKegiatanHariIni.map((item) => {
            const j = item.jadwal;
            const isHadir = item.status === 'HADIR';
            const isIzin = item.status === 'IZIN';
            const isBelum = item.status === 'BELUM_ABSEN' || item.status === 'ALPA';

            return (
              <div
                key={j.jadwalId}
                className={`rounded-[24px] p-5 border transition-all ${
                  isHadir
                    ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                    : isIzin
                    ? 'bg-blue-50/70 border-blue-300 shadow-sm'
                    : 'bg-rose-50/40 border-rose-200 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800">
                      {j.namaKegiatan}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{j.jamMulai} - {j.jamSelesai} WIB</span>
                    </p>
                  </div>

                  {/* BADGE STATUS YANG SANGAT JELAS */}
                  {isHadir ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs inline-flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SUDAH ABSEN</span>
                    </span>
                  ) : isIzin ? (
                    <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs inline-flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>IZIN RESMI</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-rose-600 text-white font-black text-xs inline-flex items-center gap-1 animate-pulse shadow-xs">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>BELUM ABSEN</span>
                    </span>
                  )}
                </div>

                <div className="pt-3 text-xs space-y-2">
                  {isHadir && item.record && (
                    <div className="space-y-1 text-emerald-900">
                      <p className="font-bold flex items-center justify-between">
                        <span>Waktu Scan Masuk:</span>
                        <span className="font-mono font-black text-emerald-800">
                          {item.record.waktuScan ? item.record.waktuScan.split('T')[1]?.slice(0, 8) : '-'} WIB
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>Musyrif Validator:</span>
                        <span className="font-semibold text-slate-800">
                          {item.record.musyrifBertugas || 'Musyrif Piket'}
                        </span>
                      </p>
                      <p className="text-[10px] text-emerald-800 font-bold bg-emerald-100/70 p-2 rounded-xl mt-1">
                        ✓ Presensi Anda sah dan telah tersimpan di server database UNISA.
                      </p>
                    </div>
                  )}

                  {isBelum && (
                    <div className="space-y-2 text-rose-900">
                      <p className="text-[11px] font-semibold text-rose-700">
                        ⚠️ Anda belum melakukan scan presensi untuk kegiatan ini!
                      </p>
                      <button
                        onClick={() => setShowCardModal(true)}
                        className="w-full py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-300 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Tunjukkan Kartu QR ke Musyrif Sekarang</span>
                      </button>
                    </div>
                  )}

                  {isIzin && (
                    <div className="p-2.5 rounded-xl bg-blue-100/80 text-blue-900 text-xs font-semibold">
                      Dispensasi izin Anda untuk kegiatan ini telah disetujui pengurus asrama.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. RIWAYAT DAFTAR HADIR SAYA (TABLE)                                      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-[28px] p-5 lg:p-6 border border-slate-200/70 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-800">
              Riwayat Daftar Hadir Saya
            </h2>
            <p className="text-xs text-slate-500">
              Seluruh catatan presensi kegiatan yang telah Anda ikuti di BIMMA Pesma UNISA.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 font-mono">
            {myAbsensi.length} Catatan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4">Tanggal</th>
                <th className="p-3">Nama Kegiatan</th>
                <th className="p-3">Waktu Scan</th>
                <th className="p-3">Musyrif Validator</th>
                <th className="p-3 pr-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {myAbsensi.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Belum ada riwayat kehadiran tercatat.
                  </td>
                </tr>
              ) : (
                myAbsensi.map((a) => (
                  <tr key={a.absensiId} className="hover:bg-slate-50">
                    <td className="p-3 pl-4 font-mono font-bold text-slate-700">{a.tanggal}</td>
                    <td className="p-3 font-bold text-slate-800">{a.namaKegiatan}</td>
                    <td className="p-3 font-mono text-emerald-700 font-bold">
                      {a.waktuScan ? a.waktuScan.split('T')[1]?.slice(0, 8) : '-'} WIB
                    </td>
                    <td className="p-3 text-slate-600">{a.musyrifBertugas || '-'}</td>
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

      {/* ========================================================================= */}
      {/* 4. FORM BIODATA MAHASANTRI MANDIRI (SINKRON KE ADMIN)                     */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200/70 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-800">
            Formulir Biodata Diri Mahasantri
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Perbarui data diri Anda di bawah ini. Data tersimpan di server dan otomatis sinkron ke dashboard Admin.
          </p>
        </div>

        {biodataSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{biodataSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveBiodata} className="space-y-4 text-xs font-semibold">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <p className="text-[10px] text-slate-400">NIM Mahasiswa:</p>
              <p className="font-mono font-bold text-slate-800">{peserta.nim}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Nama Lengkap:</p>
              <p className="font-bold text-slate-800 truncate">{peserta.namaLengkap}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Program Studi:</p>
              <p className="font-bold text-slate-800">{peserta.programStudi}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Batch:</p>
              <p className="font-bold text-emerald-700">{peserta.batchId}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                <span>Alamat Email Aktif *</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@unisa.ac.id"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nomor WhatsApp Aktif / Wali *</span>
              </label>
              <input
                type="tel"
                required
                value={nomorWhatsApp}
                onChange={(e) => setNomorWhatsApp(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Alamat Asal / Tempat Tinggal *</span>
            </label>
            <textarea
              required
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Alamat asal tempat tinggal santri..."
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-2xl glass-btn-emerald text-white font-bold text-xs shadow-md cursor-pointer transition hover:scale-[1.01]"
          >
            Simpan Perubahan Biodata
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 5. FORMULIR PENGAJUAN IZIN MANDIRI                                       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200/70 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-800">
            Pengajuan Izin Mandiri (Dispensasi Sakit / Syar'i)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Jika berhalangan hadir pada kegiatan asrama, ajukan permohonan dispensasi di sini untuk diverifikasi oleh pengurus.
          </p>
        </div>

        {izinSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{izinSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmitIzin} className="space-y-3.5 text-xs font-semibold">
          <div>
            <label className="block text-slate-700 mb-1">Kategori Izin *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['IZIN_PULANG', 'SAKIT', 'KEPERLUAN_SYARI', 'IZIN_KHUSUS'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setJenisIzin(k)}
                  className={`py-2 px-2 rounded-xl font-bold border transition cursor-pointer text-center text-xs ${
                    jenisIzin === k
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-400/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {k === 'IZIN_PULANG'
                    ? 'Izin Pulang'
                    : k === 'SAKIT'
                    ? 'Sakit'
                    : k === 'KEPERLUAN_SYARI'
                    ? 'Syar\'i'
                    : 'Khusus'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 mb-1">Waktu Mulai *</label>
              <input
                type="datetime-local"
                required
                value={tglMulai}
                onChange={(e) => setTglMulai(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 mb-1">Waktu Selesai *</label>
              <input
                type="datetime-local"
                required
                value={tglSelesai}
                onChange={(e) => setTglSelesai(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 mb-1">Alasan Lengkap Izin *</label>
            <textarea
              required
              rows={2}
              value={alasanIzin}
              onChange={(e) => setAlasanIzin(e.target.value)}
              placeholder="Misal: Sakit demam dan beristirahat di asrama..."
              className="w-full p-3 rounded-xl border border-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-2xl glass-btn-emerald text-white font-bold text-xs shadow-md cursor-pointer transition hover:scale-[1.01]"
          >
            Kirim Permohonan Izin ke Pengurus
          </button>
        </form>

        {/* Riwayat Pengajuan Izin */}
        {myIzinList.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h4 className="font-extrabold text-xs text-slate-700">Status Permohonan Izin & Surat Resmi Bukti Kedatangan:</h4>
            {myIzinList.map((iz) => {
              const deadline = new Date(iz.waktuSelesai);
              const isOverdue = iz.statusPersetujuan === 'DISETUJUI' && iz.statusKedatangan !== 'SUDAH_KEMBALI' && iz.statusKedatangan !== 'TERLAMBAT' && new Date() > deadline;

              return (
                <div
                  key={iz.izinId}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-800 uppercase">{iz.jenisIzin.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-500 font-mono">#{iz.izinId}</span>
                      {iz.nomorSurat && (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {iz.nomorSurat}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">{iz.alasan}</p>
                    <div className="text-[10px] text-slate-500">
                      <span>Rentang: {iz.waktuMulai.replace('T', ' ')} s.d. {iz.waktuSelesai.replace('T', ' ')} WIB</span>
                    </div>

                    {iz.kodeVerifikasi && (
                      <div className="text-[10px] font-mono font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded w-max">
                        Kode Unik Verifikasi: {iz.kodeVerifikasi}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                    <div className="flex flex-col items-start sm:items-end gap-1">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          iz.statusPersetujuan === 'DISETUJUI'
                            ? 'bg-emerald-100 text-emerald-800'
                            : iz.statusPersetujuan === 'DITOLAK'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {iz.statusPersetujuan}
                      </span>

                      {iz.statusPersetujuan === 'DISETUJUI' && (
                        <div>
                          {iz.statusKedatangan === 'SUDAH_KEMBALI' || iz.statusKedatangan === 'TERLAMBAT' ? (
                            <span className={`px-2 py-0.5 rounded-full text-white text-[9px] font-black flex items-center gap-1 ${iz.statusKedatangan === 'TERLAMBAT' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                              <Check className="w-2.5 h-2.5" />
                              <span>{iz.statusKedatangan === 'TERLAMBAT' ? 'TELAH KEMBALI TERLAMBAT' : 'TELAH KEMBALI'}</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse">
                              MELEWATI TENGGAT (ALPA)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold">
                              SEDANG DI LUAR ASRAMA
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {iz.statusPersetujuan === 'DISETUJUI' && (
                      <button
                        type="button"
                        onClick={() => generateSuratIzinPdf(iz, peserta)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Surat PDF</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. DEDICATED MODAL: TAMPILKAN KARTU QR SAYA & DOWNLOAD GAMBAR KARTU       */}
      {/* ========================================================================= */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative text-center space-y-5">
            {/* Close Button */}
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition cursor-pointer"
            >
              ✕
            </button>

            <div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Kartu Tanda Peserta Resmi
              </span>
              <h3 className="text-lg font-black text-slate-800 mt-1">
                Kartu Mahasantri BIMMA UNISA
              </h3>
              <p className="text-xs text-slate-500">
                Tunjukkan QR Code ini pada kamera petugas musyrif piket saat memasuki kegiatan.
              </p>
            </div>

            {/* VISUAL KARTU MAHASANTRI: KOP RESMI, ORIENTASI PORTRAIT */}
            <div className="mx-auto flex aspect-[54/85] w-full max-w-[270px] flex-col overflow-hidden rounded-2xl border-2 border-emerald-900 bg-white text-left text-slate-900 shadow-xl">
              <img
                src="/images/KOP-KARTU-BIMMA.jpg"
                alt="Kop resmi kartu peserta BIMMA"
                className="block h-auto w-full shrink-0"
              />

              <div className="flex items-center justify-between gap-2 px-3 pt-2">
                <span className="max-w-[60%] truncate rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-900">
                  {peserta.batchId || '-'}
                </span>
                <span className="rounded-md bg-emerald-700 px-2 py-1 text-[9px] font-black text-white">
                  AKTIF
                </span>
              </div>

              <p className="px-2 pt-1 text-center text-[10px] font-black text-emerald-900">
                KARTU TANDA PESERTA BIMMA
              </p>

              <div className="space-y-1.5 px-4 pt-2">
                <div>
                  <p className="text-[8px] font-semibold uppercase leading-tight text-slate-500">
                    Nama Mahasantri
                  </p>
                  <p className="break-words text-[11px] font-black leading-tight text-slate-900">
                    {peserta.namaLengkap}
                  </p>
                </div>

                <div>
                  <p className="text-[8px] font-semibold uppercase leading-tight text-slate-500">
                    Nomor Induk Mahasiswa (NIM)
                  </p>
                  <p className="break-words font-mono text-[12px] font-black leading-tight text-emerald-900">
                    {peserta.nim}
                  </p>
                </div>

                <div>
                  <p className="text-[8px] font-semibold uppercase leading-tight text-slate-500">
                    Program Studi
                  </p>
                  <p className="break-words text-[10px] font-bold leading-tight text-slate-800">
                    {peserta.programStudi || '-'}
                  </p>
                </div>

                <div>
                  <p className="text-[8px] font-semibold uppercase leading-tight text-slate-500">
                    Kontak / WhatsApp
                  </p>
                  <p className="break-words text-[10px] font-medium leading-tight text-slate-800">
                    {peserta.nomorWhatsApp || '-'}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex flex-col items-center px-3 pb-3 pt-2">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-white p-1">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt={`QR ${peserta.nim}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-center text-[9px] text-slate-400">
                      Membuat QR...
                    </span>
                  )}
                </div>
                <span className="mt-1 text-[8px] font-black uppercase text-emerald-900">
                  Kode Presensi Resmi
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-700">
                  {peserta.nim}
                </span>
              </div>
            </div>

            {/* ACTION DOWNLOAD GAMBAR KARTU */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                onClick={handleDownloadCardImage}
                disabled={isDownloadingImage}
                className="w-full py-3 rounded-2xl glass-btn-emerald text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition hover:scale-102"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingImage ? 'Membuat Gambar...' : 'Download Gambar Kartu Peserta (PNG)'}</span>
              </button>

              <button
                onClick={() => setShowCardModal(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
