import React, { useState, useRef, useEffect } from 'react';
import { Search, Camera, X, Check, User, QrCode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Peserta } from '../types';

interface QuickStudentPickerProps {
  selectedPesertaId: string;
  onSelectPeserta: (peserta: Peserta | null) => void;
  pesertaList: Peserta[];
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export const QuickStudentPicker: React.FC<QuickStudentPickerProps> = ({
  selectedPesertaId,
  onSelectPeserta,
  pesertaList,
  label = 'Cari Mahasantri (Tulis Nama/NIM atau Scan QR)',
  placeholder = 'Ketik Nama Lengkap atau NIM...',
  required = false,
}) => {
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedPeserta = pesertaList.find((p) => p.pesertaId === selectedPesertaId);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const filtered = query.trim()
    ? pesertaList.filter(
        (p) =>
          p.namaLengkap.toLowerCase().includes(query.toLowerCase()) ||
          p.nim.includes(query.trim()) ||
          p.pesertaId.toLowerCase().includes(query.toLowerCase())
      )
    : pesertaList.slice(0, 8);

  const handleStartScan = () => {
    setCameraError(null);
    setIsScanning(true);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('quick-student-qr-camera');
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
            handleScannedNim(cleanNim);
          },
          () => {}
        );
      } catch (err: any) {
        console.error('Kamera gagal dibuka:', err);
        setCameraError('Gagal membuka kamera. Periksa izin kamera pada browser Anda.');
      }
    }, 300);
  };

  const handleScannedNim = (nim: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => {
          setIsScanning(false);
          matchAndSelect(nim);
        })
        .catch(() => setIsScanning(false));
    } else {
      setIsScanning(false);
      matchAndSelect(nim);
    }
  };

  const matchAndSelect = (nimOrId: string) => {
    const clean = nimOrId.trim();
    const normalize = (value: string | undefined | null) =>
      String(value ?? '').trim().toUpperCase();

    let found: Peserta | undefined;

    // QR kartu santri: pesertaId-nim, misalnya B003-231234050.
    // Pisahkan dari tanda hubung terakhir agar pesertaId boleh mengandung "-".
    const separator = clean.lastIndexOf('-');

    if (separator > 0) {
      const qrPesertaId = clean.slice(0, separator).trim();
      const qrNim = clean.slice(separator + 1).trim();

      found = pesertaList.find(
        (p) =>
          normalize(p.pesertaId) === normalize(qrPesertaId) &&
          normalize(p.nim) === normalize(qrNim)
      );
    }

    // Tetap mendukung QR lama yang berisi NIM saja atau pesertaId saja.
    if (!found) {
      found = pesertaList.find(
        (p) =>
          normalize(p.nim) === normalize(clean) ||
          normalize(p.pesertaId) === normalize(clean) ||
          normalize(p.namaLengkap) === normalize(clean)
      );
    }

    if (found) {
      onSelectPeserta(found);
      setQuery('');
      setIsDropdownOpen(false);
    } else {
      alert(`Santri dengan NIM/QR "${clean}" tidak ditemukan dalam database!`);
    }
  };

  const handleCloseScan = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => setIsScanning(false))
        .catch(() => setIsScanning(false));
    } else {
      setIsScanning(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-1.5 w-full relative">
      {label && (
        <label className="block text-[11px] font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Selected Student Pill */}
      {selectedPeserta ? (
        <div className="flex items-center justify-between p-2.5 px-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900 truncate">
                {selectedPeserta.namaLengkap}
              </p>
              <p className="text-[10px] text-emerald-800 font-mono font-bold mt-0.5">
                NIM: {selectedPeserta.nim} • {selectedPeserta.programStudi} • {selectedPeserta.batchId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectPeserta(null);
              setQuery('');
              setIsDropdownOpen(true);
            }}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-bold text-[11px] border border-emerald-200 transition shrink-0 cursor-pointer shadow-2xs"
          >
            Ganti / Cari Ulang
          </button>
        </div>
      ) : (
        /* Search Box with Type (Tulis) + Scan QR Button */
        <div className="relative flex items-center">
          <div className="w-full h-11 rounded-2xl bg-[#edf3ef] shadow-[inset_2px_2px_5px_rgba(180,205,190,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] flex items-center pl-3 pr-1.5 transition-all focus-within:ring-2 focus-within:ring-[#059669]">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder={placeholder}
              className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none min-w-0"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 mr-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* ATTACHED SCAN QR BUTTON */}
            <button
              type="button"
              onClick={handleStartScan}
              title="Scan QR Code Kartu Mahasantri"
              className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 shadow-xs cursor-pointer transition active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan QR</span>
            </button>
          </div>

          {/* Autocomplete Dropdown List */}
          {isDropdownOpen && (
            <div className="absolute top-12 left-0 right-0 z-50 bg-white rounded-2xl shadow-xl border border-emerald-100 max-h-56 overflow-y-auto custom-scrollbar p-1.5 text-xs animate-in fade-in zoom-in-95">
              {filtered.length === 0 ? (
                <div className="p-3 text-center text-slate-400 font-semibold text-[11px]">
                  {query ? `Tidak ada santri dengan nama/NIM "${query}"` : 'Database santri masih kosong'}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {query ? 'Hasil Pencarian Santri' : 'Daftar Santri Terdaftar'}
                  </div>
                  {filtered.map((p) => (
                    <button
                      key={p.pesertaId}
                      type="button"
                      onClick={() => {
                        onSelectPeserta(p);
                        setQuery('');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-emerald-50 transition flex items-center justify-between cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 group-hover:text-emerald-900 truncate">
                          {p.namaLengkap}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 font-bold">
                          {p.nim} • {p.programStudi} • {p.batchId}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 rounded-md bg-emerald-100/60 group-hover:bg-emerald-200 shrink-0">
                        Pilih
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SCANNER MODAL OVERLAY */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-center space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-xs text-slate-800">
                  Scan QR Kartu Mahasantri
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseScan}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Arahkan QR Code kartu santri Anda ke depan kamera untuk memilih secara instan.
            </p>

            <div
              id="quick-student-qr-camera"
              className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-emerald-500/50"
            />

            {cameraError && (
              <p className="text-xs text-rose-600 font-semibold">{cameraError}</p>
            )}

            <button
              type="button"
              onClick={handleCloseScan}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Tutup Kamera
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
