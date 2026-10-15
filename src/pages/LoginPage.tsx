
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
import { UnisaLogo } from '../components/UnisaLogo';

interface LoginProps {
  onLoginSuccess: (user: UserType) => void;
  onOpenPublicForm?: () => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [isScanningQr, setIsScanningQr] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingQrRef = useRef(false);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  // Login admin dan petugas hanya menggunakan username + password.
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyStaffLogin(username.trim(), password);

      if (!result.success || !result.user) {
        setError(result.message || 'Username atau password tidak valid.');
        return;
      }

      setCurrentUser(result.user);

      addAuditLog({
        penggunaId: result.user.id,
        aksi: 'LOGIN',
        jenisEntitas: 'PENGGUNA',
        entitasId: result.user.id,
        nilaiSesudah: `Role ${result.user.role} (${result.user.namaLengkap})`,
        statusAksi: 'BERHASIL',
      });

      onLoginSuccess(result.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memverifikasi akun.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Peserta hanya dapat login melalui hasil pemindaian QR.
  const handleScanSuccess = async (scannedText: string) => {
    if (processingQrRef.current) return;
    processingQrRef.current = true;

    const qrValue = scannedText.trim();

    try {
      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        await scanner.stop().catch(() => {});
      }

      setIsScanningQr(false);
      setCameraError(null);

      if (!qrValue) {
        setError('QR peserta tidak terbaca.');
        return;
      }

      setError(null);
      setLoading(true);

      const result = await loginPesertaByNimOrId(qrValue);

      if (!result.success || !result.user) {
        setError(result.message || 'Login peserta gagal diverifikasi.');
        return;
      }

      onLoginSuccess(result.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memverifikasi QR.'
      );
    } finally {
      setLoading(false);
      processingQrRef.current = false;
    }
  };

  const handleOpenScanner = () => {
    if (loading || isScanningQr) return;

    setError(null);
    setCameraError(null);
    processingQrRef.current = false;
    setIsScanningQr(true);

    window.setTimeout(async () => {
      try {
        const container = document.getElementById(
          'login-qr-camera-container'
        );

        if (!container) {
          setCameraError('Area kamera tidak ditemukan.');
          return;
        }

        const scanner = new Html5Qrcode('login-qr-camera-container');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1,
          },
          (decodedText) => {
            void handleScanSuccess(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error('Gagal membuka kamera QR:', err);
        setCameraError(
          'Kamera gagal dibuka. Pastikan izin kamera diberikan dan akses menggunakan HTTPS.'
        );
      }
    }, 300);
  };

  const handleCloseScanner = async () => {
    try {
      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Modal tetap ditutup jika kamera gagal dihentikan.
    } finally {
      setIsScanningQr(false);
      setCameraError(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf3ef] flex flex-col justify-between items-center p-3 sm:p-6 lg:p-8 font-sans select-none relative overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-gradient-to-b from-[#10b981]/15 to-transparent blur-3xl pointer-events-none" />

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

      <main className="w-full max-w-md bg-[#f4f8f5] rounded-[28px] sm:rounded-[36px] shadow-[14px_18px_36px_rgba(160,190,175,0.45),-10px_-10px_28px_rgba(255,255,255,0.95)] border border-white/90 p-5 sm:p-7 flex flex-col items-center my-auto relative z-10">
        <div className="p-1 rounded-[24px] bg-white shadow-[6px_6px_14px_rgba(5,150,105,0.25),-4px_-4px_10px_rgba(255,255,255,0.8)] border-2 border-emerald-500/20 flex items-center justify-center">
          <UnisaLogo size={56} />
        </div>

        <div className="text-center mt-3 mb-5">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800">
            Masuk ke Sistem BIMMA
          </h1>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
            Admin dan petugas menggunakan akun. Mahasantri menggunakan QR kartu.
          </p>
        </div>

        {error && (
          <div className="w-full mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs text-center font-bold">
            {error}
          </div>
        )}

        {/* LOGIN PESERTA: QR SAJA */}
        <section className="w-full rounded-2xl border border-emerald-200 bg-white/70 p-4 text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <Camera className="w-5 h-5 text-emerald-700" />
          </div>

          <h2 className="mt-3 text-sm font-black text-slate-800">
            Login Mahasantri
          </h2>
          <p className="mt-1 mb-4 text-xs text-slate-500">
            Pindai QR pada kartu mahasantri untuk masuk.
          </p>

          <button
            type="button"
            onClick={handleOpenScanner}
            disabled={loading || isScanningQr}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            <Camera className="w-4 h-4" />
            {loading ? 'Memverifikasi...' : 'Scan QR Kartu Mahasantri'}
          </button>
        </section>

        <div className="w-full flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            Admin & Petugas
          </span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* LOGIN STAFF: USERNAME + PASSWORD */}
        <form onSubmit={handleStaffLogin} className="w-full space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Username
            </label>
            <div className="w-full h-11 sm:h-12 rounded-[18px] bg-[#edf3ef] shadow-[inset_3px_3px_6px_rgba(180,205,190,0.65),inset_-3px_-3px_6px_rgba(255,255,255,0.95)] flex items-center px-3.5 focus-within:ring-2 focus-within:ring-emerald-600">
              <User className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username admin atau petugas"
                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none min-w-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Password
            </label>
            <div className="w-full h-11 sm:h-12 rounded-[18px] bg-[#edf3ef] shadow-[inset_3px_3px_6px_rgba(180,205,190,0.65),inset_-3px_-3px_6px_rgba(255,255,255,0.95)] flex items-center px-3.5 focus-within:ring-2 focus-within:ring-emerald-600">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password akun"
                className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none min-w-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="text-slate-400 hover:text-slate-600 ml-2"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none px-1 pt-1">
            <div
              role="checkbox"
              aria-checked={rememberMe}
              onClick={() => setRememberMe(!rememberMe)}
              className={`w-4 h-4 rounded-md flex items-center justify-center ${
                rememberMe
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#edf3ef] border border-slate-300'
              }`}
            >
              {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <span className="text-slate-600 font-bold text-[11px]">
              Ingat Saya di Perangkat Ini
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 sm:h-12 rounded-[22px] glass-btn-emerald text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition disabled:opacity-60 shadow-lg"
          >
            {loading ? (
              <span>Memverifikasi akun...</span>
            ) : (
              <>
                <span>Masuk sebagai Admin/Petugas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </main>

      {/* MODAL PEMINDAI QR */}
      {isScanningQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-5 shadow-2xl text-center space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-xs text-slate-800">
                  Scan QR Kartu Mahasantri
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Arahkan QR pada kartu ke kamera. Login akan diverifikasi oleh server.
            </p>

            <div
              id="login-qr-camera-container"
              className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-emerald-500/50"
            />

            {cameraError && (
              <p className="text-xs text-rose-600 font-semibold">
                {cameraError}
              </p>
            )}

            <button
              type="button"
              onClick={handleCloseScanner}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              Tutup Kamera
            </button>
          </div>
        </div>
      )}

      <footer className="w-full max-w-md relative z-10 pt-4 pb-2 border-t border-emerald-900/10 text-left">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white p-1.5 border border-emerald-200/80 shrink-0 flex items-center justify-center">
            <UnisaLogo size={24} />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-[11px] font-black text-slate-800 tracking-tight">
              BIMMA Portal • PESMA UNISA Bandung
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Pengembang: <span className="text-emerald-800 font-bold">M. Ridhwan Mubarok</span> • S1 DKV
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
