import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import { Izin, Peserta } from '../types';

const TEMPLATE_URL = '/templates/surat_izin_template.pdf';

const BLACK = rgb(0, 0, 0);
const GREEN = rgb(6 / 255, 78 / 255, 59 / 255);
const WHITE = rgb(1, 1, 1);

/**
 * Posisi template diukur dari sisi atas halaman dalam satuan PDF point.
 * PDF A4 = 595.28 x 841.89 point.
 */
function drawTextAtTop(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: PDFFont,
  text: string,
  x: number,
  baselineFromTop: number,
  size: number,
  color = BLACK,
): void {
  page.drawText(text || '-', {
    x,
    y: page.getHeight() - baselineFromTop,
    size,
    font,
    color,
  });
}

function drawFitText(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: PDFFont,
  text: string,
  x: number,
  baselineFromTop: number,
  maxWidth: number,
  preferredSize = 9,
  minSize = 6.5,
  color = BLACK,
): void {
  let size = preferredSize;

  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }

  drawTextAtTop(page, font, text, x, baselineFromTop, size, color);
}

function drawCenteredFit(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: PDFFont,
  text: string,
  baselineFromTop: number,
  maxWidth: number,
  preferredSize = 9,
  minSize = 6.5,
  color = BLACK,
): void {
  let size = preferredSize;

  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }

  const x = (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2;

  drawTextAtTop(page, font, text, x, baselineFromTop, size, color);
}

function formatDateTime(value: unknown): string {
  const raw = String(value || '').trim();

  if (!raw) return '-';

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);

  return match ? `${match[1]} ${match[2]} WIB` : `${raw.replace('T', ' ')} WIB`;
}

function formatIndonesianDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatBatch(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';

  const match = raw.match(/(?:batch|b)\s*(\d+)/i) || raw.match(/(\d+)/);

  return match ? `Batch ${Number(match[1])}` : raw;
}

function getJenisIzinLabel(jenisIzin: string): string {
  switch (jenisIzin) {
    case 'IZIN_PULANG':
      return 'IZIN PULANG KE RUMAH / KELUARGA';
    case 'SAKIT':
      return 'IZIN SAKIT (KLINIK / RAWAT INAP)';
    case 'KEPERLUAN_SYARI':
      return "IZIN KEPERLUAN SYAR'I";
    default:
      return 'IZIN KHUSUS / DISPENSASI KAMPUS';
  }
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function generateSuratIzinPdf(
  izin: Izin,
  santri: Peserta,
  _petugasNama?: string,
): Promise<void> {
  if (izin.statusPersetujuan !== 'DISETUJUI') {
    window.alert('Surat resmi hanya dapat diterbitkan setelah izin disetujui.');
    return;
  }

  const nomorSurat = String(izin.nomorSurat || '').trim();
  const qrContent = String(izin.kodeVerifikasi || '').trim();

  if (!nomorSurat) {
    window.alert('Nomor surat belum tersedia. Periksa data persetujuan izin.');
    return;
  }

  if (!qrContent) {
    window.alert('Kode verifikasi belum tersedia. Periksa data persetujuan izin.');
    return;
  }

  try {
    // Template PDF berisi kop, logo, label, garis, dan tata letak tetap.
    const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Template PDF tidak dapat dimuat (HTTP ${response.status}).`);
    }

    const templateBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];

    if (!page) {
      throw new Error('Halaman template surat tidak ditemukan.');
    }

    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    if (Math.abs(pageWidth - 595.28) > 3 || Math.abs(pageHeight - 841.89) > 3) {
      console.warn('Ukuran template berbeda dari A4:', pageWidth, pageHeight);
    }

    // Nomor Surat: bagian label sudah terdapat pada template.
    drawFitText(page, regular, nomorSurat, 267, 174.5, 260, 9, 7, GREEN);

    // Identitas santri.
    const identitas = [
      { value: santri.namaLengkap || '-', y: 253.7, font: bold },
      { value: santri.nim || '-', y: 273.1, font: regular },
      {
        value: `${santri.programStudi || '-'} / ${santri.fakultas || "Universitas 'Aisyiyah Bandung"}`,
        y: 292.4,
        font: regular,
      },
      { value: formatBatch(santri.batchId), y: 311.8, font: regular },
      { value: santri.nomorWhatsApp || '-', y: 331.2, font: regular },
    ];

    for (const item of identitas) {
      drawFitText(page, item.font, item.value, 238, item.y, 286, 9, 6.5);
    }

    // Rincian izin.
    drawFitText(
      page,
      bold,
      getJenisIzinLabel(izin.jenisIzin),
      245,
      407.3,
      280,
      8.8,
      6.5,
      GREEN,
    );

    drawFitText(
      page,
      regular,
      formatDateTime(izin.waktuMulai),
      245,
      426.8,
      280,
      8.8,
      6.5,
      GREEN,
    );

    drawFitText(
      page,
      bold,
      `${formatDateTime(izin.waktuSelesai)} (Wajib Hadir Sebelum Batas Ini)`,
      245,
      446.1,
      285,
      8.5,
      6.3,
      GREEN,
    );

    drawFitText(
      page,
      regular,
      String(izin.alasan || '-').replace(/\s+/g, ' ').trim(),
      245,
      465.5,
      280,
      8.8,
      6.3,
      GREEN,
    );

    // Nomor dan kode verifikasi dibuat di bagian tengah.
    // Tutupi hanya heading statis lama agar kode dapat ditampilkan satu baris.
    page.drawRectangle({
      x: 105,
      y: pageHeight - 539,
      width: 388,
      height: 20,
      color: WHITE,
    });

    drawCenteredFit(
      page,
      bold,
      `KODE UNIK VERIFIKASI KEDATANGAN SANTRI: ${qrContent}`,
      535,
      465,
      9,
      6.5,
      GREEN,
    );

    // QR berisi kode verifikasi yang sama dengan data surat.
    const qrDataUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 400,
      color: {
        dark: '#064e3b',
        light: '#ffffff',
      },
    });

    const base64 = qrDataUrl.split(',')[1];

    if (!base64) {
      throw new Error('Data QR tidak valid.');
    }

    const qrBytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const qrImage = await pdfDoc.embedPng(qrBytes);

    // Area kanan: tanggal dan QR saja.
    // Posisi X tanggal sejajar dengan sisi kiri nama Bu Dita pada template.
    const tanggalSurat = formatIndonesianDate(new Date());
    const dateText = `Bandung, ${tanggalSurat}`;

    drawTextAtTop(
      page,
      regular,
      dateText,
      347.4,
      635,
      8.5,
    );

    // QR tetap tepat di atas nama Bu Dita yang sudah tercetak pada template.
    const qrSize = 52;
    const qrX = 347.4;
    const qrTop = 642;

    page.drawImage(qrImage, {
      x: qrX,
      y: pageHeight - qrTop - qrSize,
      width: qrSize,
      height: qrSize,
    });

    // Nama Bu Dita, jabatan di bawah nama, keterangan digital,
    // dan footer sudah mengikuti elemen statis template.
    // Jangan menggambar ulang agar teks tidak berduplikasi.

    const outputBytes = await pdfDoc.save();
    const blob = new Blob([outputBytes as BlobPart], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = `Surat_Izin_${safeFilename(santri.nim)}_${safeFilename(izin.jenisIzin)}.pdf`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    console.error('[BIMMA_SURAT_PDF]', error);

    window.alert(
      error instanceof Error
        ? `Surat PDF gagal dibuat: ${error.message}`
        : 'Surat PDF gagal dibuat. Silakan coba kembali.',
    );
  }
}
