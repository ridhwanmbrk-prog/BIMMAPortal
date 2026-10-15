import React from 'react';
import { AlertTriangle, Home, LogIn, ArrowLeft } from 'lucide-react';
import { UnisaLogo } from '../components/UnisaLogo';

interface NotFoundPageProps {
  currentPath: string;
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  currentPath,
  onNavigateHome,
  onNavigateLogin,
}) => {
  return (
    <div className="min-h-screen bg-[#f4f8f5] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-emerald-100 p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black tracking-wider uppercase border border-rose-200">
            HTTP 404 NOT FOUND
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Alamat URL <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold break-all">{currentPath}</code> tidak terdaftar di sistem presensi BIMMA UNISA Bandung.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            onClick={onNavigateHome}
            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>

          <button
            onClick={onNavigateLogin}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Login Petugas / Santri</span>
          </button>
        </div>

        <footer className="pt-3 border-t border-slate-100 flex items-start gap-2.5 text-left">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 p-1 border border-emerald-200 shrink-0 flex items-center justify-center">
            <UnisaLogo size={18} />
          </div>
          <div className="text-left space-y-0.5">
            <p className="text-[11px] font-black text-slate-800 leading-tight">
              BIMMA Portal • PESMA UNISA Bandung
            </p>
            <p className="text-[10px] text-slate-400">
              Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung 40275
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
