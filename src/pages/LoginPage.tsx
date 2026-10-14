import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Check,
  Camera,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { User as UserType } from '../types';
import {
  setCurrentUser,
  addAuditLog,
  loginPesertaByNimOrId,
  verifyStaffLogin,
} from '../storage';
import { d1LoginPeserta } from '../services/d1Storage';
import { UnisaLogo } from '../components/UnisaLogo';

interface LoginProps {
  onLoginSuccess: (user: UserType) => void;
  onOpenPublicForm?: () => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLoginSuccess, onOpenPublicForm }) => {
  const [usernameOrNim, setUsernameOrNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Dedicated QR Camera Scanner Modal
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Unified Single Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const key = usernameOrNim.trim();

    try {
      // 1. Jika ada password diinput, coba verifikasi sebagai Akun Petugas / Admin
      if (password.trim()) {
        const staffRes = await verifyStaffLogin(key, password);
        if (staffRes.success && staffRes.user) {
          setCurrentUser(staffRes.user);
          addAuditLog({
            penggunaId: staffRes.user.id,
            aksi: 'LOGIN',
            jenisEntitas: 'PENGGUNA',
            entitasId: staffRes.user.id,
            nilaiSesudah: `Role ${staffRes.user.role} (${staffRes.user.namaLengkap})`,
            statusAksi: 'BERHASIL',
          });
          onLoginSuccess(staffRes.user);
          return;
        } else {
          // Jika username cocok tapi password salah
          if (staffRes.message.includes('Password akun salah')) {
            setError(staffRes.message);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Cek apakah ini akun PESERTA / MAHASANTRI (Berdasarkan NIM atau ID)
      const res = loginPesertaByNimOrId(key);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
        return;
      }

      // 3. Verifikasi remote langsung ke Cloudflare D1 SQL jika belum ada di cache
      const d1Res = await d1LoginPeserta(key);
      if (d1Res.success && d1Res.user) {
        setCurrentUser(d1Res.user);
        onLoginSuccess(d1Res.user);
      } else {
        setError(d1Res.message || 'Username atau NIM tidak terdaftar dalam database!');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat verifikasi login.');
      setLoading(false);
    }
  };

  // Mulai Kamera Scan QR untuk Login
  const handleOpenScanner = () => {
    setCameraError(null);
    setIsScanningQr(true);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('login-qr-camera-container');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            const cleanNim = decodedText.trim();
            handleScanSuccess(cleanNim);
          },
          () => {}
        );
      } catch (err: any) {
        console.error('Kamera scanner login gagal dibuka:', err);
        setCameraError('Gagal mengakses kamera: Pastikan izin kamera telah disetujui di browser.');
      }
    }, 300);
  };

  const handleScanSuccess = (nim: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => {
          setIsScanningQr(false);
          setUsernameOrNim(nim);

          const res = loginPesertaByNimOrId(nim);
          if (res.success && res.user) {
            onLoginSuccess(res.user);
          } else {
            setError(res.message);
          }
        })
        .catch(() => {
          setIsScanningQr(false);
        });
    } else {
      setIsScanningQr(false);
      setUsernameOrNim(nim);
      const res = loginPesertaByNimOrId(nim);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.message);
      }
    }
  };

  const handleCloseScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => setIsScanningQr(false))
        .catch(() => setIsScanningQr(false));
    } else {
      setIsScanningQr(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf3ef] flex flex-col justify-between items-center p-3 sm:p-6 lg:p-8 font-sans select-none relative overflow-x-hidden">
      {/* Decorative Brand Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-gradient-to-b from-[#10b981]/15 to-transparent blur-3xl pointer-events-none" />

      {/* Header Emblem */}
      <header className="w-full max-w-md flex items-center justify-between relative z-10 pt-2 sm:pt-4">
        <div className="flex items-center gap-2.5">
          <UnisaLogo size={36} />
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-800 leading-none">
              BIMMA Portal
            </h2>
            <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider mt-0.5">
              Bimbingan Mahasiswa • Pesantren Mahasiswa UNISA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-emerald-200/60 shadow-xs text-[10px] font-bold text-emerald-900">
          <Shield className="w-3 h-3 text-emerald-700" />
          <span>Sistem Resmi</span>
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-md bg-[#f4f8f5] rounded-[28px] sm:rounded-[36px] shadow-[14px_18px_36px_rgba(160,190,175,0.45),-10px_-10px_28px_rgba(255,255,255,0.95)] border border-white/90 p-5 sm:p-7 flex flex-col items-center my-auto relative z-10">
        {/* UNISA Badge Emblem */}
        <div className="p-1 rounded-[24px] bg-white shadow-[6px_6px_14px_rgba(5,150,105,0.25),-4px_-4px_10px_rgba(255,255,255,0.8)] border-2 border-emerald-500/20 flex items-center justify-center">
          <UnisaLogo size={56} />
        </div>

        {/* Title */}
        <div className="text-center mt-3 mb-4 sm:mb-5">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800">
            Masuk ke Sistem BIMMA
          </h1>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
            Satu portal terpadu untuk Admin, Musyrif, dan Mahasantri
          </p>
        </div>

        {/* UNIFIED SINGLE FORM */}
        <form onSubmit={handleLogin} className="w-full space-y-3">
          {error && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs text-center font-bold">
              {error}
            </div>
          )}

          {/* USERNAME / NIM INPUT FIELD WITH ATTACHED SCAN QR BUTTON */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Username Petugas atau NIM Mahasantri
            </label>
            <div className="relative flex items-center">
              <div className="w-full h-11 sm:h-12 rounded-[18px] sm:rounded-[20px] bg-[#edf3ef] shadow-[inset_3px_3px_6px_rgba(180,205,190,0.65),inset_-3px_-3px_6px_rgba(255,255,255,0.95)] flex items-center pl-3 pr-1.5 transition-all focus-within:ring-2 focus-within:ring-[#059669]">
                <User className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                <input
                  type="text"
                  required
                  value={usernameOrNim}
                  onChange={(e) => setUsernameOrNim(e.target.value)}
                  placeholder="Ketik Username atau NIM..."
                  className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none min-w-0"
                />

                {/* TOMBOL SCAN QR DI SAMPING USERNAME / NIM */}
                <button
                  type="button"
                  onClick={handleOpenScanner}
                  title="Scan QR Code Kartu Mahasantri"
                  className="h-8 px-2.5 sm:px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shrink-0 shadow-xs cursor-pointer transition active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan QR</span>
                </button>
              </div>
            </div>
          </div>

          {/* PASSWORD FIELD */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Password (Khusus Admin & Petugas)</span>
              <span className="text-[10px] font-medium text-slate-400">Santri: Kosongkan</span>
            </label>
            <div className="relative">
              <div className="w-full h-11 sm:h-12 rounded-[18px] sm:rounded-[20px] bg-[#edf3ef] shadow-[inset_3px_3px_6px_rgba(180,205,190,0.65),inset_-3px_-3px_6px_rgba(255,255,255,0.95)] flex items-center px-3.5 transition-all focus-within:ring-2 focus-within:ring-[#059669]">
                <Lock className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password akun..."
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 transition ml-2 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* REMEMBER ME & PERSISTENT SESSION TOGGLE */}
          <div className="flex items-center justify-between text-xs px-1 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                  rememberMe
                    ? 'bg-[#059669] text-white shadow-[0_2px_6px_rgba(5,150,105,0.5)]'
                    : 'bg-[#edf3ef] shadow-[inset_2px_2px_4px_rgba(180,205,190,0.7)]'
                }`}
              >
                {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span className="text-slate-600 font-bold text-[11px]">Ingat Saya di Perangkat Ini</span>
            </label>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 rounded-[22px] glass-btn-emerald text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition disabled:opacity-60 shadow-lg"
            >
              {loading ? (
                <span>Memproses Akun...</span>
              ) : (
                <>
                  <span>Masuk ke Sistem</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* MODAL SCANNER QR DI DALAM LOGIN PAGE */}
      {isScanningQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-center space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-xs text-slate-800">
                  Scan QR Kartu Mahasantri
                </h3>
              </div>
              <button
                onClick={handleCloseScanner}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Arahkan QR Code kartu santri Anda ke depan kamera untuk login langsung.
            </p>

            <div
              id="login-qr-camera-container"
              className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-emerald-500/50"
            />

            {cameraError && (
              <p className="text-xs text-rose-600 font-semibold">{cameraError}</p>
            )}

            <button
              type="button"
              onClick={handleCloseScanner}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Tutup Kamera
            </button>
          </div>
        </div>
      )}

      {/* Professional Left-Aligned Footer with BIMMA Logo */}
      <footer className="w-full max-w-md relative z-10 pt-4 pb-2 border-t border-emerald-900/10 text-left">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white p-1.5 shadow-2xs border border-emerald-200/80 shrink-0 flex items-center justify-center">
            <UnisaLogo size={24} />
          </div>
          <div className="space-y-0.5 text-left min-w-0">
            <p className="text-[11px] font-black text-slate-800 tracking-tight leading-tight">
              BIMMA Portal • PESMA UNISA Bandung
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Pengembang: <span className="text-emerald-800 font-bold">M. Ridhwan Mubarok (200125016)</span> • S1 DKV 2025
            </p>
            <p className="text-[9px] text-slate-400">
              Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung 40275
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
