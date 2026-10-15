import { jsPDF } from 'jspdf';
import { Peserta, Absensi, JadwalKegiatan } from '../types';
import { getItems, getActiveMusyrif } from '../storage';

export interface ExportPdfOptions {
  targetDate?: string;
  batchFilter?: string;
  jurusanFilter?: string;
}

export function exportAttendancePdf(optionsOrDate?: string | ExportPdfOptions) {
  let targetDate = new Date().toISOString().split('T')[0];
  let batchFilter = 'ALL';
  let jurusanFilter = 'ALL';

  if (typeof optionsOrDate === 'string') {
    targetDate = optionsOrDate;
  } else if (optionsOrDate) {
    if (optionsOrDate.targetDate) targetDate = optionsOrDate.targetDate;
    if (optionsOrDate.batchFilter) batchFilter = optionsOrDate.batchFilter;
    if (optionsOrDate.jurusanFilter) jurusanFilter = optionsOrDate.jurusanFilter;
  }

  const allPeserta = getItems<Peserta>('PESERTA').filter((p) => p.statusPeserta === 'AKTIF');
  const pesertaList = allPeserta.filter((p) => {
    const matchBatch = batchFilter === 'ALL' || p.batchId === batchFilter;
    const matchJurusan = jurusanFilter === 'ALL' || p.programStudi === jurusanFilter;
    return matchBatch && matchJurusan;
  });

  const absensiList = getItems<Absensi>('ABSENSI');
  const jadwalList = getItems<JadwalKegiatan>('JADWAL').filter((j) => j.statusAktif);
  const activeMusyrif = getActiveMusyrif();

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  // Helper function to draw Kop Surat
  const drawHeader = (pageNumber: number) => {
    // Top Emerald accent bar
    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, pageWidth, 5, 'F');

    // Header institution branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(6, 78, 59);
    doc.text("UNIVERSITAS 'AISYIYAH BANDUNG", pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('PESANTREN MAHASISWA (PESMA) — BIMMA (BIMBINGAN MAHASISWA)', pageWidth / 2, 20, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275',
      pageWidth / 2,
      25,
      { align: 'center' }
    );
    doc.text(
      'Telp/WA: 0812-3456-7890 • Email: bimma@unisa-bandung.ac.id • Website: unisa-bandung.ac.id',
      pageWidth / 2,
      29,
      { align: 'center' }
    );

    // Double divider lines
    doc.setDrawColor(6, 78, 59);
    doc.setLineWidth(0.7);
    doc.line(14, 32, pageWidth - 14, 32);
    doc.setLineWidth(0.2);
    doc.line(14, 33.2, pageWidth - 14, 33.2);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sistem Informasi Presensi BIMMA PESMA UNISA Bandung • Halaman ${pageNumber}`,
      14,
      pageHeight - 8
    );
    doc.text(
      `Dicetak otomatis pada: ${new Date().toLocaleString('id-ID')}`,
      pageWidth - 14,
      pageHeight - 8,
      { align: 'right' }
    );
  };

  let currentPage = 1;
  drawHeader(currentPage);

  // Document Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(6, 78, 59);
  doc.text('REKAPITULASI RESMI PRESENSI KEGIATAN MAHASANTRI', 14, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const formattedDate = new Date(targetDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Tanggal: ${formattedDate} (${targetDate})`, 14, 45);
  doc.text(
    `Filter: ${batchFilter === 'ALL' ? 'Semua Batch' : batchFilter} | ${
      jurusanFilter === 'ALL' ? 'Semua Program Studi' : jurusanFilter
    }`,
    14,
    49.5
  );

  // Calculate summary metrics for the day
  let totalHadirTepatWaktu = 0;
  let totalHadirTerlambat = 0;
  let totalIzin = 0;
  let totalAlpa = 0;

  pesertaList.forEach((snt) => {
    const dayRecs = absensiList.filter((a) => a.pesertaId === snt.pesertaId && a.tanggal === targetDate);
    const hadirRecs = dayRecs.filter((a) => a.statusAbsensi === 'HADIR');
    const izinRecs = dayRecs.filter((a) => a.statusAbsensi === 'IZIN');

    if (hadirRecs.length > 0) {
      const hasLate = hadirRecs.some((a) => a.keteranganWaktu === 'TERLAMBAT');
      if (hasLate) totalHadirTerlambat++;
      else totalHadirTepatWaktu++;
    } else if (izinRecs.length > 0) {
      totalIzin++;
    } else {
      totalAlpa++;
    }
  });

  const totalSantri = pesertaList.length;
  const persenHadir = totalSantri > 0 ? Math.round(((totalHadirTepatWaktu + totalHadirTerlambat) / totalSantri) * 100) : 0;

  // Draw Summary KPI Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(pageWidth - 14 - 120, 36, 120, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Mahasantri: ${totalSantri}`, pageWidth - 14 - 116, 41);
  doc.setTextColor(4, 120, 87);
  doc.text(`Hadir Tepat: ${totalHadirTepatWaktu}`, pageWidth - 14 - 116, 46);
  doc.setTextColor(217, 119, 6);
  doc.text(`Terlambat: ${totalHadirTerlambat}`, pageWidth - 14 - 74, 46);
  doc.setTextColor(14, 116, 144);
  doc.text(`Izin: ${totalIzin}`, pageWidth - 14 - 40, 46);
  doc.setTextColor(225, 29, 72);
  doc.text(`Alpa: ${totalAlpa}`, pageWidth - 14 - 18, 46);

  doc.setFontSize(8.5);
  doc.setTextColor(6, 78, 59);
  doc.text(`Tingkat Kehadiran: ${persenHadir}%`, pageWidth - 14 - 55, 41);

  // Table header
  let y = 56;
  doc.setFillColor(240, 253, 244);
  doc.rect(14, y, pageWidth - 28, 7.5, 'F');
  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.text('No', 16, y + 5);
  doc.text('NIM', 25, y + 5);
  doc.text('Nama Mahasantri', 48, y + 5);
  doc.text('Program Studi', 105, y + 5);
  doc.text('Batch', 150, y + 5);
  doc.text('Sesi Kegiatan Tercatat', 170, y + 5);
  doc.text('Status & Keterangan Waktu', 230, y + 5);

  y += 8.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  pesertaList.forEach((snt, idx) => {
    // If approaching page bottom, create new page
    if (y > 185) {
      doc.addPage();
      currentPage++;
      drawHeader(currentPage);
      y = 42;

      // Repeat Table header on new page
      doc.setFillColor(240, 253, 244);
      doc.rect(14, y, pageWidth - 28, 7.5, 'F');
      doc.setTextColor(6, 78, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('No', 16, y + 5);
      doc.text('NIM', 25, y + 5);
      doc.text('Nama Mahasantri', 48, y + 5);
      doc.text('Program Studi', 105, y + 5);
      doc.text('Batch', 150, y + 5);
      doc.text('Sesi Kegiatan Tercatat', 170, y + 5);
      doc.text('Status & Keterangan Waktu', 230, y + 5);

      y += 8.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
    }

    const dayRecs = absensiList.filter((a) => a.pesertaId === snt.pesertaId && a.tanggal === targetDate);
    const hadirRecs = dayRecs.filter((a) => a.statusAbsensi === 'HADIR');
    const izinRecs = dayRecs.filter((a) => a.statusAbsensi === 'IZIN');
    const lateRecs = dayRecs.filter((a) => a.keteranganWaktu === 'TERLAMBAT');

    let sesiStr = '-';
    let statusStr = 'Alpa (Belum Ada Presensi)';

    if (hadirRecs.length > 0) {
      const kegiatanNames = hadirRecs.map((h) => h.namaKegiatan).join(', ');
      sesiStr = `${hadirRecs.length} Sesi (${kegiatanNames.slice(0, 36)}${kegiatanNames.length > 36 ? '...' : ''})`;
      if (lateRecs.length > 0) {
        const totalLateMin = lateRecs.reduce((acc, c) => acc + (c.menitKeterlambatan || 0), 0);
        statusStr = `Hadir Terlambat (+${totalLateMin}m)`;
      } else {
        statusStr = 'Hadir Tepat Waktu (Disiplin)';
      }
    } else if (izinRecs.length > 0) {
      sesiStr = izinRecs[0].namaKegiatan || 'Seluruh Sesi';
      statusStr = `Izin Resmi Disetujui`;
    }

    doc.text(String(idx + 1), 16, y + 4);
    doc.text(snt.nim, 25, y + 4);
    doc.text(snt.namaLengkap.slice(0, 28), 48, y + 4);
    doc.text(snt.programStudi.slice(0, 24), 105, y + 4);
    doc.text(snt.batchId || '-', 150, y + 4);
    doc.text(sesiStr, 170, y + 4);

    if (statusStr.startsWith('Hadir Tepat')) {
      doc.setTextColor(4, 120, 87);
    } else if (statusStr.startsWith('Hadir Terlambat')) {
      doc.setTextColor(217, 119, 6);
    } else if (statusStr.startsWith('Izin')) {
      doc.setTextColor(14, 116, 144);
    } else {
      doc.setTextColor(225, 29, 72);
    }
    doc.text(statusStr, 230, y + 4);
    doc.setTextColor(51, 65, 85);

    // Subtle row divider line
    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 5.8, pageWidth - 14, y + 5.8);
    y += 6.2;
  });

  // Check if signature fits on the current page, otherwise add a page
  if (y > 165) {
    doc.addPage();
    currentPage++;
    drawHeader(currentPage);
    y = 45;
  } else {
    y += 8;
  }

  // Signature Block (Pengesahan)
  const sigX = pageWidth - 80;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Bandung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, sigX, y);
  y += 4.5;
  doc.text('Mengetahui / Mengesahkan,', sigX, y);
  y += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('Musyrif / Pengurus PESMA UNISA Bandung', sigX, y);

  // Space for signature
  y += 18;
  const musyrifNama = activeMusyrif?.nama || 'Ustadz / Musyrif Bertugas';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 78, 59);
  doc.text(musyrifNama, sigX, y);
  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.3);
  doc.line(sigX, y + 1, sigX + 58, y + 1);

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('NIDN / NIP. PESMA-UNISA', sigX, y);

  doc.save(`Laporan_Rekap_Presensi_BIMMA_${targetDate}.pdf`);
}
