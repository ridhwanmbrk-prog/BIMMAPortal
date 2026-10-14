import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  CheckSquare,
  Square,
  X,
  ExternalLink,
  FileText,
  CheckCircle2,
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

  // State Modal Popup Cetak Cepat / Print Preview
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printPdfBlobUrl, setPrintPdfBlobUrl] = useState<string | null>(null);
  const [printSantriList, setPrintSantriList] = useState<Peserta[]>([]);
  const printIframeRef = React.useRef<HTMLIFrameElement | null>(null);

  // Helper untuk membuat dokumen PDF Kartu Santri ID-1 (54mm x 85mm)
  const generateKartuDoc = (targetSantri: Peserta[]) => {
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

    return doc;
  };

  // Unduh PDF Gabungan Kartu Terpilih (Standard Ukuran ID Card ID-1 85.6mm x 54mm)
  const handleDownloadBatchPdf = async () => {
    const targetSantri = filtered.filter((p) => selectedIds.includes(p.pesertaId));
    if (targetSantri.length === 0) {
      alert('Pilih minimal 1 santri untuk mengunduh kartu identitas!');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = generateKartuDoc(targetSantri);
      doc.save(`Kartu_Peserta_BIMMA_${targetSantri.length}_Santri.pdf`);
    } catch (err: unknown) {
      alert('Gagal menghasilkan PDF: ' + (err as Error).message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // CETAK CEPAT: Hubungkan Langsung ke Printer Device & Tampilkan Preview Popup
  const handleOpenCetakCepat = () => {
    // Jika ada yang dicentang gunakan yang dicentang, jika tidak ada centang cetak semua yang tampil di filter
    const targetSantri = selectedIds.length > 0
      ? filtered.filter((p) => selectedIds.includes(p.pesertaId))
      : filtered;

    if (targetSantri.length === 0) {
      alert('Tidak ada kartu santri yang tersedia untuk dicetak!');
      return;
    }

    setPrintSantriList(targetSantri);
    setIsGeneratingPdf(true);

    try {
      const doc = generateKartuDoc(targetSantri);
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      setPrintPdfBlobUrl(blobUrl);
      setPrintModalOpen(true);
    } catch (err: unknown) {
      alert('Gagal menyiapkan cetak: ' + (err as Error).message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Trigger printer device dialog langsung dari iframe
  const handleTriggerDevicePrint = () => {
    if (printIframeRef.current && printIframeRef.current.contentWindow) {
      try {
        printIframeRef.current.contentWindow.focus();
        printIframeRef.current.contentWindow.print();
      } catch {
        // Fallback jika browser sandbox membatasi iframe print
        window.print();
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Control Filter per Batch & Search Bar */}
      <div className="bg-white p-3.5 sm:p-5 rounded-[24px] border border-emerald-100 shadow-xs space-y-3">
        {/* Pills Filter per Batch dengan CTA Unduh di Ujung Blok */}
        <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <button
              onClick={() => setSelectedBatch('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedBatch === 'ALL'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-[#f4f8f5] text-slate-600 hover:bg-emerald-50'
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
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-[#f4f8f5] text-slate-600 hover:bg-emerald-50'
                  }`}
                >
                  <span>{b.batchId}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-white/20' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {countInBatch}
                  </span>
                </button>
              );
            })}
          </div>

          {/* CTA Unduh & Cetak Cepat Hubungkan Printer */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 shrink-0">
            <button
              onClick={handleOpenCetakCepat}
              disabled={isGeneratingPdf || filtered.length === 0}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Cetak Cepat langsung hubungkan ke printer di devices"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Cetak Cepat</span>
            </button>

            <button
              onClick={handleDownloadBatchPdf}
              disabled={isGeneratingPdf || selectedIds.length === 0}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              title="Unduh file PDF kartu terpilih"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isGeneratingPdf
                  ? 'Menyusun PDF...'
                  : `Unduh Batch PDF (${selectedIds.length} Terpilih)`}
              </span>
            </button>
          </div>
        </div>

        {/* Action Row: Select All & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full sm:w-auto">
            <button
              onClick={handleSelectAll}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-3 py-1.5 bg-[#f4f8f5] hover:bg-emerald-50 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {selectedIds.length === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-emerald-700" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Pilih Semua ({filtered.length})</span>
            </button>

            <span className="text-xs text-slate-500 font-medium text-center">
              <strong className="text-emerald-700">{selectedIds.length}</strong> dari {filtered.length} kartu dipilih
            </span>
          </div>

          <div className="w-full sm:w-auto flex justify-center sm:justify-end">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari NIM atau nama santri..."
              className="w-full sm:w-64 px-3 py-2 text-xs rounded-xl bg-[#f4f8f5] border border-emerald-100 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* GRID KARTU IDENTITAS PREVIEW ATAU EMPTY STATE */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-emerald-100 shadow-xs max-w-xl mx-auto space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
            Belum Ada Kartu Santri Siap Cetak
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Data mahasantri masih kosong (Database bersih dari nol). Silakan tambahkan santri melalui menu Data Santri atau unggah berkas spreadsheet Excel agar kartu identitas dan QR scan otomatis di-generate.
          </p>
        </div>
      ) : (
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
      )}

      {/* MODAL POPUP CETAK CEPAT & HUBUNGKAN KE PRINTER DEVICE */}
      {printModalOpen && printPdfBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                    Cetak Cepat Kartu Santri BIMMA
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {printSantriList.length} kartu santri siap dikirim ke printer perangkat
                  </p>
                </div>
              </div>

              {/* Actions Header */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={handleTriggerDevicePrint}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Hubungkan langsung ke printer device"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>Cetak Sekarang (Ctrl+P)</span>
                </button>

                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = printPdfBlobUrl;
                    a.download = `Kartu_Peserta_BIMMA_${printSantriList.length}_Santri.pdf`;
                    a.click();
                  }}
                  className="px-3.5 py-2 bg-[#f4f8f5] hover:bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Unduh file PDF"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Unduh PDF</span>
                </button>

                <button
                  onClick={() => {
                    setPrintModalOpen(false);
                    if (printPdfBlobUrl) URL.revokeObjectURL(printPdfBlobUrl);
                    setPrintPdfBlobUrl(null);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  title="Tutup Popup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Iframe Preview siap Cetak */}
            <div className="flex-1 p-3 sm:p-5 bg-slate-100 flex flex-col items-center justify-center">
              <iframe
                ref={printIframeRef}
                src={printPdfBlobUrl}
                className="w-full h-[62vh] rounded-2xl bg-white border border-slate-300 shadow-inner"
                title="Pratinjau PDF Kartu Santri"
              />
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white flex flex-wrap items-center justify-center sm:justify-between gap-2 text-[11px] text-slate-500 font-medium text-center">
              <span>Format Standar Kartu ID-1 (54mm x 85mm) • UNISA PESMA</span>
              <span className="text-emerald-700 font-bold">Terhubung ke Driver &amp; Printer Lokal</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
