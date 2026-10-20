import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Clock,
  Volume2,
  VolumeX,
  Keyboard,
  X,
  SwitchCamera,
  MessageSquare,
  Sparkles,
  Check,
  Zap,
  ZapOff,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Musyrif, JadwalKegiatan, Peserta } from '../types';
import {
  getItems,
  getActiveMusyrif,
  setActiveMusyrif,
  processQrScan,
  ScanResult,
  isWithinScheduleTime,
  verifyKedatanganSantri,
  updateAbsensiAlasan,
  getCurrentUser,
} from '../storage';

interface ToastState {
  show: boolean;
  type: 'success' | 'duplicate' | 'error' | 'warning';
  title: string;
  message: string;
  peserta?: Peserta;
  waktu?: string;
  namaKegiatan?: string;
  keteranganWaktu?: 'TEPAT_WAKTU' | 'TERLAMBAT';
  menitKeterlambatan?: number;
  catatan?: string;
  absensiId?: string;
  alasanTerpilih?: string;
}

export type ScannerMode = 'PRESENSI' | 'SURAT_IZIN';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: () => void;
  initialMode?: ScannerMode;
}

const COMMON_LATE_REASONS = [
  'Antre Wudhu/Kamar Mandi',
  'Kondisi Kesehatan Kurang Fit',
  'Tugas Kuliah/Piket Asrama',
  'Kendala Transportasi/Hujan',
  'Urusan Mendesak',
];

export const CameraScannerModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  initialMode = 'PRESENSI',
}) => {
  const [scanMode, setScanMode] = useState<ScannerMode>(initialMode);
  const [musyrifList, setMusyrifList] = useState<Musyrif[]>([]);
  const [selectedMusyrifId, setSelectedMusyrifId] = useState<string>('');
  const [selectedMusyrif, setSelectedMusyrifState] = useState<Musyrif | null>(null);

  // Jadwal kegiatan yang aktif
  const [jadwalList, setJadwalList] = useState<JadwalKegiatan[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>('');

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);

  const [manualNim, setManualNim] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Inline custom alasan late input
  const [customAlasanInput, setCustomAlasanInput] = useState('');
  const [showCustomAlasanInput, setShowCustomAlasanInput] = useState(false);

  // Floating Result Toast
  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanThrottleRef = useRef<{ [nim: string]: number }>({});
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setScanMode(initialMode);

    const currentUser = getCurrentUser();
    const restrictedGender =
      currentUser?.role === 'PETUGAS'
        ? (currentUser.gender === 'AKHWAT' ? 'AKHWAT' : 'IKHWAN')
        : null;

    const musyrifs = getItems<Musyrif>('MUSYRIF').filter(
      (m) => m.status && (!restrictedGender || m.gender === restrictedGender),
    );
    setMusyrifList(musyrifs);

    // Petugas aktif yang tersimpan sebelumnya tidak boleh melewati filter gender.
    const storedActiveM = getActiveMusyrif();
    const activeM =
      storedActiveM && musyrifs.some((m) => m.id === storedActiveM.id)
        ? storedActiveM
        : null;

    if (activeM) {
      setSelectedMusyrifId(activeM.id);
      setSelectedMusyrifState(activeM);
    } else {
      setSelectedMusyrifId('');
      setSelectedMusyrifState(null);
    }

    // Ambil jadwal yang statusAktif = true
    const jadwals = getItems<JadwalKegiatan>('JADWAL').filter((j) => j.statusAktif);
    setJadwalList(jadwals);

    // Cari kegiatan yang jamnya aktif saat ini secara otomatis (strictly sesuai jam sekarang)
    const currentActiveJadwal = jadwals.find((j) => isWithinScheduleTime(j).valid) || null;
    if (currentActiveJadwal) {
      setSelectedJadwalId(currentActiveJadwal.jadwalId);
    } else {
      setSelectedJadwalId('');
    }

    if (activeM) {
      setTimeout(() => {
        startCamera(facingMode);
      }, 300);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, initialMode]);

  const handleMusyrifChange = (id: string) => {
    setSelectedMusyrifId(id);
    const m = musyrifList.find((x) => x.id === id) || null;
    setSelectedMusyrifState(m);
    setActiveMusyrif(m);

    if (m && !isScanning) {
      startCamera(facingMode);
    }
  };

  const playFeedback = (isSuccess: boolean, isWarning = false) => {
    // 1. Audio Sound
    if (soundEnabled) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (isSuccess && !isWarning) {
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } else if (isWarning) {
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } else {
          osc.frequency.setValueAtTime(320, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }
      } catch {
        // Audio fallback
      }
    }

    // 2. Haptic Vibration on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (isSuccess && !isWarning) {
          navigator.vibrate([80]);
        } else if (isWarning) {
          navigator.vibrate([100, 50, 100]);
        } else {
          navigator.vibrate([150, 80, 150]);
        }
      } catch {
        // Haptic fallback
      }
    }
  };

  const triggerToast = (res: ScanResult, nim: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    let type: 'success' | 'duplicate' | 'error' | 'warning' = 'error';
    let title = 'Presensi Ditolak';

    if (res.code === 'HADIR_BERHASIL') {
      if (res.keteranganWaktu === 'TERLAMBAT') {
        type = 'warning';
        title = `HADIR TERLAMBAT (${res.menitKeterlambatan || 0} MENIT)`;
        playFeedback(true, true);
      } else {
        type = 'success';
        title = 'HADIR TEPAT WAKTU — BERHASIL TERCATAT';
        playFeedback(true, false);
      }
      if (onScanSuccess) onScanSuccess();
    } else if (res.code === 'DUPLIKAT') {
      type = 'duplicate';
      title = 'SUDAH TERCATAT PADA KEGIATAN INI';
      playFeedback(false);
    } else {
      type = 'error';
      title = 'Presensi Gagal / Ditolak';
      playFeedback(false);
    }

    setShowCustomAlasanInput(false);
    setCustomAlasanInput('');

    setToast({
      show: true,
      type,
      title,
      message: res.message,
      peserta: res.peserta,
      namaKegiatan: res.namaKegiatan,
      waktu: res.waktuScan ? new Date(res.waktuScan).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) : new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
      keteranganWaktu: res.keteranganWaktu,
      menitKeterlambatan: res.menitKeterlambatan,
      catatan: res.catatan,
      absensiId: res.absensiId,
      alasanTerpilih: res.alasanTerlambat,
    });

    // Waktu tampil lebih lama jika terlambat agar sempat memilih alasan
    const timeoutDuration = res.keteranganWaktu === 'TERLAMBAT' ? 8000 : 4500;
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, timeoutDuration);
  };

  const handleSelectLateReason = (reason: string) => {
    if (!toast.absensiId) return;
    const res = updateAbsensiAlasan(toast.absensiId, reason);
    if (res.success) {
      setToast((prev) => ({
        ...prev,
        alasanTerpilih: reason,
        message: `${prev.message} • Alasan: "${reason}" dicatat.`,
      }));
      setShowCustomAlasanInput(false);
      if (onScanSuccess) onScanSuccess();
    }
  };

  const handleCustomReasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAlasanInput.trim() || !toast.absensiId) return;
    handleSelectLateReason(customAlasanInput.trim());
    setCustomAlasanInput('');
    setShowCustomAlasanInput(false);
  };

  const handleDecodedText = async (decodedText: string) => {
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    const selectedPetugas =
      musyrifList.find((m) => m.id === selectedMusyrifId) || null;

    if (!selectedPetugas) {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({
        show: true,
        type: 'warning',
        title: 'PILIH PETUGAS YANG SESUAI',
        message: 'Pilih nama petugas dari daftar akun yang sesuai sebelum melakukan scan.',
        waktu: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 4000);
      return;
    }

    // Pastikan proses absensi memakai petugas yang lolos filter akun login.
    setActiveMusyrif(selectedPetugas);

    const now = Date.now();
    const lastScanTime = scanThrottleRef.current[cleanText] || 0;
    if (now - lastScanTime < 2200) {
      return;
    }
    scanThrottleRef.current[cleanText] = now;

    setIsProcessing(true);
    try {
      // Deteksi cerdas: apakah ini Surat Izin Santri atau Kartu Santri
      const isSuratQr =
        scanMode === 'SURAT_IZIN' ||
        cleanText.toUpperCase().startsWith('IZIN-') ||
        cleanText.toUpperCase().startsWith('VRF-') ||
        cleanText.toUpperCase().includes('BIMMA/IZN');

      if (isSuratQr) {
        const petugasNama =
          selectedPetugas.nama || selectedMusyrif?.nama || 'Petugas Musyrif';
        const verifyRes = verifyKedatanganSantri(
          cleanText,
          petugasNama,
          'Diverifikasi langsung via Scan QR'
        );

        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

        if (verifyRes.success) {
          playFeedback(true, verifyRes.isOverdue);
          setToast({
            show: true,
            type: verifyRes.isOverdue ? 'warning' : 'success',
            title: verifyRes.isOverdue
              ? `KEDATANGAN MELEBIHI TENGGAT (${verifyRes.lateString})`
              : 'KEDATANGAN RESMI DIVERIFIKASI (TEPAT WAKTU)',
            message: verifyRes.message,
            peserta: verifyRes.peserta,
            namaKegiatan: `Verifikasi Kembali ke Asrama (${verifyRes.izin?.jenisIzin || 'Izin'})`,
            waktu: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
            catatan: verifyRes.izin?.catatanKedatangan,
            keteranganWaktu: verifyRes.isOverdue ? 'TERLAMBAT' : 'TEPAT_WAKTU',
          });
          if (onScanSuccess) onScanSuccess();
        } else {
          playFeedback(false);
          setToast({
            show: true,
            type: 'error',
            title: 'Verifikasi Surat Gagal',
            message: verifyRes.message,
            waktu: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
          });
        }

        toastTimeoutRef.current = setTimeout(() => {
          setToast((prev) => ({ ...prev, show: false }));
        }, 5500);
        return;
      }

      // Mode Normal: Presensi Kegiatan Harian Santri
      const allJadwals = getItems<JadwalKegiatan>('JADWAL').filter((j) => j.statusAktif);
      const activeNow = allJadwals.find((j) => isWithinScheduleTime(j).valid);

      if (!activeNow) {
        playFeedback(false);
        setToast({
          show: true,
          type: 'warning',
          title: 'TIDAK ADA KEGIATAN',
          message: 'Saat ini tidak ada jadwal kegiatan BIMMA yang sedang berlangsung. Presensi santri otomatis dibuka saat jam kegiatan tiba.',
          waktu: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
        });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          setToast((prev) => ({ ...prev, show: false }));
        }, 5000);
        return;
      }

      // QR baru: pesertaId-nim. Validasi keduanya sebelum mencatat presensi.
      let nimUntukAbsensi = cleanText;
      const pemisahTerakhir = cleanText.lastIndexOf('-');

      if (pemisahTerakhir > 0) {
        const qrPesertaId = cleanText.slice(0, pemisahTerakhir).trim();
        const qrNim = cleanText.slice(pemisahTerakhir + 1).trim();

        const pesertaCocok = getItems<Peserta>('PESERTA').find(
          (p) =>
            String(p.pesertaId).trim() === qrPesertaId &&
            String(p.nim).trim() === qrNim
        );

        if (!pesertaCocok) {
          playFeedback(false);
          setToast({
            show: true,
            type: 'error',
            title: 'QR PESERTA TIDAK VALID',
            message: 'ID peserta dan NIM tidak cocok dengan data peserta.',
            waktu: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
          });

          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => {
            setToast((prev) => ({ ...prev, show: false }));
          }, 4500);
          return;
        }

        nimUntukAbsensi = pesertaCocok.nim;
      }

      const result = await processQrScan(
        nimUntukAbsensi,
        activeNow.jadwalId
      );
      triggerToast(result, nimUntukAbsensi);

    } catch (err: unknown) {
      triggerToast(
        {
          success: false,
          code: 'DI_LUAR_JADWAL',
          message: 'Kesalahan sistem: ' + (err as Error).message,
        },
        cleanText
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async (targetFacing: 'environment' | 'user') => {
    setCameraError(null);
    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {}
      }

      const html5QrCode = new Html5Qrcode('qr-reader-fullscreen');
      scannerRef.current = html5QrCode;

      const configQr = {
        fps: 24,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrEdge = Math.floor(minEdge * 0.72);
          return { width: Math.max(qrEdge, 220), height: Math.max(qrEdge, 220) };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: targetFacing },
        configQr,
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
    } catch (err: unknown) {
      console.error('Kamera gagal:', err);
      setCameraError(
        'Tidak dapat mengakses kamera. Pastikan izin kamera aktif di browser, atau gunakan input manual NIM/ID di bawah.'
      );
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn('Stop camera error:', err);
      }
      scannerRef.current = null;
    }
    setTorchEnabled(false);
    setIsScanning(false);
  };

  const toggleCameraFacing = async () => {
    setTorchEnabled(false);
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    await startCamera(nextFacing);
  };

  const toggleTorch = async () => {
    try {
      const videoEl = document.querySelector('#qr-reader-fullscreen video') as HTMLVideoElement | null;
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (track) {
        const nextState = !torchEnabled;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchEnabled(nextState);
      }
    } catch (err) {
      console.warn('Lampu flash tidak didukung pada kamera/perangkat ini:', err);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNim.trim()) return;
    handleDecodedText(manualNim);
    setManualNim('');
  };

  if (!isOpen) return null;

  const currentJadwalObj = jadwalList.find((j) => j.jadwalId === selectedJadwalId);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-2.5 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      {/* TOP FLOATING RESULT TOAST */}
      <div className="w-full max-w-lg z-30 min-h-16 flex items-start justify-center">
        {toast.show && (
          <div
            className={`w-full p-3.5 sm:p-4 rounded-2xl shadow-2xl transition-all transform animate-in slide-in-from-top-4 border ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white border-emerald-400/40 shadow-emerald-950/60'
                : toast.type === 'warning'
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white border-amber-300/50 shadow-orange-950/60'
                : toast.type === 'duplicate'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-300/40 shadow-amber-950/60'
                : 'bg-gradient-to-r from-rose-700 to-red-800 text-white border-rose-400/40 shadow-rose-950/60'
            }`}
          >
            <div className="flex items-start gap-2.5 sm:gap-3.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 mt-0.5" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 mt-0.5 text-amber-200" />}
              {toast.type === 'duplicate' && <Clock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 mt-0.5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 mt-0.5" />}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-xs sm:text-sm tracking-wide leading-tight">{toast.title}</h3>
                  {toast.keteranganWaktu && (
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                        toast.keteranganWaktu === 'TEPAT_WAKTU'
                          ? 'bg-emerald-400/30 text-emerald-100 border border-emerald-300/50'
                          : 'bg-rose-400/40 text-white border border-rose-300/60 animate-pulse'
                      }`}
                    >
                      {toast.keteranganWaktu === 'TEPAT_WAKTU' ? 'Tepat Waktu' : `Lewat Tenggat (${toast.menitKeterlambatan}m)`}
                    </span>
                  )}
                </div>

                <p className="text-[11px] sm:text-xs mt-1 font-medium opacity-95 leading-snug">{toast.message}</p>

                {toast.peserta && (
                  <div className="mt-2 text-[10px] sm:text-[11px] bg-black/30 backdrop-blur-xs rounded-xl p-2 flex items-center gap-3 flex-wrap">
                    <span>
                      Santri: <b>{toast.peserta.namaLengkap}</b>
                    </span>
                    <span>
                      Kegiatan: <b>{toast.namaKegiatan || 'BIMMA'}</b>
                    </span>
                    <span>
                      Waktu Scan: <b>{toast.waktu} WIB</b>
                    </span>
                  </div>
                )}

                {/* PILIHAN ALASAN KETERLAMBATAN CEPAT (JIKA STATUS TERLAMBAT) */}
                {toast.keteranganWaktu === 'TERLAMBAT' && toast.absensiId && (
                  <div className="mt-2.5 pt-2 border-t border-white/20">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-200 flex items-center gap-1 mb-1.5">
                      <MessageSquare className="w-3 h-3" />
                      <span>Pilih / Tambah Alasan Keterlambatan:</span>
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COMMON_LATE_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => handleSelectLateReason(reason)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            toast.alasanTerpilih === reason
                              ? 'bg-white text-slate-900 shadow-md ring-2 ring-emerald-400'
                              : 'bg-white/20 hover:bg-white/30 text-white'
                          }`}
                        >
                          {toast.alasanTerpilih === reason && <Check className="w-3 h-3 text-emerald-600" />}
                          <span>{reason}</span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setShowCustomAlasanInput(!showCustomAlasanInput)}
                        className="px-2 py-1 rounded-lg bg-black/30 hover:bg-black/40 text-amber-200 border border-white/20 text-[10px] font-bold transition cursor-pointer"
                      >
                        + Alasan Lain
                      </button>
                    </div>

                    {showCustomAlasanInput && (
                      <form onSubmit={handleCustomReasonSubmit} className="mt-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Ketik alasan keterlambatan..."
                          value={customAlasanInput}
                          onChange={(e) => setCustomAlasanInput(e.target.value)}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/30 text-[11px] text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                        >
                          Simpan
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setToast((prev) => ({ ...prev, show: false }))}
                className="text-white/80 hover:text-white p-1 cursor-pointer shrink-0"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CENTER CAMERA VIEWPORT */}
      <div className="relative w-full max-w-md my-auto flex flex-col items-center">
        {/* Top Control Bar inside Camera View */}
        <div className="w-full flex items-center justify-between pb-2 text-white px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-white/95">
              Pemindai Terintegrasi BIMMA
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Switch Camera Facing */}
            <button
              onClick={toggleCameraFacing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Ganti Kamera Depan / Belakang"
            >
              <SwitchCamera className="w-4 h-4 text-emerald-300" />
            </button>

            {/* Toggle Flashlight / Torch */}
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-xl transition cursor-pointer ${
                torchEnabled
                  ? 'bg-amber-400 text-slate-900 shadow-md ring-2 ring-amber-300'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={torchEnabled ? 'Matikan Lampu Flash' : 'Nyalakan Lampu Flash (Jika Didukung)'}
            >
              {torchEnabled ? (
                <Zap className="w-4 h-4 fill-amber-300 text-slate-900" />
              ) : (
                <ZapOff className="w-4 h-4 text-slate-300" />
              )}
            </button>

            {/* Toggle Sound */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title={soundEnabled ? 'Matikan Suara' : 'Aktifkan Suara'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Close Camera */}
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/20 hover:bg-rose-600 text-white transition cursor-pointer"
              title="Tutup Kamera"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Frame Responsive Container */}
        <div className="relative w-full aspect-square max-w-[320px] sm:max-w-[360px] rounded-3xl overflow-hidden bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)] border-2 border-white/20 flex items-center justify-center">
          <div id="qr-reader-fullscreen" className="w-full h-full object-cover" />

          {/* Crosshairs target & animated neon beam */}
          <div className="absolute inset-6 sm:inset-8 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

            {/* Scanning line indicator */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-pulse" />
          </div>

          {cameraError && (
            <div className="absolute inset-4 bg-black/90 p-4 rounded-2xl flex flex-col items-center justify-center text-center text-xs text-rose-300">
              <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
              <p className="font-bold text-white mb-1">Kamera Tidak Tersedia</p>
              <p className="text-[11px]">{cameraError}</p>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
              <div className="bg-white px-4 py-2.5 rounded-2xl flex items-center gap-2 text-slate-800 text-xs font-bold shadow-xl">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Memproses Hasil Pindaian...</span>
              </div>
            </div>
          )}
        </div>

        {/* Musyrif Bertugas & Status Jadwal Otomatis Realtime */}
        <div className="w-full mt-2.5 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/15 text-white">
            <label className="text-[9px] font-bold text-emerald-300 block mb-0.5">Musyrif Bertugas:</label>
            <select
              value={selectedMusyrifId}
              onChange={(e) => handleMusyrifChange(e.target.value)}
              className="w-full bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer truncate"
            >
              <option value="" className="text-black">-- Pilih Petugas --</option>
              {musyrifList.map((m) => (
                <option key={m.id} value={m.id} className="text-black">
                  {m.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/15 text-white flex flex-col justify-center">
            <span className="text-[9px] font-bold text-emerald-300 block mb-0.5">Kegiatan Saat Ini:</span>
            {currentJadwalObj ? (
              <div className="truncate">
                <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate">{currentJadwalObj.namaKegiatan}</span>
                </div>
                <div className="text-[10px] text-emerald-200 font-mono mt-0.5">
                  {currentJadwalObj.jamMulai} - {currentJadwalObj.jamSelesai} WIB
                </div>
              </div>
            ) : (
              <div>
                <div className="font-bold text-xs text-amber-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>Tidak ada kegiatan</span>
                </div>
                <div className="text-[9px] text-white/60 mt-0.5">
                  Di luar jam kegiatan aktif
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* INPUT MANUAL NIM / KODE VERIFIKASI FALLBACK */}
      <div className="w-full max-w-md pt-2">
        <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex-1 h-10 sm:h-11 px-3.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center text-white">
            <Keyboard className="w-4 h-4 text-emerald-300 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Input NIM santri atau kode verifikasi..."
              value={manualNim}
              onChange={(e) => setManualNim(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-white/50 focus:outline-none font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={!manualNim.trim() || isProcessing}
            className="h-10 sm:h-11 px-3.5 sm:px-5 rounded-full text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5 glass-btn-emerald"
            title="Proses Input Manual"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Proses</span>
          </button>
        </form>
      </div>
    </div>
  );
};
