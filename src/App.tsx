import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from './types';
import { getCurrentUser, setCurrentUser, initLocalStorageIfEmpty, syncWithCloudflareD1, syncDatabaseState, getD1WriteError, getD1MigrationWarning } from './storage';
import { clearD1Session, d1Logout } from './services/d1Storage';
import { Layout, PageId } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TabelPresensiHarianPage } from './pages/TabelPresensiHarianPage';
import { JadwalPage } from './pages/JadwalPage';
import { PetugasPage } from './pages/PetugasPage';
import { LaporanHarianAlfaPage } from './pages/LaporanHarianAlfaPage';
import { BatchPage } from './pages/BatchPage';
import { PesertaPage } from './pages/PesertaPage';
import { IzinPage } from './pages/IzinPage';
import { PembenaranPage } from './pages/PembenaranPage';
import { KartuPesertaPage } from './pages/KartuPesertaPage';
import { FormBiodataMahasiswaPage } from './pages/FormBiodataMahasiswaPage';
import { PesertaPortalPage } from './pages/PesertaPortalPage';
import { PengaturanPage } from './pages/PengaturanPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CameraScannerModal, ScannerMode } from './components/CameraScannerModal';

const VALID_PAGES: PageId[] = [
  'dashboard',
  'rekap-tabel',
  'jadwal',
  'petugas',
  'batch',
  'peserta',
  'izin',
  'pembenaran',
  'laporan-alfa',
  'kartu-peserta',
  'biodata-mahasiswa',
  'peserta-portal',
  'pengaturan',
];

type RouteState =
  | { type: 'PAGE'; pageId: PageId }
  | { type: 'PUBLIC_FORM' }
  | { type: 'LOGIN' }
  | { type: 'NOT_FOUND'; path: string };

/**
 * Menerjemahkan pathname URL bersih ke RouteState sistem
 */
function parsePathToRoute(pathname: string): RouteState {
  // Bersihkan trailing slash kecuali root
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (clean === '/' || clean === '') {
    return { type: 'LOGIN' };
  }
  if (clean === '/login') {
    return { type: 'LOGIN' };
  }
  if (clean === '/biodata' || clean === '/biodata-mahasiswa') {
    return { type: 'PUBLIC_FORM' };
  }

  const potentialPage = clean.replace(/^\//, '') as PageId;
  if (VALID_PAGES.includes(potentialPage)) {
    return { type: 'PAGE', pageId: potentialPage };
  }

  return { type: 'NOT_FOUND', path: clean };
}

/**
 * Menghasilkan URL path bersih dari PageId
 */
function pageIdToPath(pageId: PageId): string {
  if (pageId === 'biodata-mahasiswa') return '/biodata-mahasiswa';
  return `/${pageId}`;
}

export default function App() {
  const [currentUser, setUser] = useState<User | null>(() => {
    initLocalStorageIfEmpty();
    return getCurrentUser();
  });
  const [isD1Bootstrapping, setIsD1Bootstrapping] = useState<boolean>(() => Boolean(getCurrentUser()));
  const [d1BootError, setD1BootError] = useState<string | null>(null);
  const [d1WriteError, setD1WriteError] = useState<string | null>(() => getD1WriteError());
  const [d1MigrationWarning, setD1MigrationWarning] = useState<string | null>(() => getD1MigrationWarning());
  const d1HydratedUserRef = useRef<string | null>(null);

  // State Routing Berbasis Path
  const [routeState, setRouteState] = useState<RouteState>(() => {
    // 1. Cek & Migrasi URL Hash lama jika ada (#laporan-alfa -> /laporan-alfa)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) {
        if (hash === 'biodata') {
          window.history.replaceState(null, '', '/biodata-mahasiswa');
        } else if (VALID_PAGES.includes(hash as PageId)) {
          window.history.replaceState(null, '', `/${hash}`);
        }
      }
      return parsePathToRoute(window.location.pathname);
    }
    return { type: 'LOGIN' };
  });

  // Menyimpan intended target route bila user belum login saat membuka deep link
  const [intendedRoute, setIntendedRoute] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p !== '/' && p !== '/login' && p !== '/biodata-mahasiswa' && p !== '/biodata') {
        return p;
      }
    }
    return null;
  });

  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerInitialMode, setScannerInitialMode] = useState<ScannerMode>('PRESENSI');

  const handleOpenScanner = (mode: ScannerMode = 'PRESENSI') => {
    setScannerInitialMode(mode);
    setScannerModalOpen(true);
  };

  // Sinkronisasi Route saat Browser Back / Forward ditekan
  const syncRouteWithLocation = useCallback(() => {
    // Tangani kembali hash lama bila ada perubahan hash
    if (window.location.hash) {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash === 'biodata') {
        window.history.replaceState(null, '', '/biodata-mahasiswa');
      } else if (VALID_PAGES.includes(hash as PageId)) {
        window.history.replaceState(null, '', `/${hash}`);
      }
    }
    const currentRoute = parsePathToRoute(window.location.pathname);
    setRouteState(currentRoute);
  }, []);

  useEffect(() => {
    initLocalStorageIfEmpty();
    document.documentElement.classList.remove('dark');
    const onD1WriteStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ error: string | null }>).detail;
      setD1WriteError(detail?.error || null);
    };
    window.addEventListener('bimma:d1-write-status', onD1WriteStatus);
    const onD1MigrationWarning = (event: Event) => {
      const detail = (event as CustomEvent<{ warning: string }>).detail;
      setD1MigrationWarning(detail?.warning || null);
    };
    window.addEventListener('bimma:d1-migration-warning', onD1MigrationWarning);

    // Tangani event navigasi browser Back / Forward (HTML5 History API)
    window.addEventListener('popstate', syncRouteWithLocation);
    window.addEventListener('hashchange', syncRouteWithLocation);

    return () => {
      window.removeEventListener('popstate', syncRouteWithLocation);
      window.removeEventListener('hashchange', syncRouteWithLocation);
      window.removeEventListener('bimma:d1-write-status', onD1WriteStatus);
      window.removeEventListener('bimma:d1-migration-warning', onD1MigrationWarning);
    };
  }, [syncRouteWithLocation]);

  // Saat aplikasi dibuka ulang, token harus divalidasi dan data di-hydrate dari D1
  // sebelum halaman privat dirender. localStorage tidak boleh dipakai sebagai fallback.
  useEffect(() => {
    if (!currentUser) {
      setIsD1Bootstrapping(false);
      return;
    }
    if (d1HydratedUserRef.current === currentUser.id) {
      setIsD1Bootstrapping(false);
      return;
    }

    let cancelled = false;
    setIsD1Bootstrapping(true);
    void (async () => {
      const result = await syncWithCloudflareD1(currentUser.role);
      if (cancelled) return;
      if (!result.success) {
        clearD1Session();
        setCurrentUser(null);
        setUser(null);
        setD1BootError(result.message);
        setIsD1Bootstrapping(false);
        return;
      }
      d1HydratedUserRef.current = currentUser.id;
      syncDatabaseState();
      setD1BootError(null);
      setIsD1Bootstrapping(false);
    })().catch((error: unknown) => {
      if (cancelled) return;
      clearD1Session();
      setCurrentUser(null);
      setUser(null);
      setD1BootError(error instanceof Error ? error.message : 'Gagal memuat data dari D1.');
      setIsD1Bootstrapping(false);
    });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Handler Navigasi Internal dengan Path URL Bersih (PushState)
  const handleNavigatePage = (page: PageId) => {
    const targetPath = pageIdToPath(page);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    setRouteState({ type: 'PAGE', pageId: page });
    localStorage.setItem('bimma_current_page', page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler Login Berhasil
  const handleLoginSuccess = async (user: User) => {
    // The login token is created by D1. Do not enter the application unless its data
    // was successfully loaded (or first-time imported) from the server.
    setIsD1Bootstrapping(true);
    const loaded = await syncWithCloudflareD1(user.role);
    if (!loaded.success) {
      clearD1Session();
      setIsD1Bootstrapping(false);
      throw new Error(loaded.message);
    }
    setCurrentUser(user);
    d1HydratedUserRef.current = user.id;
    syncDatabaseState();
    setD1BootError(null);
    setIsD1Bootstrapping(false);
    setUser(user);

    // Jika sebelumnya user mencoba membuka path tertentu (deep link)
    if (intendedRoute) {
      const targetRoute = parsePathToRoute(intendedRoute);
      setIntendedRoute(null);

      if (targetRoute.type === 'PAGE') {
        // Cek batasan hak akses santri vs admin
        if (user.role === 'PESERTA') {
          handleNavigatePage('peserta-portal');
        } else {
          handleNavigatePage(targetRoute.pageId);
        }
        return;
      }
    }

    // Navigasi default berdasarkan peran
    if (user.role === 'PESERTA') {
      handleNavigatePage('peserta-portal');
    } else {
      const saved = localStorage.getItem('bimma_current_page') as PageId | null;
      const target = saved && VALID_PAGES.includes(saved) && saved !== 'peserta-portal' ? saved : 'dashboard';
      handleNavigatePage(target);
    }
  };

  // Handler Logout
  const handleLogout = () => {
    void d1Logout();
    d1HydratedUserRef.current = null;
    setCurrentUser(null);
    setUser(null);
    localStorage.removeItem('bimma_current_page');
    window.history.pushState(null, '', '/');
    setRouteState({ type: 'LOGIN' });
  };

  // 1. RUTE 404 NOT FOUND (Jika URL di luar daftar rute yang valid)
  if (routeState.type === 'NOT_FOUND') {
    return (
      <NotFoundPage
        currentPath={routeState.path}
        onNavigateHome={() => {
          if (currentUser) {
            handleNavigatePage(currentUser.role === 'PESERTA' ? 'peserta-portal' : 'dashboard');
          } else {
            window.history.pushState(null, '', '/');
            setRouteState({ type: 'LOGIN' });
          }
        }}
        onNavigateLogin={() => {
          window.history.pushState(null, '', '/login');
          setRouteState({ type: 'LOGIN' });
        }}
      />
    );
  }

  // 2. RUTE PUBLIK: FORM BIODATA MAHASISWA MANDIRI (/biodata-mahasiswa atau /biodata)
  if (routeState.type === 'PUBLIC_FORM') {
    return (
      <FormBiodataMahasiswaPage
        onBack={() => {
          if (currentUser) {
            handleNavigatePage(currentUser.role === 'PESERTA' ? 'peserta-portal' : 'dashboard');
          } else {
            window.history.pushState(null, '', '/');
            setRouteState({ type: 'LOGIN' });
          }
        }}
      />
    );
  }

  if (currentUser && isD1Bootstrapping && routeState.type !== 'PUBLIC_FORM') {
    return <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-6 text-center text-emerald-900"><div><div className="text-lg font-bold">Memuat data BIMMA dari Cloudflare D1…</div><div className="mt-2 text-sm">Halaman dibuka setelah data server berhasil diverifikasi.</div></div></div>;
  }

  // 3. JIKA BELUM LOGIN: Tampilkan Halaman Login
  if (!currentUser) {
    return (
      <>
        {d1BootError && <div role="alert" className="mx-auto mt-4 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Sesi/data D1 belum siap: {d1BootError} Silakan login ulang setelah koneksi D1 pulih.</div>}
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
        onOpenPublicForm={() => {
          window.history.pushState(null, '', '/biodata-mahasiswa');
          setRouteState({ type: 'PUBLIC_FORM' });
        }}
        />
      </>
    );
  }

  // Tentukan halaman aktif saat ini
  const activePage: PageId =
    routeState.type === 'PAGE'
      ? routeState.pageId
      : currentUser.role === 'PESERTA'
      ? 'peserta-portal'
      : 'dashboard';

  return (
    <>
      <Layout
        currentPage={activePage}
        onNavigate={handleNavigatePage}
        onLogout={handleLogout}
        onOpenScanner={() => handleOpenScanner('PRESENSI')}
      >
        {d1WriteError && (
          <div role="alert" className="mx-4 mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
            <strong>Perlu perhatian pada penyimpanan D1.</strong> {d1WriteError} Periksa koneksi lalu ulangi perubahan sebelum meninggalkan halaman.
          </div>
        )}
        {d1MigrationWarning && (
          <div role="alert" className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Periksa migrasi akun.</strong> {d1MigrationWarning}
          </div>
        )}
        {/* HALAMAN UTAMA DASHBOARD SESUAI PERAN */}
        {activePage === 'dashboard' && (
          currentUser.role === 'PESERTA' ? (
            <PesertaPortalPage />
          ) : (
            <DashboardPage
              onNavigate={handleNavigatePage}
              onOpenScanner={(mode) => handleOpenScanner(mode || 'PRESENSI')}
            />
          )
        )}

        {/* PORTAL KHUSUS PESERTA (SANTRI) */}
        {activePage === 'peserta-portal' && <PesertaPortalPage />}

        {/* NOTIFIKASI LAPORAN SANTRI BELUM ABSEN (KHUSUS PETUGAS & ADMIN) */}
        {activePage === 'laporan-alfa' && <LaporanHarianAlfaPage />}

        {/* TABEL PRESENSI HARIAN (ADMIN) */}
        {activePage === 'rekap-tabel' && <TabelPresensiHarianPage />}

        {/* JADWAL & KEGIATAN */}
        {activePage === 'jadwal' && <JadwalPage />}

        {/* KELOLA PETUGAS MUSYRIF (ADMIN) */}
        {activePage === 'petugas' && <PetugasPage />}

        {/* BATCH & KALENDER */}
        {activePage === 'batch' && <BatchPage />}

        {/* DATA SANTRI BIMMA (ADMIN) */}
        {activePage === 'peserta' && <PesertaPage />}

        {/* PENGAJUAN & ACC IZIN */}
        {activePage === 'izin' && (
          <IzinPage onOpenScanner={(mode) => handleOpenScanner(mode || 'SURAT_IZIN')} />
        )}

        {/* VERIFIKASI TELAT & LUPA SCAN */}
        {activePage === 'pembenaran' && <PembenaranPage />}

        {/* KARTU SANTRI DIGITAL & CETAK QR */}
        {activePage === 'kartu-peserta' && <KartuPesertaPage />}

        {/* FORM BIODATA MAHASISWA */}
        {activePage === 'biodata-mahasiswa' && (
          <FormBiodataMahasiswaPage
            onBack={() => handleNavigatePage(currentUser.role === 'PESERTA' ? 'peserta-portal' : 'dashboard')}
          />
        )}

        {/* PENGATURAN DATABASE & CLOUDFLARE D1 */}
        {activePage === 'pengaturan' && <PengaturanPage />}
      </Layout>

      {/* DEDICATED CAMERA SCANNER OVERLAY MODAL */}
      <CameraScannerModal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        initialMode={scannerInitialMode}
      />
    </>
  );
}
