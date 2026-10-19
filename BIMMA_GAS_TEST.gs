/**
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
    } else if (action === "sync_all_data") {
      result = handleSyncAllData(data);
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
  migrateLegacyPesertaSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DATA_PESERTA");
  if (!sheet) {
    initAllSheets();
    sheet = ss.getSheetByName("DATA_PESERTA");
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
      statusPeserta: String(row[10] || "AKTIF"),
      gender: String(row[14] || "")
    });
  }

  return { success: true, count: list.length, data: list };
}

// SINKRONKAN / UPDATE DAFTAR SANTRI KE SHEET

function handleSyncPeserta(pesertaList) {
  migrateLegacyPesertaSheet_();
  var result = upsertOutputRows_("DATA_PESERTA", [
    "PesertaID", "NIM", "NamaLengkap", "BatchID", "ProgramStudi",
    "Fakultas", "NomorWhatsApp", "Email", "Alamat", "TanggalMasuk",
    "StatusPeserta", "FotoProfil", "CreatedAt", "UpdatedAt", "Gender"
  ], pesertaList, "pesertaId", function(p) {
    var now = new Date().toISOString();
    return [
      p.pesertaId, p.nim, p.namaLengkap, p.batchId, p.programStudi,
      p.fakultas || "", p.nomorWhatsApp || "", p.email || "",
      p.alamat || "", p.tanggalMasuk || "", p.statusPeserta || "AKTIF",
      p.fotoProfil || "", p.createdAt || now, p.updatedAt || now, p.gender || ""
    ];
  });

  handleGenerateOutputTables();
  return {
    success: true,
    message: "Data peserta diperbarui berdasarkan ID. Data yang tidak dikirim tidak dihapus.",
    inserted: result.inserted,
    updated: result.updated
  };
}

// SINKRONKAN OUTPUT ABSENSI LENGKAP DENGAN KETERANGAN WAKTU & ALASAN

function handleSyncAbsensi(absensiList) {
  var now = new Date().toISOString();
  var result = upsertOutputRows_("ABSENSI", [
    "AbsensiID", "Kegiatan", "PesertaID", "StatusAbsensi", "Tanggal",
    "WaktuScan", "WaktuServer", "PenggunaID", "MusyrifBertugas",
    "SumberAbsensi", "KeteranganWaktu", "MenitTerlambat",
    "AlasanTerlambat", "Catatan", "StatusValidasi", "UpdatedAt",
    "JadwalID", "AlasanKoreksi", "ReferensiAsalID", "CreatedAt"
  ], absensiList, "absensiId", function(a) {
    return [
      a.absensiId, a.namaKegiatan || "", a.pesertaId,
      a.statusAbsensi || "HADIR", a.tanggal || "",
      a.waktuScan || "", a.waktuServer || now, a.penggunaId || "",
      a.musyrifBertugas || "", a.sumberAbsensi || "",
      a.keteranganWaktu || "", a.menitKeterlambatan || 0,
      a.alasanTerlambat || "", a.catatan || "",
      a.statusValidasi || "SAH", a.updatedAt || now,
      a.jadwalId || "", a.alasanKoreksi || "",
      a.referensiAsalId || "", a.createdAt || now
    ];
  });

  handleGenerateOutputTables();
  return {
    success: true,
    message: "Data absensi diperbarui berdasarkan ID. Catatan lama tetap dipertahankan.",
    inserted: result.inserted,
    updated: result.updated
  };
}

// FORMATING HEADER HIJAU KHAS UNISA BANDUNG
function formatHeaderSheet(sheet) {
  var range = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  range.setBackground("#064e3b");
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
}


// SINKRONISASI SELURUH SUMBER DATA BIMMA BERDASARKAN ID.
// Data yang tidak ada di payload tidak dihapus.

function findExactSheet_(ss, name) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === name) return sheets[i];
  }
  return null;
}

function findExactSheet_(ss, name) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === name) return sheets[i];
  }
  return null;
}

function findExactSheet_(ss, name) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === name) return sheets[i];
  }
  return null;
}

function migrateLegacyPesertaSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = findExactSheet_(ss, "DATA_PESERTA");
  var legacySheet = findExactSheet_(ss, "PESERTA");

  if (!legacySheet) return dataSheet;

  var sourceLastColumn = legacySheet.getLastColumn();
  if (sourceLastColumn < 2 || legacySheet.getLastRow() < 1) {
    return dataSheet;
  }

  var sourceHeaders = legacySheet
    .getRange(1, 1, 1, sourceLastColumn)
    .getDisplayValues()[0];

  function normalizedHeader(value) {
    return String(value || "").replace(/s+/g, "").toLowerCase();
  }

  // Hanya migrasikan sheet dengan skema sumber lama:
  // kolom pertama PesertaID, kolom kedua NIM.
  // Sheet template yang diawali NIM tidak boleh dianggap sumber.
  if (
    normalizedHeader(sourceHeaders[0]) !== "pesertaid" ||
    normalizedHeader(sourceHeaders[1]) !== "nim"
  ) {
    return dataSheet;
  }

  if (!dataSheet) {
    legacySheet.setName("DATA_PESERTA");
    return legacySheet;
  }

  // Pertahankan semua data sumber lama: tambahkan hanya ID yang belum ada.
  if (dataSheet.getLastColumn() === 0 || dataSheet.getLastRow() === 0) {
    dataSheet.getRange(1, 1, 1, sourceHeaders.length)
      .setValues([sourceHeaders]);
  }

  var targetHeaders = dataSheet
    .getRange(1, 1, 1, Math.max(dataSheet.getLastColumn(), 1))
    .getDisplayValues()[0];

  sourceHeaders.forEach(function(header) {
    if (header && targetHeaders.indexOf(header) === -1) {
      targetHeaders.push(header);
    }
  });

  if (targetHeaders.length > dataSheet.getMaxColumns()) {
    dataSheet.insertColumnsAfter(
      dataSheet.getMaxColumns(),
      targetHeaders.length - dataSheet.getMaxColumns()
    );
  }

  dataSheet.getRange(1, 1, 1, targetHeaders.length)
    .setValues([targetHeaders]);

  var targetIds = {};
  if (dataSheet.getLastRow() > 1) {
    var idValues = dataSheet
      .getRange(2, 1, dataSheet.getLastRow() - 1, 1)
      .getDisplayValues();

    idValues.forEach(function(row) {
      var id = String(row[0] || "").trim();
      if (id) targetIds[id] = true;
    });
  }

  var sourceLastRow = legacySheet.getLastRow();
  var sourceData = sourceLastRow > 1
    ? legacySheet.getRange(
        2, 1, sourceLastRow - 1, sourceLastColumn
      ).getValues()
    : [];

  sourceData.forEach(function(row) {
    var id = String(row[0] || "").trim();
    if (!id || targetIds[id]) return;

    var valuesByHeader = {};
    sourceHeaders.forEach(function(header, index) {
      valuesByHeader[header] = row[index];
    });

    var targetRow = targetHeaders.map(function(header) {
      return Object.prototype.hasOwnProperty.call(valuesByHeader, header)
        ? valuesByHeader[header]
        : "";
    });

    dataSheet.appendRow(targetRow);
    targetIds[id] = true;
  });

  // Simpan sumber lama sebagai backup, jangan dihapus.
  var backupName = "PESERTA_LEGACY_BACKUP";
  if (findExactSheet_(ss, backupName)) {
    backupName += "_" + new Date().getTime();
  }
  legacySheet.setName(backupName);

  return dataSheet;
}

function ensureOutputHeaders_(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (sheetName === "DATA_PESERTA") migrateLegacyPesertaSheet_();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) sheet = ss.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    var changed = false;

    headers.forEach(function(header) {
      if (currentHeaders.indexOf(header) === -1) {
        currentHeaders.push(header);
        changed = true;
      }
    });

    if (changed) {
      sheet.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
    }
  }

  sheet.setFrozenRows(1);
  formatHeaderSheet(sheet);
  return sheet;
}

function upsertOutputRows_(sheetName, headers, records, idField, rowMapper) {
  var sheet = ensureOutputHeaders_(sheetName, headers);
  var lastRow = sheet.getLastRow();
  var existingRows = {};

  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i][0] || '').trim();
      if (id) existingRows[id] = i + 2;
    }
  }

  var inserted = 0;
  var updated = 0;

  (records || []).forEach(function(record) {
    var id = String(record && record[idField] || '').trim();
    if (!id) return;

    var row = rowMapper(record);
    while (row.length < headers.length) row.push('');
    row = row.slice(0, headers.length);

    if (existingRows[id]) {
      sheet.getRange(existingRows[id], 1, 1, headers.length).setValues([row]);
      updated++;
    } else {
      var nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, headers.length).setValues([row]);
      existingRows[id] = nextRow;
      inserted++;
    }
  });

  return { inserted: inserted, updated: updated };
}


function isScheduleActiveOnDate_(schedule, dateString) {
  if (!schedule || schedule.statusAktif === false) return false;

  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ""));
  if (!match) return false;

  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  var days = schedule.hariPelaksanaan;
  if (!Array.isArray(days) || days.length === 0) return true;

  var weekday = date.getUTCDay();
  return days.some(function(value) {
    var dayNumber = Number(value);
    return Number.isInteger(dayNumber) &&
      dayNumber >= 0 && dayNumber <= 6 &&
      dayNumber === weekday;
  });
}

function getActiveSchedulesForDate_(schedules, dateString) {
  return (schedules || []).filter(function(schedule) {
    return isScheduleActiveOnDate_(schedule, dateString);
  });
}

/**
 * Uji aturan hari tanpa membaca atau menulis spreadsheet.
 * Jalankan fungsi ini dari editor Apps Script.
 */
function runScheduleWeekdaySmokeTest() {
  var weekdaySchedule = {
    statusAktif: true,
    hariPelaksanaan: [1, 3, 5]
  };

  var cases = [
    {
      name: "Senin sesuai jadwal",
      schedule: weekdaySchedule,
      date: "2026-10-19",
      expected: true
    },
    {
      name: "Minggu bukan hari jadwal",
      schedule: weekdaySchedule,
      date: "2026-10-18",
      expected: false
    },
    {
      name: "Rabu sesuai jadwal",
      schedule: weekdaySchedule,
      date: "2026-10-21",
      expected: true
    },
    {
      name: "Jadwal lama tanpa hari tetap berlaku",
      schedule: { statusAktif: true },
      date: "2026-10-18",
      expected: true
    },
    {
      name: "Jadwal nonaktif ditolak",
      schedule: {
        statusAktif: false,
        hariPelaksanaan: [1, 3, 5]
      },
      date: "2026-10-19",
      expected: false
    },
    {
      name: "Tanggal tidak valid ditolak",
      schedule: weekdaySchedule,
      date: "2026-02-30",
      expected: false
    }
  ];

  var results = cases.map(function(test) {
    var actual = isScheduleActiveOnDate_(test.schedule, test.date);
    return {
      name: test.name,
      expected: test.expected,
      actual: actual,
      passed: actual === test.expected
    };
  });

  var failed = results.filter(function(result) {
    return !result.passed;
  });

  var summary = {
    success: failed.length === 0,
    passed: results.length - failed.length,
    total: results.length,
    results: results
  };

  Logger.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    throw new Error("Uji filter hari gagal: " + failed.map(function(x) {
      return x.name;
    }).join(", "));
  }

  return summary;
}


/**
 * Menguji filter jadwal yang digunakan oleh proses sinkronisasi.
 * Tes ini tidak membaca atau mengubah spreadsheet.
 */
function runScheduleFilterIntegrationSmokeTest() {
  var schedules = [
    {
      jadwalId: "J-WEEKDAY",
      statusAktif: true,
      hariPelaksanaan: [1, 3, 5]
    },
    {
      jadwalId: "J-WEEKEND",
      statusAktif: true,
      hariPelaksanaan: [0, 6]
    },
    {
      jadwalId: "J-LEGACY",
      statusAktif: true
    },
    {
      jadwalId: "J-OFF",
      statusAktif: false,
      hariPelaksanaan: [0, 1, 2, 3, 4, 5, 6]
    }
  ];

  var cases = [
    {
      name: "Senin hanya memilih jadwal hari kerja dan jadwal lama",
      date: "2026-10-19",
      expected: ["J-LEGACY", "J-WEEKDAY"]
    },
    {
      name: "Minggu hanya memilih jadwal akhir pekan dan jadwal lama",
      date: "2026-10-18",
      expected: ["J-LEGACY", "J-WEEKEND"]
    },
    {
      name: "Selasa tidak memilih jadwal Senin/Rabu/Jumat",
      date: "2026-10-20",
      expected: ["J-LEGACY"]
    },
    {
      name: "Tanggal tidak valid tidak menghasilkan jadwal",
      date: "2026-02-30",
      expected: []
    }
  ];

  var results = cases.map(function(test) {
    var actual = getActiveSchedulesForDate_(schedules, test.date)
      .map(function(schedule) {
        return schedule.jadwalId;
      })
      .sort();

    var expected = test.expected.slice().sort();

    return {
      name: test.name,
      expected: expected,
      actual: actual,
      passed: actual.join("|") === expected.join("|")
    };
  });

  var failed = results.filter(function(result) {
    return !result.passed;
  });

  var summary = {
    success: failed.length === 0,
    passed: results.length - failed.length,
    total: results.length,
    results: results
  };

  Logger.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    throw new Error(
      "Filter sesi gagal: " +
      failed.map(function(item) {
        return item.name;
      }).join(", ")
    );
  }

  return summary;
}


/**
 * Membentuk baris sesi untuk tanggal laporan tanpa menulis spreadsheet.
 * Fungsi ini dipakai langsung oleh handleSyncAllData.
 */
function buildSessionRowsForDate_(schedules, dateString, updatedAt) {
  return getActiveSchedulesForDate_(schedules, dateString).map(function(j) {
    return {
      sesiId: dateString + "__" + j.jadwalId,
      tanggal: dateString,
      jadwalId: j.jadwalId,
      namaKegiatan: j.namaKegiatan || "",
      statusSesi: "TERJADWAL",
      updatedAt: updatedAt || new Date().toISOString(),
      wajib: j.wajib !== false
    };
  });
}

/**
 * Tes pembentukan baris sesi tanpa menyentuh spreadsheet.
 */
function runSessionRowsCreationSmokeTest() {
  var schedules = [
    {
      jadwalId: "J-WEEKDAY",
      namaKegiatan: "Kegiatan Hari Kerja",
      statusAktif: true,
      hariPelaksanaan: [1, 3, 5],
      wajib: true
    },
    {
      jadwalId: "J-WEEKEND",
      namaKegiatan: "Kegiatan Akhir Pekan",
      statusAktif: true,
      hariPelaksanaan: [0, 6],
      wajib: true
    },
    {
      jadwalId: "J-LEGACY",
      namaKegiatan: "Kegiatan Jadwal Lama",
      statusAktif: true,
      wajib: false
    },
    {
      jadwalId: "J-OFF",
      namaKegiatan: "Kegiatan Nonaktif",
      statusAktif: false,
      hariPelaksanaan: [0, 1, 2, 3, 4, 5, 6],
      wajib: true
    }
  ];

  var cases = [
    {
      name: "Sesi Senin",
      date: "2026-10-19",
      expectedIds: ["J-WEEKDAY", "J-LEGACY"]
    },
    {
      name: "Sesi Minggu",
      date: "2026-10-18",
      expectedIds: ["J-WEEKEND", "J-LEGACY"]
    },
    {
      name: "Sesi Selasa",
      date: "2026-10-20",
      expectedIds: ["J-LEGACY"]
    },
    {
      name: "Tanggal tidak valid",
      date: "2026-02-30",
      expectedIds: []
    }
  ];

  var fixedTime = "SMOKE_TEST_TIMESTAMP";

  var results = cases.map(function(test) {
    var rows = buildSessionRowsForDate_(
      schedules, test.date, fixedTime
    );

    var actualIds = rows.map(function(row) {
      return row.jadwalId;
    }).sort();

    var expectedIds = test.expectedIds.slice().sort();

    var shapeValid = rows.every(function(row) {
      var original = schedules.filter(function(schedule) {
        return schedule.jadwalId === row.jadwalId;
      })[0];

      return row.sesiId === test.date + "__" + row.jadwalId &&
        row.tanggal === test.date &&
        row.statusSesi === "TERJADWAL" &&
        row.updatedAt === fixedTime &&
        row.namaKegiatan === original.namaKegiatan &&
        row.wajib === (original.wajib !== false);
    });

    return {
      name: test.name,
      expectedIds: expectedIds,
      actualIds: actualIds,
      shapeValid: shapeValid,
      passed: actualIds.join("|") === expectedIds.join("|") && shapeValid
    };
  });

  var failed = results.filter(function(result) {
    return !result.passed;
  });

  var summary = {
    success: failed.length === 0,
    passed: results.length - failed.length,
    total: results.length,
    results: results
  };

  Logger.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    throw new Error("Tes pembentukan sesi gagal.");
  }

  return summary;
}

function handleSyncAllData(data) {
  var now = getCurrentTimeIso();
  var totals = { inserted: 0, updated: 0 };

  function sync(name, headers, records, idField, mapper) {
    var result = upsertOutputRows_(name, headers, records, idField, mapper);
    totals.inserted += result.inserted;
    totals.updated += result.updated;
  }

  sync("DATA_PESERTA", [
    "PesertaID", "NIM", "NamaLengkap", "BatchID", "ProgramStudi",
    "Fakultas", "NomorWhatsApp", "Email", "Alamat", "TanggalMasuk",
    "StatusPeserta", "FotoProfil", "CreatedAt", "UpdatedAt", "Gender"
  ], data.peserta, "pesertaId", function(p) {
    return [
      p.pesertaId, p.nim, p.namaLengkap, p.batchId, p.programStudi,
      p.fakultas || "", p.nomorWhatsApp || "", p.email || "", p.alamat || "",
      p.tanggalMasuk || "", p.statusPeserta || "AKTIF", p.fotoProfil || "",
      p.createdAt || now, p.updatedAt || now, p.gender || ""
    ];
  });

  sync("DATA_PENGGUNA", [
    "PenggunaID", "PesertaID", "Gender", "Role", "NamaLengkap", "StatusAktif"
  ], data.pengguna, "id", function(u) {
    return [
      u.id, u.pesertaId || "", u.gender || "", u.role || "",
      u.namaLengkap || "", u.statusAktif !== false
    ];
  });

  sync("ABSENSI", [
    "AbsensiID", "Kegiatan", "PesertaID", "StatusAbsensi", "Tanggal",
    "WaktuScan", "WaktuServer", "PenggunaID", "MusyrifBertugas",
    "SumberAbsensi", "KeteranganWaktu", "MenitTerlambat",
    "AlasanTerlambat", "Catatan", "StatusValidasi", "UpdatedAt",
    "JadwalID", "AlasanKoreksi", "ReferensiAsalID", "CreatedAt"
  ], data.absensi, "absensiId", function(a) {
    return [
      a.absensiId, a.namaKegiatan || "", a.pesertaId, a.statusAbsensi || "HADIR",
      a.tanggal || "", a.waktuScan || "", a.waktuServer || now,
      a.penggunaId || "", a.musyrifBertugas || "", a.sumberAbsensi || "",
      a.keteranganWaktu || "", a.menitKeterlambatan || 0,
      a.alasanTerlambat || "", a.catatan || "", a.statusValidasi || "SAH",
      a.updatedAt || now, a.jadwalId || "", a.alasanKoreksi || "",
      a.referensiAsalId || "", a.createdAt || now
    ];
  });

  sync("JADWAL", [
    "JadwalID", "NamaKegiatan", "JamMulai", "JamSelesai",
    "ToleransiBukaAwal", "ToleransiTutupAkhir", "Wajib",
    "StatusAktif", "Keterangan", "HariPelaksanaan"
  ], data.jadwal, "jadwalId", function(j) {
    var days = Array.isArray(j.hariPelaksanaan) && j.hariPelaksanaan.length
      ? j.hariPelaksanaan : [0, 1, 2, 3, 4, 5, 6];
    return [
      j.jadwalId, j.namaKegiatan, j.jamMulai, j.jamSelesai,
      j.toleransiBukaAwal, j.toleransiTutupAkhir, j.wajib,
      j.statusAktif, j.keterangan || "", JSON.stringify(days)
    ];
  });

  sync("BATCH", [
    "BatchID", "NamaBatch", "Tahun", "TanggalMulai", "TanggalSelesai",
    "StatusBatch", "Keterangan", "AgendaKalender"
  ], data.batch, "batchId", function(b) {
    return [
      b.batchId, b.namaBatch, b.tahun, b.tanggalMulai, b.tanggalSelesai,
      b.statusBatch, b.keterangan || "", JSON.stringify(b.agendaKalender || [])
    ];
  });

  sync("IZIN", [
    "IzinID", "PesertaID", "JenisIzin", "WaktuMulai", "WaktuSelesai",
    "Alasan", "StatusPersetujuan", "NomorSurat", "KodeVerifikasi",
    "StatusKedatangan", "WaktuKedatanganKembali", "PetugasVerifikasi",
    "CatatanKedatangan", "DiajukanOleh", "WaktuPengajuan",
    "DiputuskanOleh", "WaktuKeputusan", "CatatanAdmin",
    "BuktiFileID", "AlasanTerlambat"
  ], data.izin, "izinId", function(i) {
    return [
      i.izinId, i.pesertaId, i.jenisIzin, i.waktuMulai, i.waktuSelesai,
      i.alasan, i.statusPersetujuan, i.nomorSurat || "",
      i.kodeVerifikasi || "", i.statusKedatangan || "BELUM_KEMBALI",
      i.waktuKedatanganKembali || "", i.petugasVerifikasi || "",
      i.catatanKedatangan || "", i.diajukanOleh || "", i.waktuPengajuan || "",
      i.diputuskanOleh || "", i.waktuKeputusan || "", i.catatanAdmin || "",
      i.buktiFileId || "", i.alasanTerlambat || ""
    ];
  });

  sync("PEMBENARAN", [
    "PembenaranID", "PesertaID", "JadwalID", "NamaKegiatan",
    "TanggalKejadian", "Alasan", "DiajukanOleh", "WaktuPengajuan",
    "StatusPersetujuan", "DiputuskanOleh", "WaktuKeputusan",
    "CatatanAdmin", "StatusAbsensiSebelum", "StatusAbsensiSesudah"
  ], data.pembenaran, "pembenaranId", function(p) {
    return [
      p.pembenaranId, p.pesertaId, p.jadwalId, p.namaKegiatan,
      p.tanggalKejadian, p.alasan, p.diajukanOleh, p.waktuPengajuan,
      p.statusPersetujuan, p.diputuskanOleh || "", p.waktuKeputusan || "",
      p.catatanAdmin || "", p.statusAbsensiSebelum || "",
      p.statusAbsensiSesudah || ""
    ];
  });

  // Snapshot daftar sesi aktif untuk tanggal laporan.
  // Sesi lama tidak dihapus: sesi yang sudah memiliki data absensi
  // atau pembenaran tetap dipertahankan untuk menjaga riwayat.
  var tanggal = String(data.tanggalLaporan || "").trim();

  if (tanggal && Array.isArray(data.jadwal)) {
    var activeSchedules = getActiveSchedulesForDate_(data.jadwal, tanggal);

    var sessionHeaders = [
      "SesiID", "Tanggal", "JadwalID", "NamaKegiatan",
      "StatusSesi", "UpdatedAt", "Wajib"
    ];

    var activeIds = {};
    activeSchedules.forEach(function(j) {
      activeIds[String(j.jadwalId || "")] = true;
    });

    var previousSessions = readSheetObjects_("SESI_KEGIATAN");
    var savedAttendance = readSheetObjects_("ABSENSI");
    var savedCorrections = readSheetObjects_("PEMBENARAN");

    var obsoleteSessions = previousSessions.filter(function(s) {
      var sessionDate = outputDateKey_(s.Tanggal);
      var scheduleId = String(s.JadwalID || "").trim();
      var status = String(s.StatusSesi || "TERJADWAL");

      if (sessionDate !== tanggal || status !== "TERJADWAL") return false;
      if (!scheduleId || activeIds[scheduleId]) return false;

      var hasAttendance = savedAttendance.some(function(a) {
        return outputDateKey_(a.Tanggal) === tanggal &&
          String(a.JadwalID || "") === scheduleId;
      });

      var hasCorrection = savedCorrections.some(function(c) {
        return outputDateKey_(c.TanggalKejadian) === tanggal &&
          String(c.JadwalID || "") === scheduleId;
      });

      return !hasAttendance && !hasCorrection;
    }).map(function(s) {
      return {
        sesiId: String(s.SesiID || ""),
        tanggal: tanggal,
        jadwalId: String(s.JadwalID || ""),
        namaKegiatan: String(s.NamaKegiatan || ""),
        statusSesi: "DIBATALKAN",
        updatedAt: now,
        wajib: s.Wajib
      };
    });

    function mapSessionRow(s) {
      return [
        s.sesiId, s.tanggal, s.jadwalId, s.namaKegiatan,
        s.statusSesi, s.updatedAt, s.wajib
      ];
    }

    if (obsoleteSessions.length) {
      sync(
        "SESI_KEGIATAN", sessionHeaders, obsoleteSessions,
        "sesiId", mapSessionRow
      );
    }

    var sessionRows = buildSessionRowsForDate_(data.jadwal, tanggal, now);

    sync(
      "SESI_KEGIATAN", sessionHeaders, sessionRows,
      "sesiId", mapSessionRow
    );
  }

  handleGenerateOutputTables(data.tanggalLaporan);
  return {
    success: true,
    message: "Sinkronisasi sumber data selesai. " +
      totals.inserted + " baris baru dan " + totals.updated +
      " baris diperbarui. Data lama yang tidak dikirim tidak dihapus.",
    count: totals.inserted + totals.updated
  };
}


// PEMBUATAN 4 SHEET FORMULA REKAPAN OTOMATIS:
// 1. REKAP_PER_ORANG
// 2. REKAP_HARIAN_KEGIATAN
// 3. REKAP_BATCH
// 4. REKAP_MINGGUAN

function readSheetObjects_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];

  var width = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();

  return values.filter(function(row) {
    return row.some(function(value) { return value !== "" && value !== null; });
  }).map(function(row) {
    var item = {};
    headers.forEach(function(header, index) {
      if (header) item[String(header).trim()] = row[index];
    });
    return item;
  });
}


// Rekonstruksi sesi historis dari catatan absensi yang tersedia.
// Tidak dapat menemukan sesi lama yang sama sekali tidak memiliki scan.
function backfillSessionsFromAttendance_(attendanceRows) {
  var existingSessions = readSheetObjects_("SESI_KEGIATAN");
  var knownIds = {};
  var knownNames = {};

  function addKnown(date, jadwalId, activity) {
    if (!date) return;

    if (jadwalId) knownIds[date + "||" + jadwalId] = true;

    var normalizedName = String(activity || "").trim().toLowerCase();
    if (normalizedName) {
      knownNames[date + "||" + normalizedName] = true;
    }
  }

  existingSessions.forEach(function(session) {
    addKnown(
      outputDateKey_(session.Tanggal),
      String(session.JadwalID || "").trim(),
      String(session.NamaKegiatan || "").trim()
    );
  });

  var missingSessions = [];

  (attendanceRows || []).forEach(function(record) {
    var date = outputDateKey_(
      record.Tanggal || record.WaktuScan || record.WaktuServer
    );
    var jadwalId = String(record.JadwalID || "").trim();
    var activity = String(record.Kegiatan || "").trim();

    if (!date || (!jadwalId && !activity)) return;

    var normalizedName = activity.toLowerCase();
    if (
      (jadwalId && knownIds[date + "||" + jadwalId]) ||
      (normalizedName && knownNames[date + "||" + normalizedName])
    ) {
      return;
    }

    var safeKey = jadwalId || normalizedName
      .replace(/s+/g, "_")
      .replace(/[^w-]/g, "");

    missingSessions.push({
      sesiId: date + "__" + safeKey,
      tanggal: date,
      jadwalId: jadwalId,
      namaKegiatan: activity || jadwalId,
      statusSesi: "TERJADWAL",
      wajib: true,
      updatedAt: record.UpdatedAt || record.WaktuServer || new Date().toISOString()
    });

    addKnown(date, jadwalId, activity);
  });

  if (missingSessions.length > 0) {
    upsertOutputRows_(
      "SESI_KEGIATAN",
      ["SesiID", "Tanggal", "JadwalID", "NamaKegiatan", "StatusSesi", "UpdatedAt", "Wajib"],
      missingSessions,
      "sesiId",
      function(session) {
        return [
          session.sesiId,
          session.tanggal,
          session.jadwalId,
          session.namaKegiatan,
          session.statusSesi,
          session.updatedAt,
          session.wajib
        ];
      }
    );
  }

  return missingSessions.length;
}

function outputDateKey_(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd");
  }
  var s = String(value).trim();
  var match = s.match(/^(d{4}-d{2}-d{2})/);
  return match ? match[1] : s;
}

function writeOutputSheet_(sheetName, values) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  var rowCount = Math.max(values.length, 1);
  var colCount = Math.max(values.length ? values[0].length : 1, 1);

  if (rowCount > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rowCount - sheet.getMaxRows());
  }
  if (colCount > sheet.getMaxColumns()) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), colCount - sheet.getMaxColumns());
  }

  var clearRows = Math.max(sheet.getLastRow(), rowCount, 1);
  var clearCols = Math.max(sheet.getLastColumn(), colCount, 1);
  var range = sheet.getRange(1, 1, clearRows, clearCols);

  // Lepaskan gabungan hanya pada header matriks agar nilai dapat ditulis.
  // Format sel dan aturan format bersyarat tetap dipertahankan.
  if (sheetName === "absensi all") {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  }
  range.clearContent();

  if (values.length && values[0].length) {
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }
  return sheet;
}

function formatOutputHeader_(sheet, columnCount) {
  // Jangan menimpa gaya header dari template.
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setWrap(true)
    .setVerticalAlignment("middle");
}

function handleGenerateOutputTables(reportingDate) {
  migrateLegacyPesertaSheet_();

  var now = new Date();
  var today = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  var nowHm = Utilities.formatDate(now, TIMEZONE, "HH:mm");
  var reportDate = outputDateKey_(reportingDate) || today;
  if (!/^d{4}-d{2}-d{2}$/.test(reportDate)) reportDate = today;

  var monthPrefix = reportDate.substring(0, 7);
  var parts = monthPrefix.split("-");
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var daysInMonth = new Date(year, month, 0).getDate();

  var pesertaRows = readSheetObjects_("DATA_PESERTA");
  var batchRows = readSheetObjects_("BATCH");
  var attendanceRows = readSheetObjects_("ABSENSI");
  backfillSessionsFromAttendance_(attendanceRows);
  var scheduleSessions = readSheetObjects_("SESI_KEGIATAN");
  var leaveRows = readSheetObjects_("IZIN");
  var correctionRows = readSheetObjects_("PEMBENARAN");


  var batchNameById = {};
  batchRows.forEach(function(b) {
    var id = String(b.BatchID || "").trim();
    var name = String(b.NamaBatch || id).trim();
    if (id) batchNameById[id] = name;
    if (name) batchNameById[name] = name;
  });

  function displayBatch_(id) {
    var value = String(id || "Batch 1").trim();
    return batchNameById[value] || value;
  }

  var participants = pesertaRows.filter(function(p) {
    return String(p.PesertaID || "").trim() || String(p.NIM || "").trim();
  }).map(function(p) {
    return {
      id: String(p.PesertaID || ""),
      nim: String(p.NIM || ""),
      name: String(p.NamaLengkap || ""),
      batch: displayBatch_(p.BatchID),
      prodi: String(p.ProgramStudi || ""),
      whatsapp: String(p.NomorWhatsApp || ""),
      email: String(p.Email || ""),
      address: String(p.Alamat || ""),
      gender: String(p.Gender || ""),
      status: String(p.StatusPeserta || "AKTIF").toUpperCase()
    };
  });

  participants.sort(function(a, b) {
    return a.batch.localeCompare(b.batch) || a.nim.localeCompare(b.nim);
  });

  // Hanya peserta aktif yang dihitung dalam matriks dan rekap kehadiran.
  // Sheet master peserta tetap memuat semua peserta.
  var activeParticipants = participants.filter(function(p) {
    return p.status === "AKTIF";
  });

  var genderByPeserta = {};
  participants.forEach(function(p) {
    var gender = String(p.gender || "").toUpperCase();
    if (p.id && gender) {
      genderByPeserta[p.id] =
        gender === "IKHWAN" ? "Ikhwan" :
        gender === "AKHWAT" ? "Akhwat" : gender;
    }
  });

  var sessionsByDate = {};
  scheduleSessions.forEach(function(s) {
    var date = outputDateKey_(s.Tanggal);
    if (!date) return;
    if (s.StatusSesi && String(s.StatusSesi) !== "TERJADWAL") return;
    if (!sessionsByDate[date]) sessionsByDate[date] = [];
    sessionsByDate[date].push(s);
  });

  var sessionDates = Object.keys(sessionsByDate).sort();
  var allDailyStatuses = [];
  var dailyStatusByParticipantDate = {};
  var detailRows = [];
  var detailAttendanceRows = [];

  function latestRecord_(records, date, participantId, session, isCorrection) {
    var matches = records.filter(function(r) {
      var rDate = outputDateKey_(isCorrection ? r.TanggalKejadian : r.Tanggal);
      if (rDate !== date || String(r.PesertaID || "") !== participantId) return false;

      var rowSchedule = String(r.JadwalID || "");
      var sessionSchedule = String(session.JadwalID || "");
      var rowActivity = String(isCorrection ? r.NamaKegiatan || "" : r.Kegiatan || "").toLowerCase();
      var sessionActivity = String(session.NamaKegiatan || "").toLowerCase();

      return (rowSchedule && sessionSchedule && rowSchedule === sessionSchedule) ||
        (!rowSchedule || !sessionSchedule) && rowActivity === sessionActivity;
    });

    matches.sort(function(a, b) {
      var ta = String(a.UpdatedAt || a.WaktuKeputusan || a.WaktuPengajuan || a.WaktuServer || "");
      var tb = String(b.UpdatedAt || b.WaktuKeputusan || b.WaktuPengajuan || b.WaktuServer || "");
      return ta.localeCompare(tb);
    });
    return matches.length ? matches[matches.length - 1] : null;
  }

  function approvedLeave_(participantId, date) {
    for (var i = 0; i < leaveRows.length; i++) {
      var leave = leaveRows[i];
      if (String(leave.PesertaID || "") !== participantId) continue;
      if (String(leave.StatusPersetujuan || "") !== "DISETUJUI") continue;

      var start = outputDateKey_(leave.WaktuMulai);
      var end = outputDateKey_(leave.WaktuSelesai);
      if (start && end && date >= start && date <= end) return leave;
    }
    return null;
  }

  function evaluateSession_(participant, date, session) {
    var isRequired = !(
      session.Wajib === false ||
      String(session.Wajib || "").toUpperCase() === "FALSE"
    );
    var record = latestRecord_(attendanceRows, date, participant.id, session, false);
    if (record && String(record.StatusValidasi || "SAH") === "DIBATALKAN") {
      record = null;
    }

    var correction = latestRecord_(correctionRows, date, participant.id, session, true);
    var leave = approvedLeave_(participant.id, date);
    var code = "?";
    var updateText = "Menunggu konfirmasi";
    var correctionStatus = correction ? String(correction.StatusPersetujuan || "") : "";

    if (correctionStatus === "MENUNGGU") {
      code = "?";
      updateText = "Menunggu persetujuan pembenaran";
    } else if (
      correctionStatus === "DISETUJUI" &&
      String(correction.StatusAbsensiSesudah || "") === "HADIR"
    ) {
      code = "✓";
      updateText = "Hadir — pembenaran disetujui";
    } else if (record && String(record.StatusAbsensi || "") === "HADIR") {
      code = "✓";
      updateText = String(record.StatusValidasi || "") === "DIKOREKSI" ?
        "Hadir — data dikoreksi" : "Tercatat hadir";
    } else if (leave) {
      if (String(leave.StatusKedatangan || "") === "TERLAMBAT" &&
          date >= outputDateKey_(leave.WaktuSelesai)) {
        code = "X";
        updateText = "Alfa — terlambat kembali dari izin";
      } else {
        code = "I";
        updateText = "Izin disetujui";
      }
    } else if (record && String(record.StatusAbsensi || "") === "IZIN") {
      code = "I";
      updateText = "Izin tercatat";
    } else if (record && String(record.StatusAbsensi || "") === "ALPA") {
      code = "X";
      updateText = "Alfa tercatat";
    } else if (!isRequired) {
      code = "";
      updateText = "Kegiatan tidak wajib";
    } else {
      var deadlinePassed = date < today || (date === today && nowHm >= "22:00");
      code = deadlinePassed ? "X" : "?";
      updateText = deadlinePassed ? "Alfa — belum dikoreksi" : "Menunggu konfirmasi";
    }

    var scanned = Boolean(record && (
      String(record.SumberAbsensi || "").toUpperCase() === "SCAN_QR" ||
      String(record.WaktuScan || "").trim()
    ));

    var lastUpdated = record
      ? (record.UpdatedAt || record.WaktuServer || record.WaktuScan || "")
      : correction
        ? (correction.WaktuKeputusan || correction.WaktuPengajuan || "")
        : leave
          ? (leave.WaktuKeputusan || leave.WaktuPengajuan || "")
          : "";

    return {
      code: code,
      record: record,
      correction: correction,
      correctionStatus: correctionStatus,
      activity: String(session.NamaKegiatan || record && record.Kegiatan || ""),
      staff: String(record && (record.MusyrifBertugas || record.PenggunaID) || ""),
      updateText: updateText,
      required: isRequired,
      scanned: scanned,
      sessionId: String(session.SesiID || ""),
      jadwalId: String(session.JadwalID || ""),
      updatedAt: String(lastUpdated || "")
    };
  }

  sessionDates.forEach(function(date) {
    var sessions = sessionsByDate[date] || [];

    activeParticipants.forEach(function(p) {
      var allEvaluations = sessions.map(function(session) {
        return evaluateSession_(p, date, session);
      });

      // Tabel detail mencatat semua peserta pada setiap sesi,
      // termasuk peserta yang tidak melakukan scan.
      allEvaluations.forEach(function(e) {
        detailAttendanceRows.push([
          new Date(date + "T00:00:00+07:00"),
          p.name,
          p.nim,
          p.batch,
          e.activity,
          e.scanned ? "Ya" : "Tidak",
          e.code === "✓" ? 1 : 0,
          e.code === "I" ? 1 : 0,
          e.code === "X" ? 1 : 0,
          e.updateText,
          p.id,
          e.jadwalId,
          e.sessionId,
          e.correctionStatus || "-",
          e.staff || "-",
          e.required ? "Ya" : "Tidak",
          e.updatedAt || ""
        ]);
      });

      // Hanya sesi wajib yang menentukan status harian.
      var evaluations = allEvaluations.filter(function(e) {
        return e.required;
      });
      if (!evaluations.length) return;

      var hasPendingCorrection = evaluations.some(function(e) {
        return e.correctionStatus === "MENUNGGU";
      });
      var codes = evaluations.map(function(e) { return e.code; });
      var dayCode;

      if (codes.indexOf("X") >= 0) {
        dayCode = "X";
      } else if (hasPendingCorrection || codes.indexOf("?") >= 0) {
        dayCode = "?";
      } else if (codes.length > 0 &&
                 codes.every(function(code) { return code === "✓"; })) {
        dayCode = "✓";
      } else if (codes.length > 0 &&
                 codes.some(function(code) { return code === "I"; }) &&
                 codes.every(function(code) { return code === "✓" || code === "I"; })) {
        dayCode = "I";
      } else {
        dayCode = "?";
      }

      var lostActivities = evaluations.filter(function(e) { return e.code !== "✓"; })
        .map(function(e) { return e.activity; }).filter(Boolean);
      var staffNames = evaluations.map(function(e) { return e.staff; })
        .filter(Boolean).filter(function(value, index, list) {
          return list.indexOf(value) === index;
        });
      var correctionStatuses = evaluations.map(function(e) { return e.correctionStatus; })
        .filter(Boolean).filter(function(value, index, list) {
          return list.indexOf(value) === index;
        });

      dailyStatusByParticipantDate[p.id + "||" + date] = dayCode;
      allDailyStatuses.push([
        p.id, p.nim, p.name, p.batch, date, dayCode, evaluations.length,
        lostActivities.join(", "), staffNames.join(", "),
        correctionStatuses.join(", "),
        dayCode === "✓" ? "Hadir" :
          dayCode === "I" ? "Izin" :
          dayCode === "X" ? "Alfa" : "Perlu konfirmasi"
      ]);

      evaluations.forEach(function(e) {
        if (e.code === "✓" &&
            !(e.correction && e.correctionStatus === "DISETUJUI")) return;

        detailRows.push([
          date,
          p.name,
          p.nim,
          p.prodi,
          p.batch,
          e.activity,
          e.staff || "-",
          e.code,
          e.correctionStatus || "-",
          e.updateText
        ]);
      });
    });
  });

  // DATA_STATUS_HARIAN adalah sumber perantara untuk formula rekap.
  var statusHeaders = [
    "PesertaID", "NIM", "NamaLengkap", "Batch", "Tanggal",
    "StatusHarian", "TotalKegiatan", "KegiatanYangDitinggalkan",
    "Petugas", "StatusPembenaran", "UpdateKehadiran"
  ];
  var statusSheet = writeOutputSheet_(
    "DATA_STATUS_HARIAN",
    [statusHeaders].concat(allDailyStatuses)
  );
  formatOutputHeader_(statusSheet, statusHeaders.length);
  statusSheet.autoResizeColumns(1, statusHeaders.length);

  // OUTPUT: detail absensi per kegiatan (sumber untuk semua rekap).
  var detailAttendanceHeaders = [
    "Tanggal", "Nama", "NIM", "Batch", "Kegiatan", "Scan",
    "Hadir", "Izin", "Alfa", "Update", "PesertaID",
    "JadwalID", "SesiID", "Status Pembenaran", "Petugas",
    "Wajib", "Waktu Update"
  ];

  var detailAttendanceSheet = writeOutputSheet_(
    "absensi per kegiatan",
    [detailAttendanceHeaders].concat(detailAttendanceRows)
  );
  formatOutputHeader_(detailAttendanceSheet, detailAttendanceHeaders.length);
  detailAttendanceSheet.autoResizeColumns(1, detailAttendanceHeaders.length);

  if (detailAttendanceRows.length > 0) {
    detailAttendanceSheet.getRange(
      2, 1, detailAttendanceRows.length, 1
    ).setNumberFormat("dd/MM");
  }

  detailAttendanceSheet.setColumnWidth(2, 200);
  detailAttendanceSheet.setColumnWidth(5, 220);
  detailAttendanceSheet.setColumnWidth(10, 260);

  // OUTPUT 1: peserta — mengikuti kolom template.
  var pesertaHeaders = [
    "NIM", "Nama Lengkap", "Batch", "Program Studi",
    "No WhatsApp", "Email", "Alamat"
  ];
  var pesertaOutput = participants.map(function(p) {
    return [p.nim, p.name, p.batch, p.prodi, p.whatsapp, p.email, p.address];
  });
  var pesertaSheet = writeOutputSheet_(
    "peserta",
    [pesertaHeaders].concat(pesertaOutput)
  );
  formatOutputHeader_(pesertaSheet, pesertaHeaders.length);
  pesertaSheet.autoResizeColumns(1, pesertaHeaders.length);
  pesertaSheet.setColumnWidth(2, 220);
  pesertaSheet.setColumnWidth(7, 260);

  // OUTPUT 2: absensi all — blok batch berdampingan, 5 minggu x 7 tanggal.
  var batchNames = [];
  batchRows.forEach(function(b) {
    var name = displayBatch_(b.BatchID || b.NamaBatch);
    if (name && batchNames.indexOf(name) < 0) batchNames.push(name);
  });
  participants.forEach(function(p) {
    if (batchNames.indexOf(p.batch) < 0) batchNames.push(p.batch);
  });
  batchNames.sort();

  if (!batchNames.length) batchNames = ["Batch 1", "Batch 2", "Batch 3"];

  var participantsByBatch = {};
  batchNames.forEach(function(name) { participantsByBatch[name] = []; });
  activeParticipants.forEach(function(p) {
    if (!participantsByBatch[p.batch]) participantsByBatch[p.batch] = [];
    participantsByBatch[p.batch].push(p);
  });

  // Hanya tanggal yang mempunyai sesi tersimpan yang ditampilkan.
  // Urutan kolom berdasarkan tanggal sesi, bukan nama hari kalender.
  var monthDates = sessionDates.filter(function(date) {
    return date.substring(0, 7) === monthPrefix;
  }).sort().slice(0, 31);

  // Lima minggu x enam slot. Slot ke-31 hanya dipakai saat dibutuhkan.
  var slotCount = Math.max(30, monthDates.length);
  var blockContentWidth = 4 + slotCount;
  var blockGap = 2;
  var blockWidth = blockContentWidth + blockGap;
  var totalColumns = (batchNames.length - 1) * blockWidth + blockContentWidth;

  var maxBatchSize = 0;
  batchNames.forEach(function(name) {
    maxBatchSize = Math.max(maxBatchSize, participantsByBatch[name].length);
  });

  var totalRows = Math.max(2 + maxBatchSize, 2);
  var matrix = Array.from({ length: totalRows }, function() {
    return Array(totalColumns).fill("");
  });
  var backgrounds = Array.from({ length: totalRows }, function() {
    return Array(totalColumns).fill("#ffffff");
  });

  batchNames.forEach(function(batchName, batchIndex) {
    var offset = batchIndex * blockWidth;
    var groupParticipants = participantsByBatch[batchName] || [];

    matrix[0][offset] = "NIM";
    matrix[0][offset + 1] = "Nama Lengkap";
    matrix[0][offset + 2] = "Program Studi";
    matrix[0][offset + 3] = "Minggu";

    for (var week = 0; week < 5; week++) {
      matrix[0][offset + 4 + week * 6] = String(week + 1);
    }
    matrix[1][offset + 3] = "TGL";

    for (var d = 0; d < slotCount; d++) {
      var col = offset + 4 + d;
      var isoDate = monthDates[d] || "";

      if (isoDate) {
        matrix[1][col] = new Date(isoDate + "T00:00:00+07:00");
      }

      for (var personIndex = 0; personIndex < groupParticipants.length; personIndex++) {
        var rowIndex = personIndex + 2;
        var person = groupParticipants[personIndex];
        var code = isoDate ?
          dailyStatusByParticipantDate[person.id + "||" + isoDate] || "" : "";

        if (isoDate && !(sessionsByDate[isoDate] || []).length) code = "";
        matrix[rowIndex][col] = code;

        backgrounds[rowIndex][col] =
          code === "✓" ? "#dcfce7" :
          code === "X" ? "#fee2e2" :
          code === "?" ? "#fef3c7" :
          code === "I" ? "#dbeafe" : "#ffffff";
      }
    }

    groupParticipants.forEach(function(person, personIndex) {
      var rowIndex = personIndex + 2;
      matrix[rowIndex][offset] = person.nim;
      matrix[rowIndex][offset + 1] = person.name;
      matrix[rowIndex][offset + 2] = person.prodi;
    });

    for (var colIndex = offset; colIndex < offset + blockContentWidth; colIndex++) {
      backgrounds[0][colIndex] = "#064e3b";
      backgrounds[1][colIndex] = "#d1fae5";
    }

    for (var d2 = 0; d2 < monthDates.length; d2++) {
      var checkDate = monthDates[d2];
      var daySessions = sessionsByDate[checkDate] || [];
      if (!daySessions.length || !groupParticipants.length) continue;

      var allAlfa = groupParticipants.every(function(person) {
        return dailyStatusByParticipantDate[person.id + "||" + checkDate] === "X";
      });

      if (allAlfa) {
        var colRed = offset + 4 + d2;
        for (var participantRow = 2;
             participantRow < groupParticipants.length + 2;
             participantRow++) {
          backgrounds[participantRow][colRed] = "#fecaca";
        }
      }
    }
  });

  var matrixSheet = writeOutputSheet_("absensi all", matrix);
  if (totalRows > 0 && totalColumns > 0) {
    // Warna status hanya diterapkan pada sel tanggal, bukan header
    // atau identitas peserta, agar format template tetap terjaga.
    batchNames.forEach(function(_name, batchIndex) {
      var offset = batchIndex * blockWidth;
      if (totalRows > 2) {
        var bodyBackgrounds = backgrounds.slice(2, totalRows).map(function(row) {
          return row.slice(offset + 4, offset + 4 + slotCount);
        });
        matrixSheet.getRange(3, offset + 5, totalRows - 2, slotCount)
          .setBackgrounds(bodyBackgrounds);
      }
    });
    matrixSheet.getRange(1, 1, 1, totalColumns)
      .setFontColor("#ffffff").setFontWeight("bold").setWrap(true);
    matrixSheet.getRange(2, 1, 1, totalColumns)
      .setFontWeight("bold").setHorizontalAlignment("center");
    matrixSheet.setFrozenRows(2);

    batchNames.forEach(function(name, batchIndex) {
      var offset = batchIndex * blockWidth;
      matrixSheet.setColumnWidth(offset + 1, 95);
      matrixSheet.setColumnWidth(offset + 2, 190);
      matrixSheet.setColumnWidth(offset + 3, 115);
      matrixSheet.setColumnWidth(offset + 4, 65);
      matrixSheet.setColumnWidths(offset + 5, slotCount, 48);
      matrixSheet.getRange(2, offset + 5, 1, slotCount).setNumberFormat("dd/MM");
    });

    // Pulihkan gabungan header sesuai template:
    // tiga kolom identitas membentang dua baris,
    // setiap judul minggu membentang tujuh kolom tanggal.
    batchNames.forEach(function(_name, batchIndex) {
      var offset = batchIndex * blockWidth;

      for (var identityOffset = 0; identityOffset < 3; identityOffset++) {
        matrixSheet.getRange(
          1, offset + identityOffset + 1, 2, 1
        ).merge();
      }

      for (var weekIndex = 0; weekIndex < 5; weekIndex++) {
        var weekStart = weekIndex * 6;
        var weekWidth = weekIndex === 4
          ? slotCount - weekStart
          : Math.min(6, slotCount - weekStart);

        if (weekWidth > 0) {
          matrixSheet.getRange(
            1, offset + 5 + weekStart, 1, weekWidth
          ).merge();
        }
      }
    });
  }

  // OUTPUT 3: rekap absensi — formula menghitung status per hari.
  var rekapHeaders = [
    "NIM", "Nama Lengkap", "Program Studi", "Gender", "Batch",
    "Hadir", "Izin", "Alpa", "Persentase", "Lulus/Tidak", "Evaluasi"
  ];
  var rekapValues = [rekapHeaders];
  var rekapFormulas = [];

  activeParticipants.forEach(function(p, index) {
    var rowNo = index + 2;
    rekapValues.push([
      p.nim, p.name, p.prodi, genderByPeserta[p.id] || "", p.batch,
      "", "", "", "", "", ""
    ]);

    rekapFormulas.push([
      '=COUNTIFS(DATA_STATUS_HARIAN!$B:$B;$A' + rowNo + ';DATA_STATUS_HARIAN!$F:$F;"✓")',
      '=COUNTIFS(DATA_STATUS_HARIAN!$B:$B;$A' + rowNo + ';DATA_STATUS_HARIAN!$F:$F;"I")',
      '=COUNTIFS(DATA_STATUS_HARIAN!$B:$B;$A' + rowNo + ';DATA_STATUS_HARIAN!$F:$F;"X")',
      '=IF(SUM(F' + rowNo + ':H' + rowNo + ')=0;0;F' + rowNo + '/SUM(F' + rowNo + ':H' + rowNo + '))',
      '=IF(SUM(F' + rowNo + ':H' + rowNo + ')=0;"Belum Ada Data";IF(I' + rowNo + '>=0,75;"Lulus";"Tidak Lulus"))',
      '=IF(COUNTIFS(DATA_STATUS_HARIAN!$B:$B;$A' + rowNo + ';DATA_STATUS_HARIAN!$F:$F;"~?")>0;"Perlu Konfirmasi";IF(H' + rowNo + '>0;"Perlu Pembinaan";"Disiplin"))'
    ]);
  });

  var rekapSheet = writeOutputSheet_("rekap absensi", rekapValues);
  if (rekapFormulas.length) {
    rekapSheet.getRange(2, 6, rekapFormulas.length, 6).setFormulas(rekapFormulas);
  }
  formatOutputHeader_(rekapSheet, rekapHeaders.length);
  rekapSheet.autoResizeColumns(1, rekapHeaders.length);
  rekapSheet.setColumnWidth(2, 220);
  rekapSheet.setColumnWidth(11, 180);
  if (rekapFormulas.length) {
    rekapSheet.getRange(2, 9, rekapFormulas.length, 1).setNumberFormat("0.0%");
  }

  // OUTPUT 4: rekap harian — simpan juga riwayat koreksi yang sudah disetujui.
  var harianHeaders = [
    "Tgl", "Nama", "NIM", "Prodi", "Batch",
    "Kegiatan Yang ditinggalkan", "Petugas",
    "Status Kehadiran", "Status Pembenaran", "Update Kehadiran"
  ];
  var harianSheet = writeOutputSheet_(
    "rekap harian",
    [harianHeaders].concat(detailRows)
  );
  formatOutputHeader_(harianSheet, harianHeaders.length);
  harianSheet.autoResizeColumns(1, harianHeaders.length);
  harianSheet.setColumnWidth(2, 200);
  harianSheet.setColumnWidth(6, 280);
  harianSheet.setColumnWidth(10, 240);

  return {
    success: true,
    message: "Lima tabel output berhasil diperbarui. Riwayat sumber mentah dipertahankan.",
    participants: participants.length,
    dates: sessionDates.length,
    batches: batchNames.length,
    rekapHarian: detailRows.length
  };
}

function handleGenerateRekapFormulas() {
  return handleGenerateOutputTables();
}

// BACA DATA REKAPAN DARI SHEET UNTUK KONSUMSI APLIKASI

function handleGetRekapSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPerOrang = ss.getSheetByName("rekap absensi");
  var sheetHarian = ss.getSheetByName("rekap harian");
  var perOrangData = sheetPerOrang ? sheetPerOrang.getDataRange().getDisplayValues() : [];
  var harianData = sheetHarian ? sheetHarian.getDataRange().getDisplayValues() : [];

  return {
    success: true,
    perOrang: perOrangData.slice(1),
    harian: harianData.slice(1),
    batch: []
  };
}

// INISIALISASI STRUKTUR LENGKAP GOOGLE SHEETS
function initAllSheets() {
  migrateLegacyPesertaSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var schema = {
    "DATA_PESERTA": ["PesertaID", "NIM", "NamaLengkap", "BatchID", "ProgramStudi", "Fakultas", "NomorWhatsApp", "Email", "Alamat", "TanggalMasuk", "StatusPeserta", "FotoProfil", "CreatedAt", "UpdatedAt", "Gender"],
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
