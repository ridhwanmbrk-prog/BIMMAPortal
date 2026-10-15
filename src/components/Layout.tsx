import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Users,
  FileCheck2,
  FileQuestion,
  CreditCard,
  Sliders,
  LogOut,
  TableProperties,
  Layers,
  FileText,
  Bell,
  UserCheck,
  Menu,
  X,
  ChevronRight,
  Download,
  Upload,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { UserRole, Absensi, Izin, Pembenaran, Peserta } from '../types';
import { getCurrentUser, getItems, getConfig, getPendingKedatanganIzin } from '../storage';
import { pushAbsensiToSheet, pushSantriToSheet } from '../sheetApi';
import { exportAttendancePdf } from '../utils/exportAttendancePdf';
import { importStudentsFromSpreadsheet, downloadStudentTemplate } from '../utils/studentImportExport';
import { UnisaLogo } from './UnisaLogo';

export type PageId =
  | 'dashboard'
  | 'rekap-tabel'
  | 'jadwal'
  | 'petugas'
  | 'batch'
  | 'peserta'
  | 'izin'
  | 'pembenaran'
  | 'laporan-alfa'
  | 'kartu-peserta'
  | 'biodata-mahasiswa'
  | 'peserta-portal'
  | 'pengaturan';

interface LayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
  onOpenScanner: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
  category?: 'UTAMA' | 'DATA & JADWAL' | 'ACC & IZIN' | 'SISTEM';
}

export const Layout: React.FC<LayoutProps> = ({
  currentPage,
  onNavigate,
  onLogout,
  onOpenScanner,
  children,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ show: boolean; success: boolean; message: string }>({
    show: false,
    success: true,
    message: '',
  });
  const mainScrollRef = useRef<HTMLElement | null>(null);



  const currentUser = getCurrentUser();
  const userRole: UserRole = currentUser?.role || 'PETUGAS';

  // Hitung jumlah hal yang perlu tindakan secara realtime
  const izinList = getItems<Izin>('IZIN');
  const pembenaranList = getItems<Pembenaran>('PEMBENARAN');
  const pendingKedatanganList = getPendingKedatanganIzin();

  const pendingIzinCount = izinList.filter((i) => i.statusPersetujuan === 'MENUNGGU').length;
  const pendingPbCount = pembenaranList.filter((p) => p.statusPersetujuan === 'MENUNGGU').length;
  const overdueKedatanganCount = pendingKedatanganList.filter((k) => k.isOverdue).length;
  const totalPerluTindakan = pendingIzinCount + pendingPbCount + overdueKedatanganCount;

  const handlePushToGoogleSheet = async () => {
    const config = getConfig();
    if (!config.backendUrl) {
      alert('URL Google Apps Script Web App belum diatur di menu Pengaturan!');
      return;
    }

    setIsSyncing(true);
    const absensiList = getItems<Absensi>('ABSENSI');
    const res = await pushAbsensiToSheet(config.backendUrl, absensiList);
    setIsSyncing(false);

    setSyncToast({
      show: true,
      success: res.success,
      message: res.message || (res.success ? 'Presensi berhasil disinkronkan ke Google Sheet!' : 'Gagal sinkron ke Google Sheet.'),
    });

    setTimeout(() => {
      setSyncToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  const handleDownloadPdf = () => {
    exportAttendancePdf();
  };

  // Handler Upload Spreadsheet Santri Bulk
  const fileInputPesertaRef = useRef<HTMLInputElement | null>(null);

  const handleUploadSpreadsheetPeserta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    const res = await importStudentsFromSpreadsheet(file);
    setIsSyncing(false);

    setSyncToast({
      show: true,
      success: res.success,
      message: res.message,
    });

    // Beritahu PesertaPage agar memperbarui state tabelnya secara realtime
    window.dispatchEvent(new CustomEvent('bimma_refresh_peserta'));

    setTimeout(() => {
      setSyncToast((prev) => ({ ...prev, show: false }));
    }, 4500);

    if (fileInputPesertaRef.current) {
      fileInputPesertaRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    downloadStudentTemplate();
    setSyncToast({
      show: true,
      success: true,
      message: 'Template Excel (Template_Upload_Santri_BIMMA.xlsx) berhasil diunduh!',
    });
    setTimeout(() => {
      setSyncToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  const handlePushSantriToSheet = async () => {
    const config = getConfig();
    if (!config.backendUrl) {
      alert('URL Google Apps Script Web App belum diatur di menu Pengaturan!');
      return;
    }

    setIsSyncing(true);
    const pesertaList = getItems<Peserta>('PESERTA');
    const res = await pushSantriToSheet(config.backendUrl, pesertaList);
    setIsSyncing(false);

    setSyncToast({
      show: true,
      success: res.success,
      message: res.message || (res.success ? 'Data santri berhasil dikirim ke Google Sheet!' : 'Gagal kirim ke Google Sheet.'),
    });

    setTimeout(() => {
      setSyncToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  // Navigation Items
  const allNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: userRole === 'PESERTA' ? 'Portal Santri Saya' : userRole === 'PETUGAS' ? 'Dashboard Petugas' : 'Dashboard Absen & ACC',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'PETUGAS'],
    },
    {
      id: 'peserta-portal',
      label: 'Portal Kehadiran Santri',
      icon: LayoutDashboard,
      roles: ['PESERTA'],
    },
    {
      id: 'laporan-alfa',
      label: 'Laporan Belum Absen',
      icon: Bell,
      roles: ['PETUGAS', 'ADMIN'],
    },
    {
      id: 'rekap-tabel',
      label: 'Tabel Presensi Harian',
      icon: TableProperties,
      roles: ['ADMIN'],
    },
    {
      id: 'jadwal',
      label: 'Kelola Kegiatan & Jadwal',
      icon: Clock,
      roles: ['ADMIN', 'PETUGAS'],
    },
    {
      id: 'petugas',
      label: 'Kelola Petugas Musyrif',
      icon: UserCheck,
      roles: ['ADMIN'],
    },
    {
      id: 'batch',
      label: '3 Batch & Kalender',
      icon: Layers,
      roles: ['ADMIN'],
    },
    {
      id: 'peserta',
      label: 'Data Santri BIMMA',
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      id: 'izin',
      label: 'ACC & Data Izin',
      icon: FileCheck2,
      roles: ['ADMIN', 'PETUGAS'],
    },
    {
      id: 'pembenaran',
      label: 'ACC Telat & Lupa Presensi',
      icon: FileQuestion,
      roles: ['ADMIN', 'PETUGAS'],
    },
    {
      id: 'kartu-peserta',
      label: 'Cetak Kartu & QR Santri',
      icon: CreditCard,
      roles: ['ADMIN'],
    },
    {
      id: 'biodata-mahasiswa',
      label: 'Formulir Biodata Santri',
      icon: FileText,
      roles: ['ADMIN'],
      badge: 'Form',
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan Sistem & Akun',
      icon: Sliders,
      roles: ['ADMIN'],
    },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(userRole));

  const getPageTitle = (p: PageId): string => {
    const found = allNavItems.find((i) => i.id === p);
    return found ? found.label : 'BIMMA Attendance';
  };

  const handleNavigate = (page: PageId) => {
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-black tracking-wider uppercase border border-emerald-300">
            ADMIN
          </span>
        );
      case 'PETUGAS':
        return (
          <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[9px] sm:text-[10px] font-black tracking-wider uppercase border border-teal-300">
            PETUGAS
          </span>
        );
      case 'PESERTA':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[9px] sm:text-[10px] font-black tracking-wider uppercase border border-blue-300">
            MAHASANTRI
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#edf3ef] flex flex-col md:flex-row items-center justify-center p-0 md:p-3 lg:p-5 font-sans select-none">
      {/* Outer Curved Canvas (Putih & Hijau UNISA) */}
      <div className="w-full md:max-w-[1540px] min-h-screen md:min-h-[720px] md:h-[94vh] bg-[#f4f8f5] md:rounded-[32px] md:shadow-[16px_20px_40px_rgba(160,190,175,0.45),-12px_-12px_32px_rgba(255,255,255,0.95)] md:border md:border-white/80 flex flex-col md:flex-row overflow-hidden relative">

        {/* DESKTOP SIDEBAR: MENU DI SAMPING UNTUK ADMIN (DENGAN TEKS & IKON) */}
        <aside className="hidden md:flex flex-col w-60 lg:w-64 sidebar-emerald text-white my-3 ml-3 rounded-[24px] shrink-0 py-4 px-3 justify-between z-30 shadow-xl border border-emerald-700/50">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header Brand Sidebar */}
            <div
              onClick={() => handleNavigate(userRole === 'PESERTA' ? 'peserta-portal' : 'dashboard')}
              className="flex items-center gap-2.5 p-2 rounded-2xl bg-white/10 hover:bg-white/15 transition cursor-pointer mb-3 shrink-0"
              title="Universitas 'Aisyiyah Bandung - BIMMA"
            >
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center p-1 shrink-0">
                <UnisaLogo size={30} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-black tracking-tight text-white uppercase leading-tight truncate">
                  BIMMA PORTAL
                </h2>
                <p className="text-[10px] text-emerald-200 font-semibold truncate">
                  PESMA UNISA Bandung
                </p>
                <div className="mt-0.5">
                  {getRoleBadge(userRole)}
                </div>
              </div>
            </div>

            {/* Menu Navigasi Samping Lengkap */}
            <nav className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const path = item.id === 'dashboard' ? '/' : `/${item.id}`;
                return (
                  <a
                    key={item.id}
                    href={path}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigate(item.id);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left group ${
                      isActive
                        ? 'bg-white text-emerald-950 font-black shadow-md scale-101'
                        : 'text-emerald-100 hover:bg-white/12 hover:text-white font-medium'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-800' : 'text-emerald-300 group-hover:text-white'}`} />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white shrink-0 shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </nav>

            {/* Footer Sidebar */}
            <div className="pt-3 mt-2 border-t border-emerald-700/50 flex items-center justify-between shrink-0 px-1">
              <div className="text-[10px] text-emerald-200/80 font-semibold truncate">
                Pesma UNISA 2026
              </div>
              <button
                onClick={onLogout}
                title="Keluar"
                className="p-1.5 rounded-lg text-emerald-200 hover:text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* MOBILE DRAWER SIDE MENU (Off-canvas Drawer untuk Mobile Admin) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer Content */}
            <div className="relative w-72 max-w-[85vw] h-full sidebar-emerald text-white p-4 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-emerald-700/50 mb-3">
                  <div className="flex items-center gap-2">
                    <UnisaLogo size={32} />
                    <div>
                      <h3 className="font-black text-xs text-white leading-tight">BIMMA PORTAL</h3>
                      <p className="text-[10px] text-emerald-200">Pesma UNISA Bandung</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar pr-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    const path = item.id === 'dashboard' ? '/' : `/${item.id}`;
                    return (
                      <a
                        key={item.id}
                        href={path}
                        onClick={(e) => {
                          e.preventDefault();
                          handleNavigate(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition cursor-pointer text-left ${
                          isActive
                            ? 'bg-white text-emerald-950 font-black shadow-md'
                            : 'text-emerald-100 hover:bg-white/15'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-800' : 'text-emerald-300'}`} />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-3 border-t border-emerald-700/50 flex items-center justify-between">
                <span className="text-[11px] text-emerald-200 font-bold truncate">
                  {currentUser?.namaLengkap}
                </span>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN VIEWPORT */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* TOPBAR HEADER */}
          <header className="h-13 sm:h-16 px-2.5 sm:px-6 flex items-center justify-between shrink-0 border-b border-emerald-900/10 bg-white/85 backdrop-blur-md relative z-20 gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
              {/* Tombol Hamburger Drawer di Mobile */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 cursor-pointer shrink-0 transition"
                title="Buka Menu Samping"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="md:hidden shrink-0">
                <UnisaLogo size={28} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] sm:text-[10px] font-bold text-emerald-800 uppercase tracking-wider truncate">
                    BIMMA Portal
                  </p>
                  {getRoleBadge(userRole)}
                </div>
                <h1 className="text-xs sm:text-base lg:text-lg font-black text-slate-800 tracking-tight truncate mt-0.5">
                  {getPageTitle(currentPage)}
                </h1>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* CTA Sinkron ke Google Sheet & Download PDF untuk Admin - Hanya tampil di tab Tabel Presensi Harian */}
              {userRole === 'ADMIN' && currentPage === 'rekap-tabel' && (
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    onClick={handlePushToGoogleSheet}
                    disabled={isSyncing}
                    className="w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-3 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                    title="Sinkronkan Presensi ke Google Sheets"
                  >
                    <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Sinkron ke Sheet</span>
                  </button>

                  <button
                    onClick={handleDownloadPdf}
                    className="w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Download Laporan PDF"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                </div>
              )}

              {/* CTA Upload Sheet, Template, & Kirim ke Sheet untuk Admin - Samping Profil di Tab Data Santri BIMMA */}
              {userRole === 'ADMIN' && currentPage === 'peserta' && (
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <input
                    type="file"
                    ref={fileInputPesertaRef}
                    onChange={handleUploadSpreadsheetPeserta}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />

                  {/* Unduh Template Spreadsheet */}
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-3 rounded-full bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Unduh Template Excel/Spreadsheet Santri BIMMA"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="hidden sm:inline">Template</span>
                  </button>

                  {/* Upload Data Spreadsheet Bulk */}
                  <button
                    onClick={() => fileInputPesertaRef.current?.click()}
                    disabled={isSyncing}
                    className="w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-3.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                    title="Upload Data Santri Bulk via Spreadsheet"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Upload Sheet</span>
                  </button>

                  {/* Kirim ke Google Sheet */}
                  <button
                    onClick={handlePushSantriToSheet}
                    disabled={isSyncing}
                    className="w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-3 rounded-full bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                    title="Kirim Data Santri ke Google Sheet"
                  >
                    <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden md:inline">Kirim ke Sheet</span>
                  </button>
                </div>
              )}

              {/* Bell Notifikasi dengan Badge Jumlah Item Perlu Tindakan - Hanya tampil di tab Laporan Belum Absen */}
              {currentPage === 'laporan-alfa' && (
                <div className="relative">
                  <button
                    onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                    className="relative p-2 rounded-full bg-white hover:bg-slate-100 border border-emerald-200/60 text-slate-700 transition cursor-pointer shadow-xs"
                    title={totalPerluTindakan > 0 ? `${totalPerluTindakan} item perlu tindakan` : 'Notifikasi'}
                  >
                    <Bell className="w-4 h-4 text-emerald-800" />
                    {totalPerluTindakan > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-pulse">
                        {totalPerluTindakan}
                      </span>
                    )}
                  </button>

                  {notifDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-black/10"
                        onClick={() => setNotifDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-2.5 z-50 text-xs animate-in fade-in zoom-in-95">
                        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                          <span className="font-bold text-slate-800">Perlu Tindakan & Notifikasi</span>
                          {totalPerluTindakan > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
                              {totalPerluTindakan} Tindakan
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Semua Beres
                            </span>
                          )}
                        </div>

                        <div className="py-1 divide-y divide-slate-100 max-h-64 overflow-y-auto">
                          {totalPerluTindakan === 0 ? (
                            <div className="p-4 text-center text-slate-400">
                              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                              <p className="font-semibold text-[11px]">Tidak ada yang perlu tindakan saat ini.</p>
                            </div>
                          ) : (
                            <>
                              {pendingIzinCount > 0 && (
                                <button
                                  onClick={() => {
                                    setNotifDropdownOpen(false);
                                    handleNavigate('izin');
                                  }}
                                  className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition flex items-start gap-2.5 cursor-pointer"
                                >
                                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                  <div>
                                    <p className="font-bold text-slate-800">
                                      {pendingIzinCount} Pengajuan Izin Menunggu ACC
                                    </p>
                                    <p className="text-[10px] text-slate-500">Klik untuk meninjau dan setujui surat izin santri.</p>
                                  </div>
                                </button>
                              )}

                              {pendingPbCount > 0 && (
                                <button
                                  onClick={() => {
                                    setNotifDropdownOpen(false);
                                    handleNavigate('pembenaran');
                                  }}
                                  className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition flex items-start gap-2.5 cursor-pointer"
                                >
                                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                  <div>
                                    <p className="font-bold text-slate-800">
                                      {pendingPbCount} Pengajuan Koreksi Hadir Telat
                                    </p>
                                    <p className="text-[10px] text-slate-500">Pengajuan dari musyrif menunggu ACC Admin.</p>
                                  </div>
                                </button>
                              )}

                              {overdueKedatanganCount > 0 && (
                                <button
                                  onClick={() => {
                                    setNotifDropdownOpen(false);
                                    handleNavigate('dashboard');
                                  }}
                                  className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition flex items-start gap-2.5 cursor-pointer"
                                >
                                  <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                  <div>
                                    <p className="font-bold text-slate-800">
                                      {overdueKedatanganCount} Santri Terlambat Kembali ke Asrama
                                    </p>
                                    <p className="text-[10px] text-slate-500">Batas izin telah lewat, perlu verifikasi kedatangan.</p>
                                  </div>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Profile Avatar with Dropdown Logout */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-1.5 p-1 rounded-full bg-white shadow-xs border border-emerald-200/60 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#10b981] to-[#047857] text-white flex items-center justify-center font-bold text-[11px] sm:text-xs shadow-inner">
                    {currentUser?.username?.slice(0, 2).toUpperCase() || 'US'}
                  </div>
                  <span className="hidden lg:inline text-xs font-bold text-slate-800 pr-1 truncate max-w-[100px]">
                    {currentUser?.namaLengkap?.split(' ')[0] || 'Pengguna'}
                  </span>
                </button>

                {profileDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/10"
                      onClick={() => setProfileDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-52 sm:w-56 bg-white rounded-2xl shadow-2xl border border-emerald-100 p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                      <div className="px-3 py-2 border-b border-emerald-100">
                        <p className="font-bold text-slate-800 truncate">
                          {currentUser?.namaLengkap}
                        </p>
                        <div className="mt-1">
                          {getRoleBadge(userRole)}
                        </div>
                      </div>

                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            handleNavigate('pengaturan');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-emerald-50 font-medium transition cursor-pointer flex items-center justify-between"
                        >
                          <span>Pengaturan Sistem &amp; Akun</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold transition flex items-center gap-2 mt-1 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* SCROLLABLE MAIN CONTENT AREA DENGAN PADDING BOTTOM AMAN UNTUK MOBILE FAB */}
          <main
            ref={mainScrollRef}
            id="main-content-scroll"
            className="flex-1 overflow-y-auto px-2.5 sm:px-5 lg:px-7 pt-3 sm:pt-5 pb-24 sm:pb-10 custom-scrollbar text-slate-800"
          >
            {children}

            {/* Professional Left-Aligned Footer with BIMMA Logo */}
            <footer className="mt-12 pt-6 pb-6 border-t border-emerald-900/10 text-left text-slate-700">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                {/* Left Brand Column */}
                <div className="flex items-start gap-3.5 max-w-xl">
                  <div className="w-12 h-12 rounded-2xl bg-white p-2 shadow-xs border border-emerald-200/80 shrink-0 flex items-center justify-center">
                    <UnisaLogo size={36} />
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-slate-800 tracking-tight">
                        BIMMA PORTAL
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                        Official System
                      </span>
                    </div>
                    <p className="text-xs font-bold text-emerald-800">
                      Pesantren Mahasiswa (PESMA) • Universitas 'Aisyiyah Bandung
                    </p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Sistem Informasi Presensi Digital, Rekapitulasi Kegiatan Asrama, Verifikasi Izin Ber-QR Code, dan Manajemen Mahasantri Terintegrasi.
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275
                    </p>
                  </div>
                </div>

                {/* Right / Developer Credit Column */}
                <div className="flex flex-col items-start md:items-end justify-between md:justify-end gap-1 text-left md:text-right shrink-0">
                  <p className="text-xs font-bold text-slate-700">
                    Pengembang Aplikasi:
                  </p>
                  <p className="text-xs font-extrabold text-emerald-800">
                    M. Ridhwan Mubarok <span className="font-mono text-slate-500 font-semibold">(200125016)</span>
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Mahasiswa S1 Desain Komunikasi Visual (DKV) Angkatan 2025
                  </p>
                  <p className="text-[10px] text-slate-400 pt-1">
                    © 2026 PESMA Universitas 'Aisyiyah Bandung. Seluruh hak cipta dilindungi undang-undang.
                  </p>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};
