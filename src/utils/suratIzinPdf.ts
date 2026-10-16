import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Izin, Peserta } from '../types';

export async function generateSuratIzinPdf(izin: Izin, santri: Peserta, petugasNama?: string): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210 x 297 mm
  });

  // Generate QR Code data URL for the verification code
  const qrContent = izin.kodeVerifikasi || `IZIN-${izin.izinId}-${santri.nim}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(qrContent, {
      margin: 1,
      width: 250,
      color: {
        dark: '#064e3b',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed generating QR code for surat:', err);
  }

  // Header Background bar
  doc.setFillColor(6, 78, 59); // Emerald 900
  doc.rect(0, 0, 210, 8, 'F');

  // Letterhead (KOP SURAT)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(6, 78, 59);
  doc.text("UNIVERSITAS 'AISYIYAH BANDUNG", 105, 20, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('PESANTREN MAHASISWA (PESMA) — BIMMA (BIMBINGAN MAHASISWA)', 105, 26, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275', 105, 31, { align: 'center' });
  doc.text('Telp/WhatsApp: 0812-3456-7890 • Email: bimma@unisa-bandung.ac.id • Website: unisa-bandung.ac.id', 105, 35, { align: 'center' });

  // Divider lines
  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.8);
  doc.line(18, 38, 192, 38);
  doc.setLineWidth(0.2);
  doc.line(18, 39.5, 192, 39.5);

  // Judul Dokumen
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(6, 78, 59);
  doc.text('SURAT IZIN & BUKTI KEDATANGAN MAHASANTRI', 105, 48, { align: 'center' });

  const nomorSurat = izin.nomorSurat || `BIMMA/IZN/${new Date().getFullYear()}/${izin.izinId}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nomor Surat: ${nomorSurat}`, 105, 53, { align: 'center' });

  // Status Badge in PDF
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(65, 56, 80, 7, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87);
  doc.text('STATUS: RESMI DISETUJUI (TERVERIFIKASI SISTEM)', 105, 60.5, { align: 'center' });

  // Pengantar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    'Pengurus Pesantren Mahasiswa (PESMA) Universitas \'Aisyiyah Bandung menerangkan bahwa:',
    20,
    70
  );

  // Kotak Identitas Santri
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, 74, 170, 42, 2, 2, 'FD');

  const startY = 81;
  const lineGap = 6.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Nama Lengkap', 25, startY);
  doc.text('Nomor Induk Mahasiswa (NIM)', 25, startY + lineGap);
  doc.text('Program Studi / Fakultas', 25, startY + lineGap * 2);
  doc.text('Batch Kegiatan BIMMA', 25, startY + lineGap * 3);
  doc.text('Kontak WhatsApp Santri', 25, startY + lineGap * 4);

  doc.text(':', 78, startY);
  doc.text(':', 78, startY + lineGap);
  doc.text(':', 78, startY + lineGap * 2);
  doc.text(':', 78, startY + lineGap * 3);
  doc.text(':', 78, startY + lineGap * 4);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(santri.namaLengkap, 82, startY);
  doc.setFont('helvetica', 'normal');
  doc.text(santri.nim, 82, startY + lineGap);
  doc.text(`${santri.programStudi} / ${santri.fakultas || "Universitas 'Aisyiyah Bandung"}`, 82, startY + lineGap * 2);
  doc.text(santri.batchId, 82, startY + lineGap * 3);
  doc.text(santri.nomorWhatsApp || '-', 82, startY + lineGap * 4);

  // Keterangan Izin
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    'Telah diberikan izin resmi meninggalkan asrama / kegiatan dengan rincian sebagai berikut:',
    20,
    124
  );

  // Kotak Rincian Izin
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(20, 128, 170, 40, 2, 2, 'FD');

  const izinStartY = 135;
  const jenisLabel =
    izin.jenisIzin === 'IZIN_PULANG'
      ? 'IZIN PULANG KE RUMAH / KELUARGA'
      : izin.jenisIzin === 'SAKIT'
      ? 'IZIN SAKIT (KLINIK / RAWAT INAP)'
      : izin.jenisIzin === 'KEPERLUAN_SYARI'
      ? 'IZIN KEPERLUAN SYAR\'I'
      : 'IZIN KHUSUS / DISPENSASI KAMPUS';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text('Jenis Izin', 25, izinStartY);
  doc.text('Waktu Mulai Izin', 25, izinStartY + lineGap);
  doc.text('Batas Waktu Kedatangan Kembali', 25, izinStartY + lineGap * 2);
  doc.text('Alasan / Keterangan', 25, izinStartY + lineGap * 3);

  doc.text(':', 82, izinStartY);
  doc.text(':', 82, izinStartY + lineGap);
  doc.text(':', 82, izinStartY + lineGap * 2);
  doc.text(':', 82, izinStartY + lineGap * 3);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(jenisLabel, 86, izinStartY);

  doc.setFont('helvetica', 'normal');
  doc.text(`${izin.waktuMulai.replace('T', ' ')} WIB`, 86, izinStartY + lineGap);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28); // Red color for return deadline
  doc.text(`${izin.waktuSelesai.replace('T', ' ')} WIB (Wajib Hadir Sebelum Batas Ini)`, 86, izinStartY + lineGap * 2);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const splitAlasan = doc.splitTextToSize(izin.alasan || '-', 100);
  doc.text(splitAlasan, 86, izinStartY + lineGap * 3);

  // Kotak Verifikasi Kedatangan & QR Code
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.4);
  doc.roundedRect(20, 175, 170, 46, 2, 2, 'FD');

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 24, 178, 40, 40);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('KODE UNIK VERIFIKASI KEDATANGAN SANTRI:', 70, 183);

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(qrContent, 70, 189);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const instruksi = [
    '• Saat santri datang kembali ke asrama, perlihatkan surat ini (atau QR di HP) ke Musyrif piket.',
    '• Musyrif akan melakukan scan QR atau input kode unik untuk memverifikasi kedatangan.',
    '• Setelah diverifikasi kedatangannya, status santri otomatis AKTIF KEMBALI dan tidak alpa.',
    '• Apabila belum diverifikasi sampai batas waktu berakhir, santri otomatis dianggap ALPA.',
  ];
  let instY = 194;
  instruksi.forEach((text) => {
    doc.text(text, 70, instY);
    instY += 4.2;
  });

  // Bagian Tanda Tangan
  const ttdY = 230;
  const tglCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Bandung, ${tglCetak}`, 140, ttdY);
  doc.text('Pengurus / Musyrif BIMMA', 140, ttdY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 78, 59);
  doc.text(petugasNama || 'Musyrif Petugas UNISA Bandung', 140, ttdY + 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('NIDN / NIP. Pesma UNISA Bandung', 140, ttdY + 30);

  // Kolom Paraf / Check-in Kedatangan Musyrif
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(20, ttdY, 90, 32, 2, 2, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('LEMBAR PARAF KEDATANGAN MUSYRIF PIKET:', 24, ttdY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (izin.statusKedatangan === 'SUDAH_KEMBALI' || izin.statusKedatangan === 'TERLAMBAT') {
    doc.setTextColor(izin.statusKedatangan === 'TERLAMBAT' ? 180 : 4, izin.statusKedatangan === 'TERLAMBAT' ? 83 : 120, izin.statusKedatangan === 'TERLAMBAT' ? 9 : 87);
    doc.text(izin.statusKedatangan === 'TERLAMBAT' ? `[✓] TELAH KEMBALI KE ASRAMA (TERLAMBAT)` : `[✓] TELAH KEMBALI KE ASRAMA`, 24, ttdY + 12);
    doc.text(`Waktu Kedatangan: ${izin.waktuKedatanganKembali?.replace('T', ' ') || '-'} WIB`, 24, ttdY + 17);
    doc.text(`Petugas Verifikator: ${izin.petugasVerifikasi || '-'}`, 24, ttdY + 22);
  } else {
    doc.text('Tanggal & Jam Kedatangan : __________________________', 24, ttdY + 12);
    doc.text('Nama Musyrif Penerima    : __________________________', 24, ttdY + 18);
    doc.text('Tanda Tangan Penerima    : __________________________', 24, ttdY + 24);
  }

  // Footer Dokumen
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Dokumen resmi ini diterbitkan secara otomatis oleh Sistem BIMMA Attendance Universitas 'Aisyiyah Bandung.`,
    105,
    285,
    { align: 'center' }
  );

  // Download PDF
  const filename = `Surat_Izin_${santri.nim}_${izin.jenisIzin}.pdf`;
  doc.save(filename);
}
