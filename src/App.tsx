import React, { useState, useEffect } from 'react';
import { User } from './types';
import { getCurrentUser, setCurrentUser, initLocalStorageIfEmpty } from './storage';
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
import { CameraScannerModal, ScannerMode } from './components/CameraScannerModal';

export default function App() {
  const [currentUser, setUser] = useState<User | null>(() => {
    initLocalStorageIfEmpty();
    return getCurrentUser();
  });
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

  const getInitialPage = (): PageId => {
    const user = getCurrentUser();
    if (user?.role === 'PESERTA') return 'peserta-portal';

    // 1. Cek Hash di URL: misal #petugas, #jadwal, #peserta
    const hashPage = window.location.hash.replace('#', '') as PageId;
    if (hashPage && VALID_PAGES.includes(hashPage)) {
      return hashPage;
    }

    // 2. Cek LocalStorage: agar saat refresh tetap di tab/halaman yang sama
    const saved = localStorage.getItem('bimma_current_page') as PageId | null;
    if (saved && VALID_PAGES.includes(saved)) {
      return saved;
    }

    return 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState<PageId>(getInitialPage);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerInitialMode, setScannerInitialMode] = useState<ScannerMode>('PRESENSI');
  const [isPublicFormView, setIsPublicFormView] = useState(false);

  const handleOpenScanner = (mode: ScannerMode = 'PRESENSI') => {
    setScannerInitialMode(mode);
    setScannerModalOpen(true);
  };

  useEffect(() => {
    initLocalStorageIfEmpty();
    document.documentElement.classList.remove('dark');

    // Support direct public share URL / hash
    if (window.location.hash === '#biodata' || window.location.search.includes('form=biodata')) {
      setIsPublicFormView(true);
    }

    // Sinkronisasi Hash URL saat browser Back/Forward ditekan
    const handleHashChange = () => {
      const hashPage = window.location.hash.replace('#', '') as PageId;
      if (hashPage && VALID_PAGES.includes(hashPage)) {
        const user = getCurrentUser();
        if (user?.role !== 'PESERTA') {
          setCurrentPage(hashPage);
          localStorage.setItem('bimma_current_page', hashPage);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Pastikan URL hash selaras saat pertama mount jika bukan dashboard
  useEffect(() => {
    if (currentUser && currentUser.role !== 'PESERTA') {
      if (currentPage && window.location.hash !== `#${currentPage}`) {
        window.location.hash = currentPage;
      }
      localStorage.setItem('bimma_current_page', currentPage);
    }
  }, [currentPage, currentUser]);

  const handleLoginSuccess = (user: User) => {
    setUser(user);
    setIsPublicFormView(false);
    if (user.role === 'PESERTA') {
      setCurrentPage('peserta-portal');
      localStorage.setItem('bimma_current_page', 'peserta-portal');
      window.location.hash = 'peserta-portal';
    } else {
      const saved = localStorage.getItem('bimma_current_page') as PageId | null;
      const targetPage = saved && VALID_PAGES.includes(saved) && saved !== 'peserta-portal' ? saved : 'dashboard';
      setCurrentPage(targetPage);
      localStorage.setItem('bimma_current_page', targetPage);
      window.location.hash = targetPage;
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
    localStorage.removeItem('bimma_current_page');
    window.location.hash = '';
    setCurrentPage('dashboard');
  };

  // Halaman Khusus Mahasiswa Mandiri (Bisa diakses publik tanpa login)
  if (isPublicFormView) {
    return (
      <FormBiodataMahasiswaPage
        onBack={() => setIsPublicFormView(false)}
      />
    );
  }

  // Jika belum login, tampilkan Login Page (dengan tab Admin/Petugas & Login Peserta via QR)
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onOpenPublicForm={() => setIsPublicFormView(true)}
      />
    );
  }

  const handleNavigatePage = (page: PageId) => {
    setCurrentPage(page);
    localStorage.setItem('bimma_current_page', page);
    window.location.hash = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Layout
        currentPage={currentPage}
        onNavigate={handleNavigatePage}
        onLogout={handleLogout}
        onOpenScanner={() => handleOpenScanner('PRESENSI')}
      >
        {/* HALAMAN UTAMA DASHBOARD SESUAI PERAN */}
        {currentPage === 'dashboard' && (
          currentUser.role === 'PESERTA' ? (
            <PesertaPortalPage />
          ) : (
            <DashboardPage
              onNavigate={setCurrentPage}
              onOpenScanner={(mode) => handleOpenScanner(mode || 'PRESENSI')}
            />
          )
        )}

        {/* PORTAL KHUSUS PESERTA (SANTRI) */}
        {currentPage === 'peserta-portal' && <PesertaPortalPage />}

        {/* NOTIFIKASI LAPORAN SANTRI BELUM ABSEN (KHUSUS PETUGAS & ADMIN) */}
        {currentPage === 'laporan-alfa' && <LaporanHarianAlfaPage />}

        {/* TABEL PRESENSI HARIAN (ADMIN) */}
        {currentPage === 'rekap-tabel' && <TabelPresensiHarianPage />}

        {/* JADWAL & KEGIATAN */}
        {currentPage === 'jadwal' && <JadwalPage />}

        {/* KELOLA PETUGAS MUSYRIF (ADMIN) */}
        {currentPage === 'petugas' && <PetugasPage />}

        {/* BATCH & KALENDER */}
        {currentPage === 'batch' && <BatchPage />}

        {/* DATA SANTRI BIMMA (ADMIN) */}
        {currentPage === 'peserta' && <PesertaPage />}

        {/* PENGAJUAN & ACC IZIN */}
        {currentPage === 'izin' && (
          <IzinPage onOpenScanner={(mode) => handleOpenScanner(mode || 'SURAT_IZIN')} />
        )}

        {/* VERIFIKASI TELAT & LUPA SCAN */}
        {currentPage === 'pembenaran' && <PembenaranPage />}

        {/* KARTU SANTRI DIGITAL & CETAK QR */}
        {currentPage === 'kartu-peserta' && <KartuPesertaPage />}

        {/* FORM BIODATA MAHASISWA */}
        {currentPage === 'biodata-mahasiswa' && (
          <FormBiodataMahasiswaPage
            onBack={() => setCurrentPage(currentUser.role === 'PESERTA' ? 'peserta-portal' : 'dashboard')}
          />
        )}

        {/* PENGATURAN DATABASE & GAS */}
        {currentPage === 'pengaturan' && <PengaturanPage />}
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
