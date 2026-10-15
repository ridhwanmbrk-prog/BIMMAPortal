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

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256
  );
  return `pbkdf2$210000$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  // Support existing legacy plaintext hashes once, then upgrade them after a successful login.
  if (!stored.startsWith('pbkdf2$')) return password === stored;

  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;

  try {
    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const actual = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, expected.length * 8
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
    namaLengkap: row.username,
    role: row.role,
    pesertaId: row.peserta_id || undefined,
    statusAktif: row.status === 'AKTIF',
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

      const statusColumn = ['status', 'status_aktif', 'statusaktif', 'aktif', 'is_active', 'isactive']
        .map(name => columnByName.get(name))
        .find(Boolean);
      if (statusColumn) {
        const rawStatus = participant[statusColumn];
        const normalizedStatus = String(rawStatus ?? '').trim().toUpperCase();
        const explicitlyInactive = rawStatus === 0 || rawStatus === false ||
          ['NONAKTIF', 'NON-AKTIF', 'TIDAK AKTIF', 'INACTIVE', 'INAKTIF', 'FALSE', '0', 'TIDAK'].includes(normalizedStatus);
        if (explicitlyInactive) {
          return jsonResponse({ success: false, message: 'Peserta berstatus tidak aktif.' }, 403);
        }
      }

      const participantId = String(participant[participantIdColumn] || participantIdFromQr);
      const nameColumn = ['nama_lengkap', 'namalengkap', 'nama', 'name'].map(name => columnByName.get(name)).find(Boolean);
      const participantName = String((nameColumn && participant[nameColumn]) || nim);

      const token = await createSession(env, { role: 'PESERTA' }, participantId);
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
        peserta: participant
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
        SELECT id, username, password_hash, role, peserta_id, status
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

    if (path === '/me' && request.method === 'GET') {
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

    if ((path === '/users' || path === '/d1/users') && request.method === 'GET') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN'])) return jsonResponse({ success: false, message: 'Hanya Admin yang boleh mengakses data akun.' }, session ? 403 : 401);
      const result = await env.DB.prepare(
        'SELECT id, username, role, peserta_id, status, created_at, updated_at FROM users ORDER BY created_at ASC'
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
      if (!username || !password) return jsonResponse({ success: false, message: 'Username dan password wajib diisi.' }, 400);
      if (!['ADMIN', 'PETUGAS', 'PESERTA'].includes(role)) return jsonResponse({ success: false, message: 'Role tidak valid.' }, 400);
      if (password.length < 12) return jsonResponse({ success: false, message: 'Password akun baru minimal 12 karakter.' }, 400);
      const passwordHash = await hashPassword(password);
      const pesertaId = body.pesertaId ? String(body.pesertaId) : null;
      await env.DB.prepare(`
        INSERT INTO users (id, username, password_hash, role, peserta_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          password_hash = excluded.password_hash,
          role = excluded.role,
          peserta_id = excluded.peserta_id,
          status = excluded.status,
          updated_at = datetime('now')
      `).bind(id, username, passwordHash, role, pesertaId, status).run();
      return jsonResponse({ success: true, message: 'Akun berhasil disimpan.' });
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

    if ((path === '/sync' || path === '/d1/sync') && request.method === 'GET') {
      const session = await requireSession(request, env);
      if (!requireRole(session, ['ADMIN', 'PETUGAS'])) return jsonResponse({ success: false, message: 'Login Admin/Petugas diperlukan.' }, session ? 403 : 401);
      const [pesertaRes, absensiRes, jadwalRes, batchRes, izinRes, pembenaranRes, musyrifRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM peserta').all(),
        env.DB.prepare('SELECT * FROM absensi ORDER BY waktu_server DESC LIMIT 500').all(),
        env.DB.prepare('SELECT * FROM jadwal_kegiatan').all(),
        env.DB.prepare('SELECT * FROM batch').all(),
        env.DB.prepare('SELECT * FROM izin ORDER BY waktu_pengajuan DESC').all(),
        env.DB.prepare('SELECT * FROM pembenaran ORDER BY waktu_pengajuan DESC').all(),
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
  } catch (err: any) {
    // Do not leak SQL, schema details, or secrets in public error responses.
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
