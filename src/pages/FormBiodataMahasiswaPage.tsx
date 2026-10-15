import React, { useState } from 'react';
import {
  QrCode,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Camera,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Peserta } from '../types';
import { d1LookupParticipantBiodata, d1UpdateParticipantBiodata } from '../services/d1Storage';
import { Html5Qrcode } from 'html5-qrcode';
import { UnisaLogo } from '../components/UnisaLogo';

interface FormBiodataProps {
  onBack?: () => void;
}

export const FormBiodataMahasiswaPage: React.FC<FormBiodataProps> = ({ onBack }) => {
  const [nimInput, setNimInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedPeserta, setSelectedPeserta] = useState<Peserta | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [nomorWhatsApp, setNomorWhatsApp] = useState('');
  const [alamat, setAlamat] = useState('');

  const [isScanningQr, setIsScanningQr] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  // Cari santri berdasarkan NIM / ID
  const handleFindSantri = async (key: string) => {
    const clean = key.trim();
    if (!clean) {
      setErrorMessage('Masukkan NIM atau ID peserta terlebih dahulu.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await d1LookupParticipantBiodata(clean);
      if (result.success && result.peserta) {
        setSelectedPeserta(result.peserta);
        setEmail(result.peserta.email || '');
        setNomorWhatsApp(result.peserta.nomorWhatsApp || '');
        setAlamat(result.peserta.alamat || '');
      } else {
        setSelectedPeserta(null);
        setErrorMessage(result.message || `NIM/ID '${clean}' tidak ditemukan dalam database santri.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Start Camera QR Scanner untuk identifikasi mandiri
  const startScanner = async () => {
    setIsScanningQr(true);
    setCameraError(null);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('reader-biodata');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            stopScanner();
            setNimInput(decoded);
            void handleFindSantri(decoded);
          },
          () => {}
        );
      } catch (err: unknown) {
        setCameraError('Gagal membuka kamera: ' + (err as Error).message);
      }
    }, 200);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn(e);
      }
      scannerRef.current = null;
    }
    setIsScanningQr(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeserta) return;

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await d1UpdateParticipantBiodata({
        pesertaId: selectedPeserta.pesertaId,
        nim: selectedPeserta.nim,
        email,
        nomorWhatsApp,
        alamat,
      });
      if (res.success && res.peserta) {
        setSuccessMessage(res.message);
        setSelectedPeserta(res.peserta);
      } else {
        setErrorMessage(res.message || 'Biodata belum berhasil disimpan ke database.');
      }
    } catch {
      setErrorMessage('Tidak dapat menyimpan biodata ke database. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf3ef] dark:bg-[#06120b] py-8 px-4 flex flex-col items-center justify-center font-sans select-none">
      <div className="w-full max-w-lg bg-white dark:bg-[#0f261a] rounded-[36px] shadow-[16px_20px_40px_rgba(180,205,190,0.5)] dark:shadow-[16px_20px_40px_rgba(0,0,0,0.6)] border border-slate-200/60 dark:border-emerald-900/30 p-6 sm:p-8 space-y-6">
        
        {/* Top Action Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10 text-xs">
          {onBack ? (
            <button
              onClick={onBack}
              className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              ← Kembali ke Beranda
            </button>
          ) : <div />}

          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 transition cursor-pointer text-[11px]"
          >
            {copiedLink ? '✓ Link Berhasil Disalin!' : '🔗 Bagikan Link Form'}
          </button>
        </div>

        {/* Header Branding */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-3xl bg-linear-to-br from-[#059669] to-[#047857] text-white flex items-center justify-center mx-auto shadow-lg mb-2">
            <Sparkles className="w-7 h-7" />
          </div>
          <p className="text-[11px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
            Formulir Mandiri Mahasantri BIMMA
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            Lengkapi Biodata Santri
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Halaman ini dapat diakses langsung tanpa login. Pindai QR kartu Anda atau masukkan NIM untuk mengisi email, no WA, dan alamat.
          </p>
        </div>

        {/* STEP 1: SCAN QR / MASUKKAN NIM */}
        {!selectedPeserta ? (
          <div className="space-y-4 pt-2">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center flex items-center gap-2 justify-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Tombol Scan QR Kamera */}
            <button
              onClick={startScanner}
              className="w-full py-3.5 px-4 rounded-2xl glass-btn-emerald text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:scale-101 transition"
            >
              <Camera className="w-4 h-4" />
              <span>Scan QR Kartu Identitas Santri</span>
            </button>

            {/* Camera Viewfinder if scanning */}
            {isScanningQr && (
              <div className="p-4 bg-slate-950 rounded-3xl flex flex-col items-center">
                <div id="reader-biodata" className="w-full max-w-[280px] rounded-2xl overflow-hidden" />
                {cameraError && <p className="text-xs text-rose-400 mt-2">{cameraError}</p>}
                <button
                  onClick={stopScanner}
                  className="mt-3 text-xs text-white/80 hover:text-white font-bold"
                >
                  Batal Scan
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/10" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">ATAU MASUKKAN NIM</span>
              <div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/10" />
            </div>

            {/* Input Manual NIM */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Masukkan NIM Anda (contoh: 231234001)"
                value={nimInput}
                onChange={(e) => setNimInput(e.target.value)}
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-300 dark:border-white/15 bg-[#f4f7f5] dark:bg-black/20 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => void handleFindSantri(nimInput)}
                className="px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Cari Data
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: FORM PENGISIAN BIODATA */
          <form onSubmit={handleSubmit} className="space-y-4 pt-1 animate-in fade-in duration-200 text-xs">
            {/* Identity Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                  Data Terverifikasi
                </p>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  {selectedPeserta.namaLengkap}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                  NIM: {selectedPeserta.nim} • Jurusan: {selectedPeserta.programStudi} • {selectedPeserta.batchId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPeserta(null)}
                className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Ganti Santri
              </button>
            </div>

            {successMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold text-center flex items-center gap-2 justify-center">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                <span>Alamat Email Aktif *</span>
              </label>
              <input
                type="email"
                required
                placeholder="nama.santri@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nomor WhatsApp Aktif *</span>
              </label>
              <input
                type="tel"
                required
                placeholder="081234567890"
                value={nomorWhatsApp}
                onChange={(e) => setNomorWhatsApp(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Alamat */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Alamat Rumah Asal Lengkap *</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota/kabupaten asal"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl glass-btn-emerald text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Simpan & Integrasikan Biodata</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <footer className="pt-4 border-t border-slate-200/80 text-left flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-white p-1.5 shadow-2xs border border-emerald-200/80 shrink-0 flex items-center justify-center">
            <UnisaLogo size={20} />
          </div>
          <div className="space-y-0.5 text-left text-slate-600">
            <p className="text-[11px] font-black text-slate-800 leading-tight">
              BIMMA Portal • PESMA Universitas 'Aisyiyah Bandung
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Formulir Verifikasi Mandiri Mahasantri • Terusan Rancagoong II No.1, Batununggal, Bandung
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
