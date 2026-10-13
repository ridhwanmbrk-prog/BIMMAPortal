import React, { useState } from 'react';
import {
  Sliders,
  Database,
  Link,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  FileCode,
} from 'lucide-react';
import { getConfig, saveConfig } from '../storage';
import { GOOGLE_APPS_SCRIPT_CODE } from '../gasScript';
import { initRekapFormulasInSheet } from '../sheetApi';

export const PengaturanPage: React.FC = () => {
  const config = getConfig();
  const [backendUrl, setBackendUrl] = useState(config.backendUrl || '');
  const [namaKampus, setNamaKampus] = useState(config.namaKampus);
  const [namaPesma, setNamaPesma] = useState(config.namaPesma);
  const [alamatPesma, setAlamatPesma] = useState(
    config.alamatPesma || 'Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275'
  );
  const [toleransiDefault, setToleransiDefault] = useState(config.toleransiDefault);

  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  const [formulaResult, setFormulaResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  const [copiedCode, setCopiedCode] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfig({
      backendUrl: backendUrl.trim(),
      namaKampus,
      namaPesma,
      alamatPesma: alamatPesma.trim(),
      zonaWaktu: config.zonaWaktu || 'Asia/Jakarta',
      logoUrl: config.logoUrl || '',
      toleransiDefault: Number(toleransiDefault),
    });
    alert('Pengaturan sistem dan alamat Pesma berhasil disimpan!');
  };

  const handleInstallFormulas = async () => {
    if (!backendUrl.trim()) {
      alert('Masukkan URL Google Apps Script terlebih dahulu!');
      return;
    }
    setFormulaResult({ status: 'loading', message: 'Membuat 4 sheet dan memasang formula ke Google Sheets...' });
    const res = await initRekapFormulasInSheet(backendUrl);
    if (res.success) {
      setFormulaResult({ status: 'success', message: res.message });
    } else {
      setFormulaResult({ status: 'error', message: res.message });
    }
  };

  // Uji Ping Koneksi Google Apps Script
  const handleTestConnection = async () => {
    if (!backendUrl.trim()) {
      setTestResult({
        status: 'error',
        message: 'Masukkan URL Google Apps Script Web App terlebih dahulu!',
      });
      return;
    }

    setTestResult({ status: 'loading', message: 'Menghubungi endpoint Google Apps Script...' });
    try {
      const targetUrl = backendUrl.includes('?') ? `${backendUrl}&action=ping` : `${backendUrl}?action=ping`;
      const res = await fetch(targetUrl, { method: 'GET' });
      const data = await res.json();

      if (data.success) {
        setTestResult({
          status: 'success',
          message: `Koneksi Berhasil! Terhubung ke Google Apps Script. Server Time: ${data.serverTime || 'Asia/Jakarta'}`,
        });
      } else {
        setTestResult({
          status: 'error',
          message: `Endpoint merespons, namun mengembalikan status gagal: ${data.message || 'Cek deployment Apps Script'}`,
        });
      }
    } catch (err: unknown) {
      setTestResult({
        status: 'error',
        message: `Koneksi Gagal: ${(err as Error).message}. Pastikan Web App di-deploy dengan akses 'Anyone' dan URL berformat 'https://script.google.com/macros/s/.../exec'`,
      });
    }
  };

  const copyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-[#0f261a] p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-emerald-900/30 shadow-xs">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Pengaturan Sistem & Integrasi Google Apps Script</span>
        </h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Hubungkan frontend web dengan Google Sheets sebagai database melalui backend Google Apps Script.
        </p>
      </div>

      {/* FORM PENGATURAN KONEKSI */}
      <div className="bg-white dark:bg-[#0f261a] p-6 rounded-2xl border border-slate-200 dark:border-emerald-900/30 shadow-xs space-y-5">
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Google Apps Script Web App URL</span>
              </span>
              <span className="text-[10px] text-slate-400">Format: https://script.google.com/macros/s/.../exec</span>
            </label>
            <input
              type="url"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="w-full p-2.5 border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              *Jika dikosongkan, aplikasi akan berjalan dalam <b>Mode Pengujian Lokal / Offline Demo</b> dengan penyimpanan di browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Nama Pesantren Mahasiswa (PESMA)
              </label>
              <input
                type="text"
                value={namaPesma}
                onChange={(e) => setNamaPesma(e.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Alamat Resmi Pesma UNISA Bandung
              </label>
              <input
                type="text"
                value={alamatPesma}
                onChange={(e) => setAlamatPesma(e.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-white/15 bg-white dark:bg-black/20 text-slate-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={handleTestConnection}
              className="px-3.5 py-2 bg-slate-800 dark:bg-white/10 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition cursor-pointer"
            >
              Uji Koneksi Backend
            </button>
            <button
              type="button"
              onClick={handleInstallFormulas}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Pasang 4 Formula Rekap ke Google Sheets</span>
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition cursor-pointer"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </form>

        {/* FEEDBACK HASIL FORMULA REKAPAN */}
        {formulaResult.status !== 'idle' && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              formulaResult.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : formulaResult.status === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {formulaResult.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {formulaResult.status === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold">{formulaResult.message}</p>
            </div>
          </div>
        )}

        {/* FEEDBACK HASIL PING TEST */}
        {testResult.status !== 'idle' && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              testResult.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : testResult.status === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {testResult.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {testResult.status === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold">
                {testResult.status === 'loading'
                  ? 'Sedang menguji...'
                  : testResult.status === 'success'
                  ? 'Koneksi Berhasil!'
                  : 'Gagal Terhubung'}
              </p>
              <p className="mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* PANDUAN PENYIAPAN GOOGLE APPS SCRIPT & GOOGLE SHEETS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-700" />
            <h2 className="font-bold text-sm text-slate-800">Kode Google Apps Script Siap Pasang</h2>
          </div>
          <button
            onClick={copyAppsScript}
            className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? 'Tersalin ke Clipboard!' : 'Salin Kode .GS'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Langkah mudah menghubungkan Google Sheets kampus:
          <br />
          1. Buka Google Spreadsheet baru (beri nama misal: <b>DATABASE BIMMA PESMA UNISA</b>).
          <br />
          2. Klik menu <b>Extensions &gt; Apps Script</b>.
          <br />
          3. Hapus kode bawaan, lalu tempel kode yang disalin dari tombol di atas.
          <br />
          4. Klik <b>Deploy &gt; New deployment</b>. Pilih type: <b>Web app</b>.
          <br />
          5. Pada <i>Execute as</i> pilih <b>Me</b>, dan pada <i>Who has access</i> pilih <b>Anyone</b>.
          <br />
          6. Salin URL Web App yang dihasilkan dan tempelkan ke kolom URL di atas.
        </p>

        <div className="max-h-60 overflow-y-auto bg-slate-900 text-emerald-300 p-4 rounded-xl font-mono text-[11px] leading-relaxed">
          <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
        </div>
      </div>

      {/* INFORMASI PEMBUAT APLIKASI (DEVELOPER INFO) */}
      <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>Informasi Pengembang Aplikasi</span>
        </h3>
        <div className="p-4 rounded-xl bg-[#f4f8f5] border border-emerald-200/60 text-xs space-y-1.5">
          <p className="font-bold text-slate-800">
            Developer: <span className="text-emerald-800 font-black">M. Ridhwan Mubarok</span>
          </p>
          <p className="text-slate-600 font-mono">
            NIM: <span className="font-bold text-slate-900">200125016</span>
          </p>
          <p className="text-slate-600">
            Program Studi: <span className="font-bold text-slate-900">Mahasiswa S1 Desain Komunikasi Visual (DKV) 2025</span>
          </p>
          <p className="text-slate-600">
            Afiliasi: <span className="font-bold text-emerald-800">Universitas ‘Aisyiyah Bandung</span>
          </p>
        </div>
      </div>
    </div>
  );
};
