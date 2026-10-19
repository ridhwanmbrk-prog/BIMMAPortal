/**
 * Cloudflare Worker Entry Point for BIMMA Absensi
 * Domain: https://absensi.bimma-uab.my.id
 * Database: bimma-absensi-db (dd5dbf9a-56c0-4ee0-85df-a698c7c99e56)
 *
 * Handles:
 * 1. Edge D1 Database API endpoints (/api/*)
 * 2. Clean Path Routing & Deep Links without '#' hashes
 * 3. Dynamic SEO Meta Tag injection per route
 * 4. Strict HTTP 404 for unknown URLs
 * 5. Static Assets delivery via ASSETS binding
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<any>;
  all<T = unknown>(): Promise<{ results?: T[]; meta?: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<any[]>;
  exec<T = unknown>(query: string): Promise<any>;
}

export interface Env {
  DB: D1Database;
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  DOMAIN?: string;
  ENVIRONMENT?: string;
  ADMIN_BOOTSTRAP_SECRET?: string;
}

const DOMAIN = 'https://absensi.bimma-uab.my.id';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

interface RouteMeta {
  title: string;
  description: string;
  robots: string;
  isPublic: boolean;
}

const ROUTE_CONFIG: Record<string, RouteMeta> = {
  '/': {
    title: 'BIMMA Absensi - Presensi & Manajemen Santri PESMA UNISA Bandung',
    description: "Sistem Informasi Presensi & Manajemen Santri BIMMA (Bimbingan Mahasiswa) Pesantren Mahasiswa (PESMA) Universitas 'Aisyiyah Bandung.",
    robots: 'index, follow',
    isPublic: true,
  },
  '/login': {
    title: 'Login Petugas & Santri - BIMMA Absensi UNISA Bandung',
    description: 'Portal autentikasi untuk pengurus, musyrif, dan santri asrama PESMA Universitas Aisyiyah Bandung.',
    robots: 'noindex, follow',
    isPublic: true,
  },
  '/biodata-mahasiswa': {
    title: 'Formulir Biodata Santri BIMMA - PESMA UNISA Bandung',
    description: "Formulir pendaftaran dan pengisian biodata mahasantri baru Pesantren Mahasiswa Universitas 'Aisyiyah Bandung.",
    robots: 'index, follow',
    isPublic: true,
  },
  '/dashboard': {
    title: 'Dashboard Presensi - BIMMA Absensi UNISA Bandung',
    description: 'Dashboard utama presensi halaqah dan kegiatan asrama santri BIMMA.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/peserta-portal': {
    title: 'Portal Kehadiran Santri - BIMMA Absensi UNISA Bandung',
    description: 'Portal kehadiran mandiri, QR scan, dan histori presensi santri.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/laporan-alfa': {
    title: 'Laporan Santri Belum Absen - BIMMA Absensi UNISA Bandung',
    description: 'Rekapitulasi santri yang belum hadir untuk tindak lanjut musyrif dan pengurus.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/rekap-tabel': {
    title: 'Tabel Presensi Harian - BIMMA Absensi UNISA Bandung',
    description: 'Tabel data presensi harian santri, filter kegiatan, dan ekspor spreadsheet.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/jadwal': {
    title: 'Kelola Jadwal & Kegiatan - BIMMA Absensi UNISA Bandung',
    description: 'Manajemen jadwal kegiatan asrama, shalat berjamaah, dan kajian mahasantri.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/petugas': {
    title: 'Kelola Petugas Musyrif - BIMMA Absensi UNISA Bandung',
    description: 'Manajemen akun petugas piket dan musyrif asrama PESMA.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/batch': {
    title: 'Kelola Batch & Kalender - BIMMA Absensi UNISA Bandung',
    description: 'Pengaturan 3 batch periode asrama dan kalender akademik santri.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/peserta': {
    title: 'Data Santri BIMMA - BIMMA Absensi UNISA Bandung',
    description: 'Master data santri BIMMA, filter kamar, dan impor data spreadsheet.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/izin': {
    title: 'ACC & Rekap Perizinan - BIMMA Absensi UNISA Bandung',
    description: 'Verifikasi dan persetujuan surat izin santri meninggalkan asrama.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/pembenaran': {
    title: 'Verifikasi Hadir Telat - BIMMA Absensi UNISA Bandung',
    description: 'Validasi keterlambatan atau lupa scan presensi santri.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/kartu-peserta': {
    title: 'Cetak Kartu & QR Santri - BIMMA Absensi UNISA Bandung',
    description: 'Penerbitan kartu identitas santri digital dan barcode QR scan presensi.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
  '/pengaturan': {
    title: 'Pengaturan Sistem & Database D1 - BIMMA Absensi UNISA Bandung',
    description: 'Konfigurasi integrasi Cloudflare D1 SQL dan sinkronisasi Google Sheets.',
    robots: 'noindex, nofollow',
    isPublic: false,
  },
};

/**
 * BIMMA Worker API security patch
 */

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// Cloudflare Workers production currently rejects a single PBKDF2 operation
// above 100,000 iterations. Keep this value in one constant so the hash metadata
// always matches the actual deriveBits parameters.
const PASSWORD_ITERATIONS = 100_000;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256
  );
  return `pbkdf2$${PASSWORD_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  // Support existing legacy plaintext hashes once, then upgrade them after a successful login.
  if (!stored.startsWith('pbkdf2$')) return password === stored;

  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  // Hashes with a larger count cannot be verified by the production Workers runtime.
  if (!Number.isInteger(iterations) || iterations !== PASSWORD_ITERATIONS) return false;

  try {
    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const actual = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt).buffer as ArrayBuffer, iterations, hash: 'SHA-256' }, key, expected.length * 8
    ));
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function safeUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    namaLengkap: row.nama_lengkap || row.namaLengkap || row.username,
    gender: row.gender || undefined,
    role: row.role,
    pesertaId: row.peserta_id || undefined,
    statusAktif: row.status === 'AKTIF',
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

async function readBearer(request: Request): Promise<string | null> {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function requireSession(request: Request, env: Env): Promise<any | null> {
  const token = await readBearer(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(`
    SELECT s.id AS session_id, s.user_id, s.peserta_id, s.role, s.expires_at,
           u.username, u.status
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(tokenHash).first<any>();

  if (!session) return null;
  if (session.user_id && (!session.username || session.status !== 'AKTIF')) return null;
  return session;
}

function requireRole(session: any, roles: string[]): boolean {
  return !!session && roles.includes(String(session.role || '').toUpperCase());
}

async function createSession(env: Env, user: any, pesertaId?: string | null): Promise<string> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (user.id) {
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, peserta_id, role, token_hash, expires_at, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, datetime('now'))
    `).bind(sessionId, user.id, user.role, tokenHash, expiresAt).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, peserta_id, role, token_hash, expires_at, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, datetime('now'))
    `).bind(sessionId, pesertaId, user.role, tokenHash, expiresAt).run();
  }
  return token;
}

type JsonRow = Record<string, any>;

const RELATIONAL_MIGRATION_ID = 'relational_seed_v1';

function pickText(row: JsonRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function nullableText(row: JsonRow, ...keys: string[]): string | null {
  const value = pickText(row, ...keys);
  return value ? value : null;
}

function dateOnly(value: string): string {
  const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
}

function assertUniqueValues<T>(rows: T[], keyOf: (row: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = keyOf(row);
    if (seen.has(key)) throw new Error(`Koleksi ${label} memiliki ID/NIM duplikat: ${key}.`);
    seen.add(key);
  }
}

function parseCollectionArray(raw: unknown, key: string): JsonRow[] {
  if (raw === null || raw === undefined || raw === '') return [];
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); }
    catch { throw new Error(`Koleksi ${key} berisi JSON yang tidak valid.`); }
  }
  if (!Array.isArray(value)) throw new Error(`Koleksi ${key} bukan array.`);
  if (value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Koleksi ${key} memiliki record dengan format tidak valid.`);
  }
  return value as JsonRow[];
}

async function readStoredCollection(env: Env, key: string): Promise<JsonRow[]> {
  const stored = await env.DB.prepare(
    'SELECT value_json FROM app_collections WHERE collection_key = ?'
  ).bind(key).first<any>();
  if (!stored) return [];
  return parseCollectionArray(String(stored.value_json ?? '[]'), key);
}

async function runInChunks(env: Env, statements: D1PreparedStatement[], chunkSize = 80): Promise<void> {
  for (let offset = 0; offset < statements.length; offset += chunkSize) {
    await env.DB.batch(statements.slice(offset, offset + chunkSize));
  }
}

function normalizeBatchRow(row: JsonRow): {
  id: string; nama: string; start: string; end: string; status: string;
  tahun: string | null; keterangan: string | null; dataJson: string;
  createdAt: string | null; updatedAt: string | null;
} {
  const id = pickText(row, 'batchId', 'batch_id', 'id');
  const nama = pickText(row, 'namaBatch', 'nama_batch', 'nama');
  const start = dateOnly(pickText(row, 'tanggalMulai', 'tanggal_mulai'));
  const end = dateOnly(pickText(row, 'tanggalSelesai', 'tanggal_selesai'));
  if (!id || !nama || !start || !end) {
    throw new Error('Koleksi BATCH belum dapat dimigrasikan: setiap batch harus memiliki ID, nama, tanggal mulai, dan tanggal selesai.');
  }
  return {
    id, nama, start, end,
    status: pickText(row, 'statusBatch', 'status_batch', 'status') || 'AKTIF',
    tahun: nullableText(row, 'tahun'),
    keterangan: nullableText(row, 'keterangan'),
    dataJson: JSON.stringify(row),
    createdAt: nullableText(row, 'createdAt', 'created_at'),
    updatedAt: nullableText(row, 'updatedAt', 'updated_at'),
  };
}

function normalizeParticipantRow(row: JsonRow): {
  id: string; nim: string; nama: string; jurusan: string | null; gender: string | null;
  whatsapp: string | null; email: string | null; alamat: string | null; tanggalMasuk: string | null;
  status: string; batchId: string; dataJson: string; createdAt: string | null; updatedAt: string | null;
} {
  const id = pickText(row, 'pesertaId', 'peserta_id', 'id');
  const nim = pickText(row, 'nim');
  const nama = pickText(row, 'namaLengkap', 'nama_lengkap', 'nama');
  if (!id || !nim || !nama) {
    throw new Error('Koleksi PESERTA belum dapat dimigrasikan: setiap peserta harus memiliki ID, NIM, dan nama.');
  }
  return {
    id, nim, nama,
    jurusan: nullableText(row, 'programStudi', 'program_studi', 'jurusan'),
    gender: nullableText(row, 'gender'),
    whatsapp: nullableText(row, 'nomorWhatsApp', 'nomor_whatsapp'),
    email: nullableText(row, 'email'),
    alamat: nullableText(row, 'alamat'),
    tanggalMasuk: nullableText(row, 'tanggalMasuk', 'tanggal_masuk'),
    status: pickText(row, 'statusPeserta', 'status_peserta', 'status') || 'AKTIF',
    batchId: pickText(row, 'batchId', 'batch_id'),
    dataJson: JSON.stringify(row),
    createdAt: nullableText(row, 'createdAt', 'created_at'),
    updatedAt: nullableText(row, 'updatedAt', 'updated_at'),
  };
}

function normalizeIzinRow(row: JsonRow): {
  id: string; pesertaId: string; startDate: string; endDate: string; alasan: string | null;
  status: string; jenis: string | null; startTime: string | null; endTime: string | null;
  diajukanOleh: string | null; waktuPengajuan: string | null; diputuskanOleh: string | null;
  waktuKeputusan: string | null; catatanAdmin: string | null; buktiFileId: string | null;
  nomorSurat: string | null; kodeVerifikasi: string | null; statusKedatangan: string | null;
  waktuKedatangan: string | null; petugasVerifikasi: string | null; catatanKedatangan: string | null;
  alasanTerlambat: string | null; dataJson: string; createdAt: string | null; updatedAt: string | null;
} {
  const id = pickText(row, 'izinId', 'izin_id', 'id');
  const pesertaId = pickText(row, 'pesertaId', 'peserta_id');
  const startTime = pickText(row, 'waktuMulai', 'waktu_mulai', 'tanggalMulai', 'tanggal_mulai', 'tanggal');
  const endTime = pickText(row, 'waktuSelesai', 'waktu_selesai', 'tanggalSelesai', 'tanggal_selesai') || startTime;
  const startDate = dateOnly(startTime);
  const endDate = dateOnly(endTime);
  if (!id || !pesertaId || !startDate || !endDate) {
    throw new Error('Koleksi IZIN belum dapat dimigrasikan: setiap izin harus memiliki ID, peserta, dan waktu/tanggal mulai serta selesai yang valid. Data JSON lama tetap dipertahankan.');
  }
  return {
    id, pesertaId, startDate, endDate,
    alasan: nullableText(row, 'alasan'),
    status: pickText(row, 'statusPersetujuan', 'status_persetujuan', 'status') || 'MENUNGGU',
    jenis: nullableText(row, 'jenisIzin', 'jenis_izin'),
    startTime: startTime || null,
    endTime: endTime || null,
    diajukanOleh: nullableText(row, 'diajukanOleh', 'diajukan_oleh'),
    waktuPengajuan: nullableText(row, 'waktuPengajuan', 'waktu_pengajuan'),
    diputuskanOleh: nullableText(row, 'diputuskanOleh', 'diputuskan_oleh'),
    waktuKeputusan: nullableText(row, 'waktuKeputusan', 'waktu_keputusan'),
    catatanAdmin: nullableText(row, 'catatanAdmin', 'catatan_admin'),
    buktiFileId: nullableText(row, 'buktiFileId', 'bukti_file_id'),
    nomorSurat: nullableText(row, 'nomorSurat', 'nomor_surat'),
    kodeVerifikasi: nullableText(row, 'kodeVerifikasi', 'kode_verifikasi'),
    statusKedatangan: nullableText(row, 'statusKedatangan', 'status_kedatangan'),
    waktuKedatangan: nullableText(row, 'waktuKedatanganKembali', 'waktu_kedatangan_kembali'),
    petugasVerifikasi: nullableText(row, 'petugasVerifikasi', 'petugas_verifikasi'),
    catatanKedatangan: nullableText(row, 'catatanKedatangan', 'catatan_kedatangan'),
    alasanTerlambat: nullableText(row, 'alasanTerlambat', 'alasan_terlambat'),
    dataJson: JSON.stringify(row),
    createdAt: nullableText(row, 'waktuPengajuan', 'createdAt', 'created_at'),
    updatedAt: nullableText(row, 'waktuKeputusan', 'updatedAt', 'updated_at', 'waktuPengajuan', 'createdAt'),
  };
}

async function upsertBatches(env: Env, rows: JsonRow[]): Promise<void> {
  const normalized = rows.map(normalizeBatchRow);
  const statements = normalized.map(row => env.DB.prepare(`
    INSERT INTO batch (id, nama, tanggal_mulai, tanggal_selesai, status, tahun, keterangan, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
    ON CONFLICT(id) DO UPDATE SET
      nama = excluded.nama, tanggal_mulai = excluded.tanggal_mulai,
      tanggal_selesai = excluded.tanggal_selesai, status = excluded.status,
      tahun = excluded.tahun, keterangan = excluded.keterangan,
      data_json = excluded.data_json, updated_at = datetime('now')
  `).bind(row.id, row.nama, row.start, row.end, row.status, row.tahun, row.keterangan,
    row.dataJson, row.createdAt, row.updatedAt));
  await runInChunks(env, statements);
}

async function upsertParticipants(env: Env, rows: JsonRow[]): Promise<ReturnType<typeof normalizeParticipantRow>[]> {
  const normalized = rows.map(normalizeParticipantRow);
  const statements = normalized.map(row => env.DB.prepare(`
    INSERT INTO peserta (id, nim, nama, jurusan, gender, nomor_whatsapp, email, alamat, tanggal_masuk, status, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
    ON CONFLICT(id) DO UPDATE SET
      nim = excluded.nim, nama = excluded.nama, jurusan = excluded.jurusan,
      gender = excluded.gender, nomor_whatsapp = excluded.nomor_whatsapp,
      email = excluded.email, alamat = excluded.alamat, tanggal_masuk = excluded.tanggal_masuk,
      status = excluded.status, data_json = excluded.data_json, updated_at = datetime('now')
  `).bind(row.id, row.nim, row.nama, row.jurusan, row.gender, row.whatsapp, row.email,
    row.alamat, row.tanggalMasuk, row.status, row.dataJson, row.createdAt, row.updatedAt));
  await runInChunks(env, statements);
  return normalized;
}

async function validateParticipantBatchReferences(
  env: Env,
  rows: ReturnType<typeof normalizeParticipantRow>[],
  additionalBatchIds: string[] = [],
): Promise<void> {
  const batchResult = await env.DB.prepare('SELECT id FROM batch').all<any>();
  const batchIds = new Set((batchResult.results || []).map(row => String(row.id)));
  additionalBatchIds.forEach(id => batchIds.add(id));
  const missingBatch = rows.find(row => row.batchId && !batchIds.has(row.batchId));
  if (missingBatch) {
    throw new Error(`Koleksi PESERTA merujuk ke batch \"${missingBatch.batchId}\" yang belum ada di tabel batch. Simpan batch terlebih dahulu.`);
  }
}

async function syncBatchParticipantLinks(env: Env, rows: JsonRow[]): Promise<void> {
  const normalized = rows.map(normalizeParticipantRow);
  await validateParticipantBatchReferences(env, normalized);

  const statements: D1PreparedStatement[] = [];
  for (const row of normalized) {
    // Replace only this participant's current batch link. Keep the participant
    // record itself intact because historical izin/attendance rows may reference it.
    if (row.batchId) {
      statements.push(env.DB.prepare(
        'DELETE FROM batch_peserta WHERE peserta_id = ? AND batch_id <> ?'
      ).bind(row.id, row.batchId));
      statements.push(env.DB.prepare(
        'INSERT OR IGNORE INTO batch_peserta (batch_id, peserta_id) VALUES (?, ?)'
      ).bind(row.batchId, row.id));
    } else {
      statements.push(env.DB.prepare('DELETE FROM batch_peserta WHERE peserta_id = ?').bind(row.id));
    }
  }
  await runInChunks(env, statements);
}

async function upsertIzin(env: Env, rows: JsonRow[]): Promise<void> {
  const normalized = rows.map(normalizeIzinRow);
  assertUniqueValues(normalized, row => row.id, 'IZIN');
  const participantResult = await env.DB.prepare('SELECT id FROM peserta').all<any>();
  const participantIds = new Set((participantResult.results || []).map(row => String(row.id)));
  const unknownParticipant = normalized.find(row => !participantIds.has(row.pesertaId));
  if (unknownParticipant) {
    throw new Error(`Koleksi IZIN merujuk ke peserta \"${unknownParticipant.pesertaId}\" yang tidak ada di tabel peserta.`);
  }
  const statements = normalized.map(row => env.DB.prepare(`
    INSERT INTO izin (
      id, peserta_id, tanggal_mulai, tanggal_selesai, alasan, status, jenis_izin,
      waktu_mulai, waktu_selesai, diajukan_oleh, waktu_pengajuan, diputuskan_oleh,
      waktu_keputusan, catatan_admin, bukti_file_id, nomor_surat, kode_verifikasi,
      status_kedatangan, waktu_kedatangan_kembali, petugas_verifikasi,
      catatan_kedatangan, alasan_terlambat, data_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
    ON CONFLICT(id) DO UPDATE SET
      peserta_id = excluded.peserta_id, tanggal_mulai = excluded.tanggal_mulai,
      tanggal_selesai = excluded.tanggal_selesai, alasan = excluded.alasan,
      status = excluded.status, jenis_izin = excluded.jenis_izin,
      waktu_mulai = excluded.waktu_mulai, waktu_selesai = excluded.waktu_selesai,
      diajukan_oleh = excluded.diajukan_oleh, waktu_pengajuan = excluded.waktu_pengajuan,
      diputuskan_oleh = excluded.diputuskan_oleh, waktu_keputusan = excluded.waktu_keputusan,
      catatan_admin = excluded.catatan_admin, bukti_file_id = excluded.bukti_file_id,
      nomor_surat = excluded.nomor_surat, kode_verifikasi = excluded.kode_verifikasi,
      status_kedatangan = excluded.status_kedatangan,
      waktu_kedatangan_kembali = excluded.waktu_kedatangan_kembali,
      petugas_verifikasi = excluded.petugas_verifikasi,
      catatan_kedatangan = excluded.catatan_kedatangan,
      alasan_terlambat = excluded.alasan_terlambat,
      data_json = excluded.data_json, updated_at = datetime('now')
  `).bind(
    row.id, row.pesertaId, row.startDate, row.endDate, row.alasan, row.status,
    row.jenis, row.startTime, row.endTime, row.diajukanOleh, row.waktuPengajuan,
    row.diputuskanOleh, row.waktuKeputusan, row.catatanAdmin, row.buktiFileId,
    row.nomorSurat, row.kodeVerifikasi, row.statusKedatangan, row.waktuKedatangan,
    row.petugasVerifikasi, row.catatanKedatangan, row.alasanTerlambat,
    row.dataJson, row.createdAt, row.updatedAt));
  await runInChunks(env, statements);
}

async function isRelationalSeedComplete(env: Env): Promise<boolean> {
  const row = await env.DB.prepare('SELECT id FROM app_config WHERE id = ?')
    .bind(RELATIONAL_MIGRATION_ID).first<any>();
  return !!row;
}

/**
 * One-time, idempotent seed from the existing JSON collections into their
 * structured D1 tables. The legacy collections are intentionally not deleted;
 * this keeps the current UI working while relational parity is verified.
 */
async function seedRelationalTablesFromCollections(env: Env): Promise<{ batches: number; participants: number; izin: number }> {
  if (await isRelationalSeedComplete(env)) return { batches: 0, participants: 0, izin: 0 };

  const [batchRows, participantRows, izinRows] = await Promise.all([
    readStoredCollection(env, 'BATCH'),
    readStoredCollection(env, 'PESERTA'),
    readStoredCollection(env, 'IZIN'),
  ]);

  // Validate all source collections before any writes so malformed, duplicate,
  // or orphaned records fail early instead of leaving a partial seed behind.
  const normalizedBatches = batchRows.map(normalizeBatchRow);
  const normalizedParticipants = participantRows.map(normalizeParticipantRow);
  const normalizedIzin = izinRows.map(normalizeIzinRow);
  assertUniqueValues(normalizedBatches, row => row.id, 'BATCH');
  assertUniqueValues(normalizedParticipants, row => row.id, 'PESERTA');
  assertUniqueValues(normalizedParticipants, row => row.nim, 'PESERTA (NIM)');
  assertUniqueValues(normalizedIzin, row => row.id, 'IZIN');

  const batchIds = new Set(normalizedBatches.map(row => row.id));
  const participantWithMissingBatch = normalizedParticipants.find(row => row.batchId && !batchIds.has(row.batchId));
  if (participantWithMissingBatch) {
    throw new Error(`Koleksi PESERTA merujuk ke batch \"${participantWithMissingBatch.batchId}\" yang tidak ditemukan pada koleksi BATCH.`);
  }
  const participantIds = new Set(normalizedParticipants.map(row => row.id));
  const izinWithMissingParticipant = normalizedIzin.find(row => !participantIds.has(row.pesertaId));
  if (izinWithMissingParticipant) {
    throw new Error(`Koleksi IZIN merujuk ke peserta \"${izinWithMissingParticipant.pesertaId}\" yang tidak ditemukan pada koleksi PESERTA.`);
  }

  await upsertBatches(env, batchRows);
  await upsertParticipants(env, participantRows);
  await syncBatchParticipantLinks(env, participantRows);
  await upsertIzin(env, izinRows);

  const report = JSON.stringify({
    version: 1,
    completedAt: new Date().toISOString(),
    batches: batchRows.length,
    participants: participantRows.length,
    izin: izinRows.length,
    source: 'app_collections',
  });
  await env.DB.prepare(`
    INSERT INTO app_config (id, value_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')
  `).bind(RELATIONAL_MIGRATION_ID, report).run();

  return { batches: batchRows.length, participants: participantRows.length, izin: izinRows.length };
}

async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (path === '/health' || path === '/d1/health') {
    try {
      const result = await env.DB.prepare('SELECT 1 AS test').first();
      return jsonResponse({
        success: true, connected: true, databaseName: 'bimma-absensi-db',
        databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
        test: result, timestamp: new Date().toISOString()
      });
    } catch {
      return jsonResponse({ success: false, connected: false, message: 'D1 tidak dapat diakses.' }, 503);
    }
  }

  if (!env?.DB) {
    return jsonResponse({ success: false, message: 'Binding D1 DB tidak tersedia.' }, 503);
  }

  try {
    // One-time bootstrap: only creates the first admin if there are no admin users.
    if (path === '/admin/bootstrap' && request.method === 'POST') {
      if (!env.ADMIN_BOOTSTRAP_SECRET) {
        return jsonResponse({ success: false, message: 'ADMIN_BOOTSTRAP_SECRET belum dikonfigurasi.' }, 503);
      }
      const supplied = request.headers.get('X-Admin-Bootstrap-Secret') || '';
      if (supplied.length < 1 || supplied !== env.ADMIN_BOOTSTRAP_SECRET) {
        return jsonResponse({ success: false, message: 'Secret bootstrap tidak valid.' }, 401);
      }
      const adminCount = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'"
      ).first<any>();
      if (Number(adminCount?.count || 0) > 0) {
        return jsonResponse({ success: false, message: 'Admin sudah tersedia; bootstrap dinonaktifkan.' }, 409);
      }
      const body = await request.json() as any;
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (username.length < 3 || password.length < 12) {
        return jsonResponse({ success: false, message: 'Username minimal 3 karakter dan password minimal 12 karakter.' }, 400);
      }
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      await env.DB.prepare(`
        INSERT INTO users (id, username, password_hash, role, peserta_id, status, created_at, updated_at)
        VALUES (?, ?, ?, 'ADMIN', NULL, 'AKTIF', datetime('now'), datetime('now'))
      `).bind(id, username, passwordHash).run();
      return jsonResponse({ success: true, message: 'Admin pertama berhasil dibuat. Hapus/nonaktifkan secret bootstrap setelah digunakan.' }, 201);
    }

    // Public self-service biodata routes. They expose only a single participant
    // and permit changes only to contact fields after matching both ID and NIM.
    if ((path === '/public/participant' || path === '/d1/public/participant') && request.method === 'GET') {
      const key = String(url.searchParams.get('key') || '').trim();
      if (!key || key.length > 256) return jsonResponse({ success: false, message: 'NIM atau ID peserta tidak valid.' }, 400);
      const stored = await env.DB.prepare("SELECT value_json FROM app_collections WHERE collection_key = 'PESERTA'").first<any>();
      if (!stored?.value_json) return jsonResponse({ success: false, message: 'Data peserta belum dimigrasikan. Hubungi admin agar migrasi awal dilakukan.' }, 503);
      let participants: any[];
      try { participants = JSON.parse(String(stored.value_json)); } catch { return jsonResponse({ success: false, message: 'Data peserta di database rusak.' }, 500); }
      if (!Array.isArray(participants)) return jsonResponse({ success: false, message: 'Format data peserta tidak valid.' }, 500);
      const qrSeparator = key.lastIndexOf('-');
      const qrId = qrSeparator > 0 ? key.slice(0, qrSeparator).trim() : '';
      const qrNim = qrSeparator > 0 ? key.slice(qrSeparator + 1).trim() : '';
      const p = participants.find((item: any) => {
        const itemId = String(item?.pesertaId || item?.peserta_id || item?.id || '').trim();
        const itemNim = String(item?.nim || '').trim();
        return itemNim === key || itemId === key || (!!qrId && !!qrNim && itemId === qrId && itemNim === qrNim);
      });
      if (!p) return jsonResponse({ success: false, message: 'NIM/ID atau QR tidak ditemukan dalam database peserta.' }, 404);
      const peserta = {
        pesertaId: String(p.pesertaId || p.peserta_id || p.id || ''), nim: String(p.nim || ''),
        namaLengkap: String(p.namaLengkap || p.nama_lengkap || p.nama || ''),
        batchId: String(p.batchId || p.batch_id || ''), programStudi: String(p.programStudi || p.program_studi || p.jurusan || ''),
        email: String(p.email || ''), nomorWhatsApp: String(p.nomorWhatsApp || p.nomor_whatsapp || ''),
        alamat: String(p.alamat || ''), tanggalMasuk: String(p.tanggalMasuk || p.tanggal_masuk || ''),
        statusPeserta: String(p.statusPeserta || p.status_peserta || p.status || 'AKTIF'),
      };
      return jsonResponse({ success: true, peserta });
    }

    if ((path === '/public/participant-biodata' || path === '/d1/public/participant-biodata') && request.method === 'POST') {
      const body = await request.json() as any;
      const participantId = String(body.pesertaId || '').trim();
      const nim = String(body.nim || '').trim();
      const email = String(body.email || '').trim().slice(0, 254);
      const nomorWhatsApp = String(body.nomorWhatsApp || '').trim().slice(0, 40);
      const alamat = String(body.alamat || '').trim().slice(0, 1000);
      if (!participantId || !nim || participantId.length > 256 || nim.length > 64) {
        return jsonResponse({ success: false, message: 'ID peserta dan NIM wajib diisi.' }, 400);
      }
      const stored = await env.DB.prepare("SELECT value_json FROM app_collections WHERE collection_key = 'PESERTA'").first<any>();
      if (!stored?.value_json) return jsonResponse({ success: false, message: 'Data peserta belum dimigrasikan. Hubungi admin.' }, 503);
      let participants: any[];
      try { participants = JSON.parse(String(stored.value_json)); } catch { return jsonResponse({ success: false, message: 'Data peserta di database rusak.' }, 500); }
      if (!Array.isArray(participants)) return jsonResponse({ success: false, message: 'Format data peserta tidak valid.' }, 500);
      const index = participants.findIndex((item: any) => String(item?.nim || '').trim() === nim && String(item?.pesertaId || item?.peserta_id || item?.id || '').trim() === participantId);
      if (index < 0) return jsonResponse({ success: false, message: 'ID peserta dan NIM tidak cocok.' }, 403);
      const updatedAt = new Date().toISOString();
      participants[index] = { ...participants[index], email, nomorWhatsApp, alamat, updatedAt };
      const jsonValue = JSON.stringify(participants);
      if (jsonValue.length > 2_000_000) return jsonResponse({ success: false, message: 'Data peserta melebihi batas ukuran.' }, 413);
      await env.DB.batch([
        env.DB.prepare(`UPDATE peserta SET email = ?, nomor_whatsapp = ?, alamat = ?, data_json = ?, updated_at = datetime('now') WHERE id = ? AND nim = ?`)
          .bind(email, nomorWhatsApp, alamat, JSON.stringify(participants[index]), participantId, nim),
        env.DB.prepare(`INSERT INTO app_collections (collection_key, value_json, updated_at) VALUES ('PESERTA', ?, datetime('now')) ON CONFLICT(collection_key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`)
          .bind(jsonValue),
      ]);
      const p = participants[index];
      return jsonResponse({ success: true, message: 'Biodata tersimpan di Cloudflare D1.', peserta: {
        pesertaId: String(p.pesertaId || participantId), nim: String(p.nim), namaLengkap: String(p.namaLengkap || p.nama || ''),
        batchId: String(p.batchId || ''), programStudi: String(p.programStudi || p.jurusan || ''),
        email: String(p.email || ''), nomorWhatsApp: String(p.nomorWhatsApp || ''), alamat: String(p.alamat || ''),
        tanggalMasuk: String(p.tanggalMasuk || ''), statusPeserta: String(p.statusPeserta || p.status || 'AKTIF'), updatedAt,
      }});
    }

    // Participant login: QR payload format is "pesertaId-NIM".
    // Split at the final hyphen so participant IDs may themselves contain hyphens.
    // Staff/admin login remains on the existing password-protected endpoint.
    if ((path === '/login-peserta' || path === '/d1/login-peserta') && request.method === 'POST') {
      const body = await request.json() as any;
      const qrPayload = String(body.qrValue || body.nim || body.key || '').trim();
      const separatorIndex = qrPayload.lastIndexOf('-');
      if (!qrPayload || qrPayload.length > 256 || separatorIndex <= 0 || separatorIndex === qrPayload.length - 1) {
        return jsonResponse({ success: false, message: 'Format QR tidak valid. QR harus berisi ID peserta-NIM.' }, 400);
      }
      const participantIdFromQr = qrPayload.slice(0, separatorIndex).trim();
      const nim = qrPayload.slice(separatorIndex + 1).trim();
      if (!participantIdFromQr || !nim || nim.includes('-')) {
        return jsonResponse({ success: false, message: 'Format QR tidak valid. Periksa ID peserta dan NIM.' }, 400);
      }

      // Inspect the existing D1 schema instead of assuming participant column names.
      const columnsResult = await env.DB.prepare('PRAGMA table_info(peserta)').all<any>();
      const columns = columnsResult.results || [];
      const columnByName = new Map<string, string>(
        columns.map((column: any) => [String(column.name).toLowerCase(), String(column.name)])
      );
      const nimColumn = ['nim', 'nim_mahasiswa', 'nomor_induk', 'nomorinduk']
        .map(name => columnByName.get(name))
        .find(Boolean);
      const participantIdColumn = ['peserta_id', 'pesertaid', 'id']
        .map(name => columnByName.get(name))
        .find(Boolean);

      if (!nimColumn || !participantIdColumn) {
        return jsonResponse({
          success: false,
          message: 'Kolom ID peserta atau NIM tidak ditemukan pada tabel peserta. Login belum dapat diproses.'
        }, 503);
      }

      const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const participant = await env.DB.prepare(
        `SELECT * FROM peserta WHERE TRIM(CAST(${quoteIdentifier(participantIdColumn)} AS TEXT)) = ? AND TRIM(CAST(${quoteIdentifier(nimColumn)} AS TEXT)) = ? LIMIT 1`
      ).bind(participantIdFromQr, nim).first<any>();

      if (!participant) {
        return jsonResponse({ success: false, message: 'ID peserta dan NIM pada QR tidak cocok dengan data peserta.' }, 401);
      }

      // When the canonical collection exists, it is authoritative for login too.
      // This prevents stale rows left in the legacy relational table from logging in
      // after a participant was removed from the active D1 collection.
      const canonicalCollection = await env.DB.prepare("SELECT value_json FROM app_collections WHERE collection_key = 'PESERTA'").first<any>();
      let canonicalParticipant: any = null;
      if (canonicalCollection?.value_json) {
        try {
          const canonicalRows = JSON.parse(String(canonicalCollection.value_json));
          if (Array.isArray(canonicalRows)) {
            canonicalParticipant = canonicalRows.find((item: any) =>
              String(item?.pesertaId || item?.peserta_id || item?.id || '').trim() === participantIdFromQr &&
              String(item?.nim || '').trim() === nim
            ) || null;
          }
        } catch {
          return jsonResponse({ success: false, message: 'Koleksi peserta D1 tidak valid.' }, 503);
        }
        if (!canonicalParticipant) {
          return jsonResponse({ success: false, message: 'Peserta tidak ditemukan pada data aktif D1. Hubungi admin.' }, 401);
        }
      }

      const statusColumn = ['status', 'status_aktif', 'statusaktif', 'aktif', 'is_active', 'isactive']
        .map(name => columnByName.get(name))
        .find(Boolean);
      if (statusColumn) {
        const rawStatus = canonicalParticipant
          ? (canonicalParticipant.statusPeserta || canonicalParticipant.status_peserta || canonicalParticipant.status || 'AKTIF')
          : participant[statusColumn];
        const normalizedStatus = String(rawStatus ?? '').trim().toUpperCase();
        const explicitlyInactive = rawStatus === 0 || rawStatus === false ||
          ['NONAKTIF', 'NON-AKTIF', 'TIDAK AKTIF', 'INACTIVE', 'INAKTIF', 'FALSE', '0', 'TIDAK', 'BELUM_AKTIF', 'BELUM AKTIF', 'SELESAI', 'LULUS'].includes(normalizedStatus);
        if (explicitlyInactive) {
          return jsonResponse({ success: false, message: 'Peserta berstatus tidak aktif.' }, 403);
        }
      }

      const participantId = String(participant[participantIdColumn] || participantIdFromQr);
      const nameColumn = ['nama_lengkap', 'namalengkap', 'nama', 'name'].map(name => columnByName.get(name)).find(Boolean);
      const participantName = String((canonicalParticipant && (canonicalParticipant.namaLengkap || canonicalParticipant.nama_lengkap || canonicalParticipant.nama)) || (nameColumn && participant[nameColumn]) || nim);

      const token = await createSession(env, { role: 'PESERTA' }, participantId);
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, user_id, aksi, entitas, entitas_id, detail_json, created_at)
        VALUES (?, NULL, 'LOGIN_QR_PESERTA', 'PESERTA', ?, ?, datetime('now'))
      `).bind(crypto.randomUUID(), participantId, JSON.stringify({ nim, method: 'QR' })).run();
      return jsonResponse({
        success: true,
        token,
        expiresIn: 604800,
        type: 'PESERTA',
        user: {
          id: participantId,
          username: nim,
          namaLengkap: participantName,
          role: 'PESERTA',
          pesertaId: participantId,
          statusAktif: true
        },
        peserta: canonicalParticipant || participant
      });
    }

    if ((path === '/login' || path === '/d1/login') && request.method === 'POST') {
      const body = await request.json() as any;
      const key = String(body.key || body.username || '').trim();
      const password = String(body.password || '');
      if (!key || !password) {
        return jsonResponse({ success: false, message: 'Username/NIM dan password wajib diisi.' }, 400);
      }

      const user = await env.DB.prepare(`
        SELECT id, username, password_hash, nama_lengkap, gender, role, peserta_id, status
        FROM users
        WHERE lower(username) = lower(?) OR lower(id) = lower(?)
        LIMIT 1
      `).bind(key, key).first<any>();

      if (!user || user.status !== 'AKTIF') {
        return jsonResponse({ success: false, message: 'Akun tidak ditemukan atau tidak aktif.' }, 401);
      }
      if (!await verifyPassword(password, String(user.password_hash || ''))) {
        return jsonResponse({ success: false, message: 'Username atau password salah.' }, 401);
      }

      // Upgrade legacy plaintext password to PBKDF2 after successful verification.
      if (!String(user.password_hash).startsWith('pbkdf2$')) {
        const upgraded = await hashPassword(password);
        await env.DB.prepare(
          "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(upgraded, user.id).run();
      }

      const token = await createSession(env, user);
      return jsonResponse({ success: true, token, expiresIn: 604800, type: 'USER', user: safeUser(user) });
    }

    if ((path === '/logout' || path === '/d1/logout') && request.method === 'POST') {
      const token = await readBearer(request);
      if (token) {
        await env.DB.prepare(
          "UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL"
        ).bind(await sha256Hex(token)).run();
      }
      return jsonResponse({ success: true, message: 'Sesi telah diakhiri.' });
    }

    if ((path === '/me' || path === '/d1/me') && request.method === 'GET') {
      const session = await requireSession(request, env);
      if (!session) return jsonResponse({ success: false, message: 'Sesi tidak valid atau sudah berakhir.' }, 401);
      const user = await env.DB.prepare(
        'SELECT id, username, role, peserta_id, status FROM users WHERE id = ?'
      ).bind(session.user_id).first<any>();
      return jsonResponse({ success: true, user: user ? safeUser(user) : {
        id: session.peserta_id, role: session.role, pesertaId: session.peserta_id
      }});
    }

    // No unauthenticated arbitrary SQL endpoint.
    if (path === '/query' || path === '/d1/query') {
      return jsonResponse({ success: false, message: 'Endpoint query SQL bebas dinonaktifkan.' }, 404);
    }

    if ((path === '/users/import-legacy' || path === '/d1/users/import-legacy') && request.method === 'POST') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN'])) return jsonResponse({ success: false, message: 'Migrasi akun browser hanya boleh dilakukan oleh Admin.' }, session ? 403 : 401);
      const body = await request.json() as any;
      if (!Array.isArray(body.accounts) || body.accounts.length > 100) {
        return jsonResponse({ success: false, message: 'Daftar akun lama harus berupa array maksimal 100 akun.' }, 400);
      }
      const current = await env.DB.prepare('SELECT id, username FROM users').all<any>();
      const knownUsernames = new Set((current.results || []).map((row: any) => String(row.username || '').toLowerCase()));
      const knownIds = new Set((current.results || []).map((row: any) => String(row.id || '')));
      let imported = 0;
      let skipped = 0;
      let duplicates = 0;
      for (const account of body.accounts) {
        const username = String(account?.username || '').trim().toLowerCase();
        const secret = String(account?.password || account?.passwordHash || '');
        const namaLengkap = String(account?.namaLengkap || username).trim().slice(0, 160);
        if (!username || username.length > 80 || !secret || !namaLengkap) {
          skipped++;
          continue;
        }
        if (knownUsernames.has(username)) {
          duplicates++;
          continue;
        }
        let id = String(account?.id || crypto.randomUUID()).trim();
        if (!id || id.length > 128 || knownIds.has(id)) id = crypto.randomUUID();
        const role = String(account?.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'PETUGAS';
        const gender = String(account?.gender || '').toUpperCase() === 'AKHWAT' ? 'AKHWAT' : 'IKHWAN';
        const status = account?.statusAktif === false ? 'NONAKTIF' : 'AKTIF';
        // Preserve already-hashed PBKDF2 values; otherwise hash the legacy plaintext here.
        const passwordHash = secret.startsWith('pbkdf2$') ? secret : await hashPassword(secret);
        try {
          await env.DB.prepare(`
            INSERT INTO users (id, username, password_hash, nama_lengkap, gender, role, peserta_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, datetime('now'), datetime('now'))
          `).bind(id, username, passwordHash, namaLengkap, gender, role, status).run();
          knownUsernames.add(username);
          knownIds.add(id);
          imported++;
        } catch {
          skipped++;
        }
      }
      return jsonResponse({ success: true, imported, skipped, duplicates, message: `Migrasi akun lama selesai: ${imported} diimpor, ${duplicates} duplikat diabaikan, ${skipped} dilewati karena data login tidak lengkap.` });
    }

    if ((path === '/users' || path === '/d1/users') && request.method === 'GET') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN', 'PETUGAS'])) return jsonResponse({ success: false, message: 'Login staf diperlukan untuk melihat daftar akun.' }, session ? 403 : 401);
      const result = await env.DB.prepare(
        'SELECT id, username, nama_lengkap, gender, role, peserta_id, status, created_at, updated_at FROM users ORDER BY created_at ASC'
      ).all<any>();
      return jsonResponse({ success: true, users: (result.results || []).map(safeUser) });
    }

    if ((path === '/users' || path === '/d1/users') && request.method === 'POST') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN'])) return jsonResponse({ success: false, message: 'Hanya Admin yang boleh mengelola akun.' }, session ? 403 : 401);
      const body = await request.json() as any;
      const id = String(body.id || crypto.randomUUID());
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = String(body.role || 'PETUGAS').toUpperCase();
      const status = body.statusAktif === false || body.status === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF';
      const namaLengkap = String(body.namaLengkap || username).trim();
      const gender = body.gender === 'AKHWAT' ? 'AKHWAT' : 'IKHWAN';
      if (!username || !namaLengkap) return jsonResponse({ success: false, message: 'Username dan nama lengkap wajib diisi.' }, 400);
      if (!['ADMIN', 'PETUGAS'].includes(role)) return jsonResponse({ success: false, message: 'Role tidak valid.' }, 400);
      if (password && password.length < 12) return jsonResponse({ success: false, message: 'Password baru minimal 12 karakter.' }, 400);

      const existing = await env.DB.prepare('SELECT id, password_hash FROM users WHERE id = ?').bind(id).first<any>();
      if (!existing && !password) return jsonResponse({ success: false, message: 'Password wajib diisi untuk akun baru.' }, 400);
      if (password && password.length < 12) return jsonResponse({ success: false, message: 'Password minimal 12 karakter.' }, 400);
      const passwordHash = password ? await hashPassword(password) : String(existing?.password_hash || '');
      if (!passwordHash) return jsonResponse({ success: false, message: 'Password akun tidak tersedia.' }, 400);
      const pesertaId = body.pesertaId ? String(body.pesertaId) : null;
      await env.DB.prepare(`
        INSERT INTO users (id, username, password_hash, nama_lengkap, gender, role, peserta_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          password_hash = excluded.password_hash,
          nama_lengkap = excluded.nama_lengkap,
          gender = excluded.gender,
          role = excluded.role,
          peserta_id = excluded.peserta_id,
          status = excluded.status,
          updated_at = datetime('now')
      `).bind(id, username, passwordHash, namaLengkap, gender, role, pesertaId, status).run();
      return jsonResponse({ success: true, message: 'Akun berhasil disimpan di D1.' });
    }

    if ((path === '/users/delete' || path === '/d1/users/delete') && request.method === 'POST') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN'])) return jsonResponse({ success: false, message: 'Hanya Admin yang boleh menghapus akun.' }, session ? 403 : 401);
      const body = await request.json() as any;
      const id = String(body.id || '');
      if (!id) return jsonResponse({ success: false, message: 'ID pengguna wajib diisi.' }, 400);
      if (id === session.user_id) return jsonResponse({ success: false, message: 'Admin tidak dapat menghapus akun yang sedang digunakan.' }, 400);
      const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first<any>();
      if (!target) return jsonResponse({ success: false, message: 'Akun tidak ditemukan.' }, 404);
      if (target.role === 'ADMIN') {
        const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND status = 'AKTIF'").first<any>();
        if (Number(count?.count || 0) <= 1) return jsonResponse({ success: false, message: 'Tidak dapat menghapus admin aktif terakhir.' }, 400);
      }
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
      return jsonResponse({ success: true, message: 'Akun dihapus.' });
    }

    // Explicit one-time seed. It is admin-only and never deletes app_collections.
    if ((path === '/admin/relational-migrate' || path === '/d1/admin/relational-migrate') && request.method === 'POST') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN'])) {
        return jsonResponse({ success: false, message: 'Hanya Admin yang boleh menjalankan migrasi tabel relasional.' }, session ? 403 : 401);
      }
      try {
        if (await isRelationalSeedComplete(env)) {
          return jsonResponse({ success: true, alreadyMigrated: true, message: 'Migrasi awal tabel relasional sudah pernah selesai.' });
        }
        const migrated = await seedRelationalTablesFromCollections(env);
        return jsonResponse({
          success: true,
          alreadyMigrated: false,
          migrated,
          message: `Migrasi selesai. ${migrated.participants} peserta, ${migrated.batches} batch, dan ${migrated.izin} data izin disalin ke tabel relasional. Koleksi JSON lama tetap dipertahankan.`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[BIMMA_RELATIONAL_MIGRATION]', { message });
        const isValidation = message.startsWith('Koleksi ') || message.startsWith('Koleksi IZIN');
        return jsonResponse({
          success: false,
          message: isValidation
            ? message
            : 'Migrasi belum selesai. Pastikan migrations/0005_relational_payloads.sql sudah diterapkan pada D1, lalu coba kembali. Koleksi JSON lama tidak dihapus.',
        }, isValidation ? 409 : 503);
      }
    }

    // D1 is the canonical application store. Browser localStorage is only a hydrated cache.
    const collectionKeys = new Set([
      'CONFIG', 'PESERTA', 'BATCH', 'JADWAL', 'ABSENSI', 'IZIN',
      'PEMBENARAN', 'MUSYRIF', 'AUDIT'
    ]);
    if ((path === '/collections' || path === '/d1/collections') && request.method === 'GET') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN', 'PETUGAS', 'PESERTA'])) {
        return jsonResponse({ success: false, message: 'Login diperlukan.' }, session ? 403 : 401);
      }
      const result = await env.DB.prepare('SELECT collection_key, value_json, updated_at FROM app_collections').all<any>();
      const collections: Record<string, any> = {};
      for (const row of result.results || []) {
        try { collections[String(row.collection_key)] = JSON.parse(String(row.value_json || '[]')); }
        catch { collections[String(row.collection_key)] = []; }
      }

      // Participant sessions must never receive other participants' private records or audit logs.
      if (session.role === 'PESERTA') {
        const participantId = String(session.peserta_id || '');
        const participant = (Array.isArray(collections.PESERTA) ? collections.PESERTA : [])
          .find((p: any) => String(p.pesertaId || p.peserta_id || p.id || '') === participantId);
        if (!participant) return jsonResponse({ success: false, message: 'Data peserta belum tersedia di koleksi D1.' }, 404);
        const batchId = String(participant.batchId || participant.batch_id || '');
        collections.PESERTA = [participant];
        collections.ABSENSI = (Array.isArray(collections.ABSENSI) ? collections.ABSENSI : [])
          .filter((a: any) => String(a.pesertaId || a.peserta_id || '') === participantId);
        collections.IZIN = (Array.isArray(collections.IZIN) ? collections.IZIN : [])
          .filter((i: any) => String(i.pesertaId || i.peserta_id || '') === participantId);
        collections.PEMBENARAN = (Array.isArray(collections.PEMBENARAN) ? collections.PEMBENARAN : [])
          .filter((i: any) => String(i.pesertaId || i.peserta_id || '') === participantId);
        collections.BATCH = (Array.isArray(collections.BATCH) ? collections.BATCH : [])
          .filter((b: any) => String(b.batchId || b.batch_id || b.id || '') === batchId);
        delete collections.AUDIT;
        delete collections.CONFIG;
      }
      return jsonResponse({ success: true, collections });
    }

    if ((path === '/collections' || path === '/d1/collections') && request.method === 'PUT') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN', 'PETUGAS'])) {
        return jsonResponse({ success: false, message: 'Login Admin/Petugas diperlukan untuk menulis data.' }, session ? 403 : 401);
      }
      const body = await request.json() as any;
      const key = String(body.key || '');
      if (!collectionKeys.has(key)) return jsonResponse({ success: false, message: 'Nama koleksi tidak diizinkan.' }, 400);
      if (!Array.isArray(body.items) && key !== 'CONFIG') return jsonResponse({ success: false, message: 'Data koleksi harus berupa array.' }, 400);
      const jsonValue = JSON.stringify(body.items);
      if (jsonValue.length > 2_000_000) return jsonResponse({ success: false, message: 'Ukuran data melebihi batas 2 MB.' }, 413);

      // Dual-write the collections that have a verified relational mapping.
      // app_collections stays intact as the compatibility source until every module
      // (especially recurring jadwal/absensi) has a verified normalized schema.
      if (key === 'PESERTA' && Array.isArray(body.items)) {
        // Reject malformed rows instead of silently keeping JSON and SQL out of sync.
        const rows = body.items as JsonRow[];
        const normalized = rows.map(normalizeParticipantRow);
        assertUniqueValues(normalized, row => row.id, 'PESERTA');
        assertUniqueValues(normalized, row => row.nim, 'PESERTA (NIM)');
        await validateParticipantBatchReferences(env, normalized);
        await upsertParticipants(env, rows);
        await syncBatchParticipantLinks(env, rows);
      }

      if (key === 'BATCH' && Array.isArray(body.items)) {
        const normalized = (body.items as JsonRow[]).map(normalizeBatchRow);
        assertUniqueValues(normalized, row => row.id, 'BATCH');
        // Validate the participant references before writing batches, using both
        // already-persisted IDs and IDs being introduced in this request.
        const participantRows = await readStoredCollection(env, 'PESERTA');
        await validateParticipantBatchReferences(
          env,
          participantRows.map(normalizeParticipantRow),
          normalized.map(row => row.id),
        );
        await upsertBatches(env, body.items);
        await syncBatchParticipantLinks(env, participantRows);
      }

      if (key === 'IZIN' && Array.isArray(body.items)) {
        await upsertIzin(env, body.items);
      }

      await env.DB.prepare(`
        INSERT INTO app_collections (collection_key, value_json, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(collection_key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')
      `).bind(key, jsonValue).run();
      return jsonResponse({ success: true, key, updatedAt: new Date().toISOString() });
    }

    if ((path === '/sync' || path === '/d1/sync') && request.method === 'GET') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN', 'PETUGAS'])) return jsonResponse({ success: false, message: 'Login Admin/Petugas diperlukan.' }, session ? 403 : 401);
      const [pesertaRes, absensiRes, jadwalRes, batchRes, izinRes, pembenaranRes, musyrifRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM peserta').all(),
        env.DB.prepare('SELECT * FROM absensi LIMIT 500').all(),
        env.DB.prepare('SELECT * FROM jadwal_kegiatan').all(),
        env.DB.prepare('SELECT * FROM batch').all(),
        env.DB.prepare('SELECT * FROM izin').all(),
        env.DB.prepare('SELECT * FROM pembenaran').all(),
        env.DB.prepare('SELECT * FROM musyrif').all(),
      ]);
      return jsonResponse({ success: true, data: {
        peserta: pesertaRes.results || [], absensi: absensiRes.results || [],
        jadwal: jadwalRes.results || [], batch: batchRes.results || [],
        izin: izinRes.results || [], pembenaran: pembenaranRes.results || [],
        musyrif: musyrifRes.results || []
      }});
    }

    // Keep write sync disabled until each write path is validated against the current schema
    // and has role-specific authorization. This avoids silent/unsafe mass overwrites.
    if ((path === '/sync' || path === '/d1/sync') && request.method === 'POST') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN'])) return jsonResponse({ success: false, message: 'Hanya Admin yang boleh melakukan sinkronisasi tulis.' }, session ? 403 : 401);
      return jsonResponse({
        success: false,
        message: 'Sinkronisasi tulis sementara dinonaktifkan saat pengamanan API. Aktifkan kembali setelah mapping seluruh tabel diverifikasi.'
      }, 501);
    }

    return jsonResponse({ success: false, message: 'Endpoint API tidak ditemukan.' }, 404);
  } catch (err: unknown) {
    // Keep diagnostics in Workers Logs without exposing SQL details or secrets to clients.
    const diagnostic = err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { message: String(err) };
    console.error('[BIMMA_API_ERROR]', {
      method: request.method,
      path,
      ...diagnostic,
    });
    return jsonResponse({ success: false, message: 'Terjadi kesalahan internal pada API.' }, 500);
  }
}

/**
 * Render a customized 404 page for unknown URLs
 */
function render404Page(requestedPath: string): Response {
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>404 - Halaman Tidak Ditemukan | BIMMA Absensi UNISA Bandung</title>
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    :root {
      --primary: #064e3b;
      --primary-light: #059669;
      --bg: #f8faf9;
      --text: #0f172a;
      --muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      text-align: center;
    }
    .card {
      background: #ffffff;
      border: 1px solid #d1fae5;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
      border-radius: 1.5rem;
      max-width: 32rem;
      width: 100%;
      padding: 2.5rem 2rem;
    }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      background: #fee2e2;
      color: #991b1b;
      font-weight: 800;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      border: 1px solid #fecaca;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 900;
      color: #064e3b;
      line-height: 1.25;
      margin-bottom: 0.75rem;
    }
    p {
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    code {
      background: #f1f5f9;
      padding: 0.2rem 0.45rem;
      border-radius: 0.375rem;
      font-size: 0.85rem;
      color: #0f172a;
      font-weight: 600;
      word-break: break-all;
    }
    .btn-group {
      display: flex;
      gap: 0.75rem;
      flex-direction: column;
    }
    @media (min-width: 480px) {
      .btn-group { flex-direction: row; }
    }
    .btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.25rem;
      border-radius: 0.875rem;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: #047857;
      color: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(4, 120, 87, 0.2);
    }
    .btn-primary:hover { background: #065f46; }
    .btn-secondary {
      background: #ffffff;
      color: #064e3b;
      border: 1px solid #a7f3d0;
    }
    .btn-secondary:hover { background: #ecfdf5; }
    .footer {
      margin-top: 2rem;
      font-size: 0.75rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">STATUS 404 NOT FOUND</div>
    <h1>Halaman Tidak Ditemukan</h1>
    <p>
      URL yang Anda tuju: <code>${requestedPath}</code> tidak terdaftar di sistem presensi BIMMA UNISA Bandung.
    </p>
    <div class="btn-group">
      <a href="/" class="btn btn-primary">Kembali ke Beranda</a>
      <a href="/login" class="btn btn-secondary">Login Petugas / Santri</a>
    </div>
  </div>
  <div class="footer">
    BIMMA Absensi • Pesantren Mahasiswa UNISA Bandung
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Main Worker Fetch Event Handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. API Endpoints take highest precedence
    if (pathname.startsWith('/api/')) {
      return handleApiRequest(request, env);
    }

    // 2. Compatibility alias: /biodata -> /biodata-mahasiswa
    if (pathname === '/biodata') {
      return Response.redirect(`${DOMAIN}/biodata-mahasiswa`, 301);
    }

    // 3. Static Assets: Files with extensions or root static files
    const isStaticAsset =
      /\.[a-zA-Z0-9]+$/.test(pathname) ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml' ||
      pathname === '/favicon.ico' ||
      pathname === '/favicon.svg';

    if (isStaticAsset) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return new Response('Asset not found in development', { status: 404 });
    }

    // 4. Clean Path Route Validation
    // Normalize trailing slash (except root)
    const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const meta = ROUTE_CONFIG[normalizedPath];

    if (!meta) {
      // Unknown path -> Return real HTTP 404!
      return render404Page(pathname);
    }

    // 5. Valid HTML Route: Serve index.html with dynamically injected SEO metadata
    if (env.ASSETS) {
      const indexRequest = new Request(new URL('/', request.url), request);
      const assetResponse = await env.ASSETS.fetch(indexRequest);

      if (!assetResponse.ok) {
        return assetResponse;
      }

      let html = await assetResponse.text();
      const canonicalUrl = `${DOMAIN}${normalizedPath === '/' ? '/' : normalizedPath}`;

      // Dynamically replace / inject SEO tags
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);
      html = html.replace(
        /<meta name="description"[\s\S]*?>/i,
        `<meta name="description" content="${meta.description}" />`
      );
      html = html.replace(
        /<link rel="canonical"[\s\S]*?>/i,
        `<link rel="canonical" href="${canonicalUrl}" />`
      );
      html = html.replace(
        /<meta name="robots"[\s\S]*?>/i,
        `<meta name="robots" content="${meta.robots}" />`
      );
      html = html.replace(
        /<meta property="og:title"[\s\S]*?>/i,
        `<meta property="og:title" content="${meta.title}" />`
      );
      html = html.replace(
        /<meta property="og:description"[\s\S]*?>/i,
        `<meta property="og:description" content="${meta.description}" />`
      );
      html = html.replace(
        /<meta property="og:url"[\s\S]*?>/i,
        `<meta property="og:url" content="${canonicalUrl}" />`
      );

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': meta.isPublic
            ? 'public, max-age=3600, s-maxage=86400'
            : 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Fallback if env.ASSETS is unavailable (e.g. mock test)
    return new Response('ASSETS binding not active', { status: 500 });
  },
};
