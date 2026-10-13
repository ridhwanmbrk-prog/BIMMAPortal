import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  CheckSquare,
  Square,
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Peserta, Batch } from '../types';
import { getItems, getConfig } from '../storage';

export const KartuPesertaPage: React.FC = () => {
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const config = getConfig();

  useEffect(() => {
    // Tampilkan SEMUA santri langsung (meskipun batchnya belum aktif) agar siap dicetak
    const list = getItems<Peserta>('PESERTA');
    setPesertaList(list);
    setBatches(getItems<Batch>('BATCH'));

    // Pre-generate QR Data URLs (hanya memuat NIM)
    const genQrs = async () => {
      const qrs: Record<string, string> = {};
      for (const p of list) {
        try {
          const dataUrl = await QRCode.toDataURL(p.nim, {
            margin: 1,
            width: 180,
            color: {
              dark: '#064e3b', // Emerald-900
              light: '#ffffff',
            },
          });
          qrs[p.pesertaId] = dataUrl;
        } catch (e) {
          console.error('QR gen error:', e);
        }
      }
      setQrImages(qrs);
    };

    genQrs();
  }, []);

  const filtered = pesertaList.filter((p) => {
    const matchBatch = selectedBatch === 'ALL' || p.batchId === selectedBatch;
    const matchSearch =
      !searchQuery.trim() ||
      p.namaLengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nim.includes(searchQuery) ||
      p.programStudi.toLowerCase().includes(searchQuery.toLowerCase());
    return matchBatch && matchSearch;
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.pesertaId));
    }
  };

  // Unduh PDF Gabungan Kartu Terpilih (Standard Ukuran ID Card ID-1 85.6mm x 54mm)
  const handleDownloadBatchPdf = async () => {
    const targetSantri = filtered.filter((p) => selectedIds.includes(p.pesertaId));
    if (targetSantri.length === 0) {
      alert('PILIH MINIMAL 1 SANTRI UNTUK DICETAK KARTUNYA!');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      // 1 halaman per kartu ID Card (portrait 54 x 85 mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 85],
      });

      for (let i = 0; i < targetSantri.length; i++) {
        const santri = targetSantri[i];
        if (i > 0) doc.addPage([54, 85], 'portrait');

        // Header Background
        doc.setFillColor(6, 78, 59); // Emerald-900
        doc.rect(0, 0, 54, 20, 'F');

        // Header Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text("UNIVERSITAS 'AISYIYAH BANDUNG", 27, 8, { align: 'center' });
        doc.setFontSize(6);
        doc.text('PESMA — BIMMA (BIMBINGAN MAHASISWA)', 27, 13, { align: 'center' });

        // Content Frame
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text(santri.namaLengkap, 27, 26, { align: 'center' });

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text(santri.programStudi, 27, 30, { align: 'center' });

        // QR Code Box (Hanya memuat NIM)
        const qrUrl = qrImages[santri.pesertaId];
        if (qrUrl) {
          doc.addImage(qrUrl, 'PNG', 12, 34, 30, 30);
        }

        // NIM Label
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 78, 59);
        doc.text('NIM: ' + santri.nim, 27, 68, { align: 'center' });

        // Footer Card
        doc.setFillColor(241, 245, 249);
        doc.rect(0, 75, 54, 10, 'F');
        doc.setFontSize(5);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text('Pesma UNISA • Jl. Terusan Rancagoong II No.1', 27, 81, { align: 'center' });
      }

      doc.save(`Kartu_Peserta_BIMMA_${targetSantri.length}_Santri.pdf`);
    } catch (err: unknown) {
      alert('Gagal menghasilkan PDF: ' + (err as Error).message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Control Filter per Batch & Search Bar */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-200/60 shadow-xs space-y-3">
        {/* Pills Filter per Batch dengan CTA Unduh di Ujung Blok */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedBatch('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedBatch === 'ALL'
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Semua Batch</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {pesertaList.length}
              </span>
            </button>

            {batches.map((b) => {
              const countInBatch = pesertaList.filter((p) => p.batchId === b.batchId).length;
              const isSelected = selectedBatch === b.batchId;
              return (
                <button
                  key={b.batchId}
                  onClick={() => setSelectedBatch(b.batchId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{b.batchId}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-white/20' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {countInBatch}
                  </span>
                </button>
              );
            })}
          </div>

          {/* CTA Unduh & Cetak di Ujung Blok Batch (di atas pencarian nama) */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Cetak Halaman Ini"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak Cepat</span>
            </button>

            <button
              onClick={handleDownloadBatchPdf}
              disabled={isGeneratingPdf || selectedIds.length === 0}
              className="px-3.5 py-1.5 glass-btn-emerald text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isGeneratingPdf
                  ? 'Menyusun PDF...'
                  : `Unduh Batch PDF (${selectedIds.length} Terpilih)`}
              </span>
            </button>
          </div>
        </div>


        {/* Action Row: Select All & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              {selectedIds.length === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-emerald-700" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Pilih Semua ({filtered.length})</span>
            </button>

            <span className="text-xs text-slate-500 font-medium">
              <strong className="text-emerald-700">{selectedIds.length}</strong> dari {filtered.length} kartu dipilih
            </span>
          </div>

          <div className="w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari NIM atau nama santri..."
              className="w-full sm:w-64 px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* GRID KARTU IDENTITAS PREVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((santri) => {
          const isSelected = selectedIds.includes(santri.pesertaId);
          const qr = qrImages[santri.pesertaId];

          return (
            <div
              key={santri.pesertaId}
              onClick={() => handleToggleSelect(santri.pesertaId)}
              className={`relative bg-white rounded-3xl shadow-xs border-2 overflow-hidden transition cursor-pointer transform hover:-translate-y-1 ${
                isSelected
                  ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                  : 'border-slate-200 hover:border-emerald-300'
              }`}
            >
              {/* Checkbox badge */}
              <div className="absolute top-2.5 right-2.5 z-10">
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-white bg-emerald-700 rounded shadow-xs" />
                ) : (
                  <Square className="w-5 h-5 text-white/80" />
                )}
              </div>

              {/* Header Kartu Hijau UNISA */}
              <div className="bg-emerald-900 text-white p-3.5 text-center relative">
                <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-200">
                  UNIVERSITAS ‘AISYIYAH
                </p>
                <h3 className="text-xs font-bold leading-tight text-white mt-0.5">
                  PESANTREN MAHASISWA (BIMMA)
                </h3>
              </div>

              {/* Body Kartu */}
              <div className="p-4 flex flex-col items-center text-center">
                {/* QR Box */}
                <div className="w-32 h-32 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-center mb-2.5">
                  {qr ? (
                    <img src={qr} alt={`QR NIM ${santri.nim}`} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-[10px] text-slate-400">Loading QR...</div>
                  )}
                </div>

                <div className="w-full space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {santri.batchId}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-900 bg-slate-100 py-0.5 px-2.5 rounded-md border border-slate-200 inline-block">
                      NIM: {santri.nim}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-xs text-slate-900 truncate px-2 pt-1" title={santri.namaLengkap}>
                    {santri.namaLengkap}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate" title={santri.programStudi}>
                    {santri.programStudi}
                  </p>
                </div>
              </div>

              {/* Footer Kartu */}
              <div className="bg-slate-50 border-t border-slate-100 py-2 px-3 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span>KARTU IDENTITAS RESMI</span>
                <span className="text-emerald-700 font-bold">Siap Cetak</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
