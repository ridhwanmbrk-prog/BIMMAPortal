import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Link,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Copy,
  FileCode,
  KeyRound,
  UserPlus,
  Users,
  Edit2,
  Trash2,
  Lock,
  User,
  Shield,
  Eye,
  EyeOff,
  Check,
  Database,
  ArrowRightLeft,
} from 'lucide-react';
import {
  getConfig,
  saveConfig,
  getUserAccounts,
  saveUserAccount,
  deleteUserAccount,
  changeStaffCredentials,
  getCurrentUser,
} from '../storage';
import { UserAccount } from '../types';
import { GOOGLE_APPS_SCRIPT_CODE } from '../gasScript';
import { initRekapFormulasInSheet } from '../sheetApi';
import { d1MigrateRelationalCollections } from '../services/d1Storage';

export const PengaturanPage: React.FC = () => {
  const config = getConfig();
  const currentUser = getCurrentUser();

  // Konfigurasi Umum
  const [backendUrl, setBackendUrl] = useState(config.backendUrl || '');
  const [namaPesma, setNamaPesma] = useState(config.namaPesma);
  const [alamatPesma, setAlamatPesma] = useState(
    config.alamatPesma || 'Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275'
  );

  // Akun Manajemen State
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [myUsername, setMyUsername] = useState(currentUser?.username || '');
  const [myNewPassword, setMyNewPassword] = useState('');
  const [myConfirmPassword, setMyConfirmPassword] = useState('');
  const [showMyPassword, setShowMyPassword] = useState(false);
  const [myCredMessage, setMyCredMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Tambah / Edit Akun
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [formId, setFormId] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'ADMIN' | 'PETUGAS'>('PETUGAS');
  const [formGender, setFormGender] = useState<'IKHWAN' | 'AKHWAT'>('IKHWAN');
  const [formStatusAktif, setFormStatusAktif] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Status Integrasi Sheet
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [formulaResult, setFormulaResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [relationalMigration, setRelationalMigration] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'; message: string;
  }>({ status: 'idle', message: '' });

  const handleRelationalMigration = async () => {
    if (currentUser?.role !== 'ADMIN') return;
    const confirmed = window.confirm(
      'Jalankan salinan awal data PESERTA, BATCH, dan IZIN ke tabel relasional D1? Koleksi JSON lama tidak akan dihapus.'
    );
    if (!confirmed) return;
    setRelationalMigration({ status: 'loading', message: 'Memvalidasi data dan menyalin record ke tabel relasional…' });
    const result = await d1MigrateRelationalCollections();
    setRelationalMigration({ status: result.success ? 'success' : 'error', message: result.message });
  };

  const loadAccounts = () => {
    setAccounts(getUserAccounts());
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Handler Simpan Kredensial Saya
  const handleUpdateMyCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setMyCredMessage(null);

    if (!currentUser) return;
    if (myNewPassword && myNewPassword !== myConfirmPassword) {
      setMyCredMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok!' });
      return;
    }

    const res = await changeStaffCredentials(
      currentUser.id,
      myUsername.trim(),
      myNewPassword.trim() || undefined
    );

    if (res.success) {
      setMyCredMessage({ type: 'success', text: res.message });
      setMyNewPassword('');
      setMyConfirmPassword('');
      loadAccounts();
      setTimeout(() => setMyCredMessage(null), 4000);
    } else {
      setMyCredMessage({ type: 'error', text: res.message });
    }
  };

  // Buka Modal Tambah Akun
  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    const newId = `U${String(accounts.length + 1).padStart(3, '0')}`;
    setFormId(newId);
    setFormNama('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('PETUGAS');
    setFormGender('IKHWAN');
    setFormStatusAktif(true);
    setFormError(null);
    setShowFormPassword(false);
    setModalOpen(true);
  };

  // Buka Modal Edit Akun
  const handleOpenEditAccount = (acc: UserAccount) => {
    setEditingAccount(acc);
    setFormId(acc.id);
    setFormNama(acc.namaLengkap);
    setFormUsername(acc.username);
    setFormPassword('');
    setFormRole(acc.role);
    setFormGender(acc.gender || 'IKHWAN');
    setFormStatusAktif(acc.statusAktif);
    setFormError(null);
    setShowFormPassword(false);
    setModalOpen(true);
  };

  // Simpan Akun Baru / Edit
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formUsername.trim()) {
      setFormError('Username tidak boleh kosong!');
      return;
    }
    if (!formNama.trim()) {
      setFormError('Nama lengkap tidak boleh kosong!');
      return;
    }
    if (!editingAccount && !formPassword.trim()) {
      setFormError('Password wajib diisi untuk akun baru!');
      return;
    }
    if (formPassword.trim() && formPassword.trim().length < 12) {
      setFormError('Password minimal 12 karakter.');
      return;
    }

    const acc: UserAccount = {
      id: formId,
      username: formUsername.trim().toLowerCase(),
      namaLengkap: formNama.trim(),
      password: formPassword.trim(),
      passwordHash: formPassword.trim(),
      role: formRole,
      gender: formGender,
      statusAktif: formStatusAktif,
    };

    const res = await saveUserAccount(acc);
    if (res.success) {
      setModalOpen(false);
      loadAccounts();
    } else {
      setFormError(res.message);
    }
  };

  // Hapus Akun
  const handleDeleteAccount = async (id: string) => {
    const res = await deleteUserAccount(id);
    setDeletingId(null);
    if (!res.success) {
      alert(res.message);
    } else {
      loadAccounts();
    }
  };

  // Simpan Konfigurasi Umum
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfig({
      backendUrl: backendUrl.trim(),
      namaPesma,
      alamatPesma: alamatPesma.trim(),
    });
    alert('Pengaturan nama dan alamat Pesma berhasil disimpan!');
  };

  // Pasang Formula
  const handleInstallFormulas = async () => {
    if (!backendUrl.trim()) {
      alert('Masukkan URL Google Apps Script terlebih dahulu!');
      return;
    }
    setFormulaResult({ status: 'loading', message: 'Memasang formula rekapan ke Google Sheets...' });
    const res = await initRekapFormulasInSheet(backendUrl);
    if (res.success) {
      setFormulaResult({ status: 'success', message: res.message });
    } else {
      setFormulaResult({ status: 'error', message: res.message });
    }
  };

  // Uji Ping
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
          message: `Endpoint merespons, namun gagal: ${data.message || 'Cek deployment Apps Script'}`,
        });
      }
    } catch (err: unknown) {
      setTestResult({
        status: 'error',
        message: `Koneksi Gagal: ${(err as Error).message}. Pastikan Web App di-deploy dengan akses 'Anyone'`,
      });
    }
  };

  const copyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* Header Halaman */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Pengaturan Sistem &amp; Akun Login</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola kredensial login akun admin/musyrif dan integrasi backend Google Sheets.
          </p>
        </div>

        {/* Subtle Background Sync Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold shrink-0 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Cloudflare D1 Backend Aktif</span>
        </div>
      </div>

      {/* 1. SEKSI GANTI USERNAME & PASSWORD AKUN SAYA */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-800">
              Kredensial Akun Saya ({currentUser?.namaLengkap})
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Ubah username atau password login akun yang sedang Anda gunakan saat ini.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateMyCredentials} className="space-y-3.5 text-xs">
          {myCredMessage && (
            <div
              className={`p-3 rounded-xl border font-bold flex items-center gap-2 ${
                myCredMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {myCredMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{myCredMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Username Anda
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={myUsername}
                  onChange={(e) => setMyUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Password Baru (Opsional)
              </label>
              <div className="relative flex items-center">
                <input
                  type={showMyPassword ? 'text' : 'password'}
                  value={myNewPassword}
                  onChange={(e) => setMyNewPassword(e.target.value)}
                  placeholder="Kosongkan bila tidak ganti"
                  className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowMyPassword(!showMyPassword)}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showMyPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Konfirmasi Password Baru
              </label>
              <input
                type={showMyPassword ? 'text' : 'password'}
                value={myConfirmPassword}
                onChange={(e) => setMyConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl glass-btn-emerald text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Kredensial Saya</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. SEKSI MANAJEMEN SEMUA AKUN PENGGUNA (ADMIN & PETUGAS) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-slate-800">
                Kelola Semua Akun Login (Admin &amp; Petugas Musyrif)
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                Tambah akun baru, ubah peran, atau reset kata sandi staf asrama.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAddAccount}
            className="self-start sm:self-auto h-8 sm:h-9 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah Akun Baru</span>
          </button>
        </div>

        {/* Tabel Akun */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/70">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f2f7f4] text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4">ID</th>
                <th className="p-3">Username</th>
                <th className="p-3">Nama Lengkap</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {accounts.map((acc) => {
                const isCurrent = currentUser?.id === acc.id;
                return (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 pl-4 font-mono font-bold text-slate-600">{acc.id}</td>
                    <td className="p-3 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{acc.username}</span>
                        {isCurrent && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Anda
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{acc.namaLengkap}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          acc.role === 'ADMIN'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-teal-100 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {acc.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.statusAktif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {acc.statusAktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-3 pr-4 text-right">
                      {deletingId === acc.id ? (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2 py-1 rounded-xl">
                          <span className="text-[10px] font-bold text-rose-700">Hapus?</span>
                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Ya
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditAccount(acc)}
                            title="Edit Akun"
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(acc.id)}
                            title="Hapus Akun"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Migrasi awal ke tabel relasional D1 — khusus Admin */}
      {currentUser?.role === 'ADMIN' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-slate-800">Migrasi Awal Tabel Relasional D1</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                Menyalin PESERTA, BATCH, dan IZIN ke tabel SQL sambil mempertahankan koleksi JSON lama.
              </p>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Jalankan satu kali setelah migrasi skema <code>0005_relational_payloads.sql</code> diterapkan di database D1. Proses ini mempertahankan ID dan payload asli, serta tidak menghapus data yang sudah ada.
          </p>
          <button
            type="button"
            onClick={handleRelationalMigration}
            disabled={relationalMigration.status === 'loading'}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {relationalMigration.status === 'loading' ? 'Sedang memigrasikan…' : 'Migrasikan PESERTA, BATCH, IZIN'}
          </button>
          {relationalMigration.message && (
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
              relationalMigration.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : relationalMigration.status === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
            }`} role="status">
              {relationalMigration.message}
            </div>
          )}
        </div>
      )}

      {/* 3. KONFIGURASI GOOGLE APPS SCRIPT & FORMULA */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
            <Link className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-800">
              Integrasi Google Sheets &amp; Apps Script Kampus
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Sinkronisasi data kehadiran langsung ke Google Spreadsheet UNISA Bandung.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Google Apps Script Web App URL</span>
              <span className="text-[10px] text-slate-400">Format: https://script.google.com/macros/s/.../exec</span>
            </label>
            <input
              type="url"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="w-full p-2.5 border border-slate-300 bg-white text-slate-800 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nama Pesantren Mahasiswa (PESMA)
              </label>
              <input
                type="text"
                value={namaPesma}
                onChange={(e) => setNamaPesma(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Alamat Resmi Pesma UNISA Bandung
              </label>
              <input
                type="text"
                value={alamatPesma}
                onChange={(e) => setAlamatPesma(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={handleTestConnection}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Uji Koneksi Backend
            </button>
            <button
              type="button"
              onClick={handleInstallFormulas}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Pasang 4 Formula ke Sheet</span>
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer ml-auto"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>

        {formulaResult.status !== 'idle' && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              formulaResult.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {formulaResult.status === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <p className="font-semibold">{formulaResult.message}</p>
          </div>
        )}

        {testResult.status !== 'idle' && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              testResult.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {testResult.status === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <p className="font-semibold">{testResult.message}</p>
          </div>
        )}
      </div>

      {/* 4. PANDUAN PENYIAPAN GOOGLE APPS SCRIPT */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-700" />
            <h2 className="font-bold text-xs sm:text-sm text-slate-800">Kode Google Apps Script (.GS)</h2>
          </div>
          <button
            onClick={copyAppsScript}
            className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? 'Tersalin!' : 'Salin Kode'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Tempelkan kode di bawah ini pada Google Sheets &gt; Extensions &gt; Apps Script, lalu deploy sebagai Web App dengan akses &quot;Anyone&quot;.
        </p>

        <div className="max-h-48 overflow-y-auto bg-slate-900 text-emerald-300 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed">
          <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
        </div>
      </div>

      {/* 5. INFORMASI PENGEMBANG */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 shadow-xs space-y-2">
        <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Informasi Pengembang Aplikasi</span>
        </h3>
        <div className="p-3 rounded-xl bg-[#f4f8f5] border border-emerald-200/60 text-xs space-y-1">
          <p className="font-bold text-slate-800">
            Developer: <span className="text-emerald-800 font-black">M. Ridhwan Mubarok</span> (NIM: 200125016)
          </p>
          <p className="text-slate-600">
            Program Studi: Mahasiswa S1 Desain Komunikasi Visual (DKV) 2025 • Universitas ‘Aisyiyah Bandung
          </p>
        </div>
      </div>

      {/* MODAL FORM TAMBAH / EDIT AKUN PENGGUNA */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                  {editingAccount ? 'Edit Akun Staf' : 'Tambah Akun Pengguna Baru'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3 pt-3 text-xs font-semibold">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs text-center font-bold">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 mb-1">Nama Lengkap &amp; Gelar *</label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Mochamad Ridhwan Mubarok"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 mb-1">Username Login *</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Contoh: ridhwan"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Password Login *</label>
                  <div className="relative flex items-center">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Password..."
                      className="w-full pl-3 pr-7 py-2 rounded-xl border border-slate-200 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 mb-1">Role / Peran</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as 'ADMIN' | 'PETUGAS')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="PETUGAS">PETUGAS (Musyrif)</option>
                    <option value="ADMIN">ADMIN (Pengurus)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Kategori Gender</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as 'IKHWAN' | 'AKHWAT')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="IKHWAN">IKHWAN (Musyrif)</option>
                    <option value="AKHWAT">AKHWAT (Musyrifah)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-slate-800 font-bold">Status Akun Aktif</p>
                  <p className="text-[10px] text-slate-400 font-normal">Akun nonaktif tidak dapat login ke sistem</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormStatusAktif(!formStatusAktif)}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 cursor-pointer ${
                    formStatusAktif ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl glass-btn-emerald text-white font-bold cursor-pointer shadow-md"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
