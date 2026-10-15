/**
 * Google Apps Script Backend Module for BIMMA Attendance
 * Pesantren Mahasiswa (PESMA) - Universitas 'Aisyiyah Bandung
 * Alamat: Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275
 * Kegiatan: BIMMA (Bimbingan Mahasiswa)
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * SISTEM INFORMASI ABSENSI BIMMA (BIMBINGAN MAHASISWA)
 * PESMA (PESANTREN MAHASISWA) - UNIVERSITAS 'AISYIYAH BANDUNG
 * Alamat: Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung, Jawa Barat 40275
 * Google Apps Script Backend Engine v2.0 (Formula Otomatis & Multi-Rekap)
 * =========================================================================
 */

var TIMEZONE = "Asia/Jakarta";

// 1. ENTRY POINT POST (MUTASI DATA AMAN, SYNC ABSENSI, & FORMULA REKAP)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    
    var action = data.action;
    var result = { success: false, message: "Action tidak dikenal" };
    
    if (action === "sync_peserta") {
      result = handleSyncPeserta(data.peserta || []);
    } else if (action === "sync_absensi") {
      result = handleSyncAbsensi(data.absensi || []);
    } else if (action === "scan_presensi") {
      result = handleScanPresensi(data);
    } else if (action === "init_database") {
      result = initAllSheets();
    } else if (action === "init_rekap_formulas" || action === "generate_rekap_formulas") {
      result = handleGenerateRekapFormulas();
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Terjadi kesalahan server: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 2. ENTRY POINT GET (PING & QUERY REKAP CEPAT)
function doGet(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || "ping";
    var result = { success: false, message: "No action" };
    
    if (action === "ping") {
      result = {
        success: true,
        message: "BIMMA PESMA UNISA Apps Script Backend Online",
        serverTime: getCurrentTimeIso(),
        pesmaAddress: "Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung 40275"
      };
    } else if (action === "get_peserta" || action === "get_all_data") {
      result = handleGetPeserta();
    } else if (action === "get_rekap_summary") {
      result = handleGetRekapSummary();
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Error: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// BACA DATA SANTRI DARI GOOGLE SHEET PESERTA
function handleGetPeserta() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("PESERTA");
  if (!sheet) {
    initAllSheets();
    sheet = ss.getSheetByName("PESERTA");
  }
  
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { success: true, count: 0, data: [] };
  }
  
  var list = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0] && !row[1]) continue;
    list.push({
      pesertaId: String(row[0] || ""),
      nim: String(row[1] || ""),
      namaLengkap: String(row[2] || ""),
      batchId: String(row[3] || "Batch 1"),
      programStudi: String(row[4] || "DKV"),
      nomorWhatsApp: String(row[6] || ""),
      email: String(row[7] || ""),
      alamat: String(row[8] || ""),
      tanggalMasuk: String(row[9] || ""),
      statusPeserta: String(row[10] || "AKTIF")
    });
  }
  
  return { success: true, count: list.length, data: list };
}

// SINKRONKAN / UPDATE DAFTAR SANTRI KE SHEET
function handleSyncPeserta(pesertaList) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("PESERTA");
  if (!sheet) {
    initAllSheets();
    sheet = ss.getSheetByName("PESERTA");
  }
  
  sheet.clearContents();
  sheet.appendRow(["PesertaID", "NIM", "NamaLengkap", "BatchID", "ProgramStudi", "Fakultas", "NomorWhatsApp", "Email", "Alamat", "TanggalMasuk", "StatusPeserta", "FotoProfil", "CreatedAt", "UpdatedAt"]);
  sheet.setFrozenRows(1);
  formatHeaderSheet(sheet);
  
  for (var i = 0; i < pesertaList.length; i++) {
    var p = pesertaList[i];
    sheet.appendRow([
      p.pesertaId || ("B" + ("000" + (i + 1)).slice(-3)),
      String(p.nim || ""),
      p.namaLengkap || "",
      p.batchId || "Batch 1",
      p.programStudi || "DKV",
      "-",
      p.nomorWhatsApp || "",
      p.email || "",
      p.alamat || "",
      p.tanggalMasuk || "",
      p.statusPeserta || "AKTIF",
      "",
      p.createdAt || new Date().toISOString(),
      new Date().toISOString()
    ]);
  }
  
  // Perbarui juga sheet rekap per orang
  handleGenerateRekapFormulas();
  
  return { success: true, message: "Berhasil menyimpan " + pesertaList.length + " santri ke Google Sheet PESERTA!" };
}

// SINKRONKAN OUTPUT ABSENSI LENGKAP DENGAN KETERANGAN WAKTU & ALASAN
function handleSyncAbsensi(absensiList) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("ABSENSI");
  if (!sheet) {
    initAllSheets();
    sheet = ss.getSheetByName("ABSENSI");
  }
  
  var existingIds = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var r = 0; r < colA.length; r++) {
      existingIds[String(colA[r][0])] = true;
    }
  }
  
  var appended = 0;
  for (var i = 0; i < absensiList.length; i++) {
    var a = absensiList[i];
    if (!existingIds[a.absensiId]) {
      sheet.appendRow([
        a.absensiId,
        a.namaKegiatan || a.jadwalId || "Kegiatan",
        a.pesertaId,
        a.statusAbsensi || "HADIR",
        a.tanggal || (a.waktuScan ? a.waktuScan.split("T")[0] : ""),
        a.waktuScan || new Date().toISOString(),
        a.waktuServer || new Date().toISOString(),
        a.penggunaId || "PETUGAS",
        a.musyrifBertugas || "-",
        a.sumberAbsensi || "SCAN_QR",
        a.keteranganWaktu || "TEPAT_WAKTU",
        a.menitKeterlambatan || 0,
        a.alasanTerlambat || "",
        a.catatan || "",
        a.statusValidasi || "SAH",
        new Date().toISOString()
      ]);
      existingIds[a.absensiId] = true;
      appended++;
    }
  }
  
  // Refresh formula otomatis di sheet rekapan
  handleGenerateRekapFormulas();
  
  return { success: true, message: "Berhasil menyinkronkan " + appended + " baris absensi baru. Rekapan otomatis diperbarui!" };
}

// FORMATING HEADER HIJAU KHAS UNISA BANDUNG
function formatHeaderSheet(sheet) {
  var range = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  range.setBackground("#064e3b");
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
}

// PEMBUATAN 4 SHEET FORMULA REKAPAN OTOMATIS:
// 1. REKAP_PER_ORANG
// 2. REKAP_HARIAN_KEGIATAN
// 3. REKAP_BATCH
// 4. REKAP_MINGGUAN
function handleGenerateRekapFormulas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. TAB REKAP_PER_ORANG (Hari & Evaluasi Kelulusan BIMMA)
  var sheetPerOrang = ss.getSheetByName("REKAP_PER_ORANG");
  if (!sheetPerOrang) {
    sheetPerOrang = ss.insertSheet("REKAP_PER_ORANG");
  }
  sheetPerOrang.clearContents();
  sheetPerOrang.appendRow([
    "PesertaID", "NIM", "Nama Lengkap", "Batch", "Prodi",
    "Hadir Tepat Waktu", "Hadir Terlambat", "Total Hadir", "Izin", "Alpa",
    "Total Kegiatan", "Persentase Kehadiran", "Status BIMMA"
  ]);
  sheetPerOrang.setFrozenRows(1);
  formatHeaderSheet(sheetPerOrang);
  
  var sheetPeserta = ss.getSheetByName("PESERTA");
  if (sheetPeserta && sheetPeserta.getLastRow() > 1) {
    var pData = sheetPeserta.getRange(2, 1, sheetPeserta.getLastRow() - 1, 5).getValues();
    for (var r = 0; r < pData.length; r++) {
      var rowIdx = r + 2;
      var pId = pData[r][0];
      var nim = pData[r][1];
      var nama = pData[r][2];
      var batch = pData[r][3];
      var prodi = pData[r][4];
      
      var formulaTepat = '=COUNTIFS(ABSENSI!$C:$C, "' + pId + '", ABSENSI!$D:$D, "HADIR", ABSENSI!$K:$K, "TEPAT_WAKTU")';
      var formulaTelat = '=COUNTIFS(ABSENSI!$C:$C, "' + pId + '", ABSENSI!$D:$D, "HADIR", ABSENSI!$K:$K, "TERLAMBAT")';
      var formulaHadir = '=F' + rowIdx + '+G' + rowIdx;
      var formulaIzin = '=COUNTIFS(ABSENSI!$C:$C, "' + pId + '", ABSENSI!$D:$D, "IZIN")';
      var formulaAlpa = '=COUNTIFS(ABSENSI!$C:$C, "' + pId + '", ABSENSI!$D:$D, "ALPA")';
      var formulaTotal = '=H' + rowIdx + '+I' + rowIdx + '+J' + rowIdx;
      var formulaPersen = '=IF(K' + rowIdx + '>0, TEXT(H' + rowIdx + '/K' + rowIdx + ', "0.0%"), "0.0%")';
      var formulaStatus = '=IF(K' + rowIdx + '=0, "BELUM ADA DATA", IF(H' + rowIdx + '/K' + rowIdx + '>=0.75, "LULUS / MEMENUHI SYARAT", "PERLU PEMBINAAN"))';
      
      sheetPerOrang.appendRow([
        pId, nim, nama, batch, prodi,
        formulaTepat, formulaTelat, formulaHadir, formulaIzin, formulaAlpa,
        formulaTotal, formulaPersen, formulaStatus
      ]);
    }
  }

  // 2. TAB REKAP_HARIAN_KEGIATAN
  var sheetHarian = ss.getSheetByName("REKAP_HARIAN_KEGIATAN");
  if (!sheetHarian) {
    sheetHarian = ss.insertSheet("REKAP_HARIAN_KEGIATAN");
  }
  sheetHarian.clearContents();
  sheetHarian.appendRow([
    "Tanggal", "Nama Kegiatan", "Hadir Tepat Waktu", "Hadir Terlambat",
    "Total Hadir", "Izin", "Alpa", "Total Terlibat", "Tingkat Kehadiran (%)"
  ]);
  sheetHarian.setFrozenRows(1);
  formatHeaderSheet(sheetHarian);

  // Ambil tanggal unik dari sheet ABSENSI
  var sheetAbsensi = ss.getSheetByName("ABSENSI");
  if (sheetAbsensi && sheetAbsensi.getLastRow() > 1) {
    var absData = sheetAbsensi.getRange(2, 1, sheetAbsensi.getLastRow() - 1, 5).getValues();
    var pairSet = {};
    for (var a = 0; a < absData.length; a++) {
      var keg = String(absData[a][1] || "");
      var tgl = String(absData[a][4] || "");
      if (keg && tgl) {
        pairSet[tgl + "|||" + keg] = true;
      }
    }
    
    var hRow = 2;
    for (var key in pairSet) {
      var parts = key.split("|||");
      var tglVal = parts[0];
      var kegVal = parts[1];
      
      var fTepatH = '=COUNTIFS(ABSENSI!$E:$E, "' + tglVal + '", ABSENSI!$B:$B, "' + kegVal + '", ABSENSI!$D:$D, "HADIR", ABSENSI!$K:$K, "TEPAT_WAKTU")';
      var fTelatH = '=COUNTIFS(ABSENSI!$E:$E, "' + tglVal + '", ABSENSI!$B:$B, "' + kegVal + '", ABSENSI!$D:$D, "HADIR", ABSENSI!$K:$K, "TERLAMBAT")';
      var fTotHadirH = '=C' + hRow + '+D' + hRow;
      var fIzinH = '=COUNTIFS(ABSENSI!$E:$E, "' + tglVal + '", ABSENSI!$B:$B, "' + kegVal + '", ABSENSI!$D:$D, "IZIN")';
      var fAlpaH = '=COUNTIFS(ABSENSI!$E:$E, "' + tglVal + '", ABSENSI!$B:$B, "' + kegVal + '", ABSENSI!$D:$D, "ALPA")';
      var fTotalPesertaH = '=E' + hRow + '+F' + hRow + '+G' + hRow;
      var fPersenH = '=IF(H' + hRow + '>0, TEXT(E' + hRow + '/H' + hRow + ', "0.0%"), "0.0%")';
      
      sheetHarian.appendRow([
        tglVal, kegVal, fTepatH, fTelatH, fTotHadirH, fIzinH, fAlpaH, fTotalPesertaH, fPersenH
      ]);
      hRow++;
    }
  }

  // 3. TAB REKAP_BATCH
  var sheetBatch = ss.getSheetByName("REKAP_BATCH");
  if (!sheetBatch) {
    sheetBatch = ss.insertSheet("REKAP_BATCH");
  }
  sheetBatch.clearContents();
  sheetBatch.appendRow([
    "BatchID", "Nama Batch", "Jumlah Mahasantri", "Total Hadir Tepat Waktu",
    "Total Terlambat", "Total Kehadiran", "Total Izin", "Total Alpa", "Tingkat Kehadiran (%)"
  ]);
  sheetBatch.setFrozenRows(1);
  formatHeaderSheet(sheetBatch);

  var batches = ["Batch 1", "Batch 2", "Batch 3"];
  for (var b = 0; b < batches.length; b++) {
    var bIdx = b + 2;
    var bId = batches[b];
    var fJumlahSantri = '=COUNTIFS(PESERTA!$D:$D, "' + bId + '", PESERTA!$K:$K, "AKTIF")';
    var fTepatBatch = '=SUMIFS(REKAP_PER_ORANG!$F:$F, REKAP_PER_ORANG!$D:$D, "' + bId + '")';
    var fTelatBatch = '=SUMIFS(REKAP_PER_ORANG!$G:$G, REKAP_PER_ORANG!$D:$D, "' + bId + '")';
    var fTotHadirBatch = '=D' + bIdx + '+E' + bIdx;
    var fIzinBatch = '=SUMIFS(REKAP_PER_ORANG!$I:$I, REKAP_PER_ORANG!$D:$D, "' + bId + '")';
    var fAlpaBatch = '=SUMIFS(REKAP_PER_ORANG!$J:$J, REKAP_PER_ORANG!$D:$D, "' + bId + '")';
    var fPersenBatch = '=IF((F' + bIdx + '+G' + bIdx + '+H' + bIdx + ')>0, TEXT(F' + bIdx + '/(F' + bIdx + '+G' + bIdx + '+H' + bIdx + '), "0.0%"), "0.0%")';

    sheetBatch.appendRow([
      bId, bId + " Pesma UNISA", fJumlahSantri, fTepatBatch, fTelatBatch, fTotHadirBatch, fIzinBatch, fAlpaBatch, fPersenBatch
    ]);
  }

  // 4. TAB REKAP_MINGGUAN
  var sheetMingguan = ss.getSheetByName("REKAP_MINGGUAN");
  if (!sheetMingguan) {
    sheetMingguan = ss.insertSheet("REKAP_MINGGUAN");
  }
  sheetMingguan.clearContents();
  sheetMingguan.appendRow([
    "Periode Minggu", "Total Hadir Tepat Waktu", "Total Terlambat",
    "Total Kehadiran", "Total Izin", "Total Alpa", "Rata-Rata Kehadiran (%)"
  ]);
  sheetMingguan.setFrozenRows(1);
  formatHeaderSheet(sheetMingguan);

  var mingguLabels = ["Minggu 1", "Minggu 2", "Minggu 3", "Minggu 4", "Minggu 5"];
  for (var m = 0; m < mingguLabels.length; m++) {
    var mIdx = m + 2;
    sheetMingguan.appendRow([
      mingguLabels[m],
      '=SUM(REKAP_HARIAN_KEGIATAN!$C$2:$C$100)',
      '=SUM(REKAP_HARIAN_KEGIATAN!$D$2:$D$100)',
      '=B' + mIdx + '+C' + mIdx,
      '=SUM(REKAP_HARIAN_KEGIATAN!$F$2:$F$100)',
      '=SUM(REKAP_HARIAN_KEGIATAN!$G$2:$G$100)',
      '=IF((D' + mIdx + '+E' + mIdx + '+F' + mIdx + ')>0, TEXT(D' + mIdx + '/(D' + mIdx + '+E' + mIdx + '+F' + mIdx + '), "0.0%"), "0.0%")'
    ]);
  }

  return {
    success: true,
    message: "4 Sheet Rekapan Otomatis (Per Orang, Harian Kegiatan, Batch, Mingguan) berhasil dipasang dengan formula dinamis!"
  };
}

// BACA DATA REKAPAN DARI SHEET UNTUK KONSUMSI APLIKASI
function handleGetRekapSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPerOrang = ss.getSheetByName("REKAP_PER_ORANG");
  var sheetHarian = ss.getSheetByName("REKAP_HARIAN_KEGIATAN");
  var sheetBatch = ss.getSheetByName("REKAP_BATCH");
  
  var perOrangData = sheetPerOrang ? sheetPerOrang.getDataRange().getDisplayValues() : [];
  var harianData = sheetHarian ? sheetHarian.getDataRange().getDisplayValues() : [];
  var batchData = sheetBatch ? sheetBatch.getDataRange().getDisplayValues() : [];
  
  return {
    success: true,
    perOrang: perOrangData.slice(1),
    harian: harianData.slice(1),
    batch: batchData.slice(1)
  };
}

// INISIALISASI STRUKTUR LENGKAP GOOGLE SHEETS
function initAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var schema = {
    "PESERTA": ["PesertaID", "NIM", "NamaLengkap", "BatchID", "ProgramStudi", "Fakultas", "NomorWhatsApp", "Email", "Alamat", "TanggalMasuk", "StatusPeserta", "FotoProfil", "CreatedAt", "UpdatedAt"],
    "ABSENSI": ["AbsensiID", "Kegiatan", "PesertaID", "StatusAbsensi", "Tanggal", "WaktuScan", "WaktuServer", "PenggunaID", "MusyrifBertugas", "SumberAbsensi", "KeteranganWaktu", "MenitTerlambat", "AlasanTerlambat", "Catatan", "StatusValidasi", "UpdatedAt"],
    "IZIN": ["IzinID", "PesertaID", "JenisIzin", "WaktuMulai", "WaktuSelesai", "Alasan", "StatusPersetujuan", "NomorSurat", "KodeVerifikasi", "StatusKedatangan", "WaktuKedatanganKembali", "PetugasVerifikasi", "CatatanKedatangan"],
    "BATCH": ["BatchID", "NamaBatch", "Tahun", "TanggalMulai", "TanggalSelesai", "StatusBatch", "Keterangan"],
    "JADWAL": ["JadwalID", "NamaKegiatan", "JamMulai", "JamSelesai", "ToleransiBukaAwal", "ToleransiTutupAkhir", "Wajib", "StatusAktif", "Keterangan"],
    "AUDIT_LOG": ["AuditID", "WaktuServer", "PenggunaID", "Aksi", "JenisEntitas", "EntitasID", "NilaiSebelum", "NilaiSesudah", "Alasan", "StatusAksi"]
  };
  
  for (var name in schema) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(schema[name]);
      sheet.setFrozenRows(1);
      formatHeaderSheet(sheet);
    }
  }
  
  handleGenerateRekapFormulas();
  return { success: true, message: "Seluruh sheet database dan formula rekapan BIMMA UNISA berhasil diinisialisasi!" };
}

function getCurrentTimeIso() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
`;
