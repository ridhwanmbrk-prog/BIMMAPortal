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
 * Handle API endpoints for Cloudflare D1
 */
async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 1. Health check (works even without D1 binding to test route)
  if (path === '/health' || path === '/d1/health') {
    if (!env || !env.DB) {
      return jsonResponse({
        success: false,
        connected: false,
        message: 'D1 binding DB belum terhubung di runtime ini.',
        databaseName: 'bimma-absensi-db',
        databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
        timestamp: new Date().toISOString(),
      }, 503);
    }

    try {
      const result = await env.DB.prepare('SELECT 1 as test').first();
      return jsonResponse({
        success: true,
        connected: true,
        databaseName: 'bimma-absensi-db',
        databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
        test: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return jsonResponse({
        success: false,
        connected: false,
        error: err.message,
        databaseName: 'bimma-absensi-db',
        databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
      }, 500);
    }
  }

  if (!env || !env.DB) {
    return jsonResponse({
      success: false,
      connected: false,
      message: 'Cloudflare D1 binding "DB" tidak terdeteksi pada environment ini.',
      databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
      databaseName: 'bimma-absensi-db',
    }, 503);
  }

  try {
    
    // 2. Raw SQL endpoint disabled for security.
    if (
      (path === '/query' || path === '/d1/query') &&
      request.method === 'POST'
    ) {
      return jsonResponse(
        { success: false, error: 'Endpoint SQL mentah dinonaktifkan.' },
        404
      );
    }


    // 3. Login Mahasantri / Petugas via D1 (POST /api/d1/login)
    if ((path === '/login' || path === '/d1/login') && request.method === 'POST') {
      const body = (await request.json()) as { key: string; password?: string };
      const key = (body.key || '').trim();
      const keyLower = key.toLowerCase();

      // Cek akun petugas/admin di tabel users D1 jika ada password
      if (body.password) {
        const userRow = (await env.DB.prepare(
          'SELECT id, username, password_hash, nama_lengkap, role, gender, status_aktif FROM users WHERE (LOWER(username) = ? OR LOWER(id) = ?) AND status_aktif = 1'
        ).bind(keyLower, keyLower).first()) as any;

        if (userRow) {
          if (userRow.password_hash === body.password) {
            return jsonResponse({
              success: true,
              type: 'USER',
              user: {
                id: userRow.id,
                username: userRow.username,
                namaLengkap: userRow.nama_lengkap,
                role: userRow.role,
                gender: userRow.gender,
                statusAktif: Boolean(userRow.status_aktif),
              },
            });
          } else {
            return jsonResponse({ success: false, message: 'Password tidak sesuai.' }, 401);
          }
        }
      }

      // Cek akun mahasantri di tabel peserta D1 (berdasarkan NIM atau ID)
      const pesertaRow = (await env.DB.prepare(
        'SELECT peserta_id, nim, nama_lengkap, gender, program_studi, batch_id, kamar, status_peserta, nomor_whatsapp, email, alamat FROM peserta WHERE nim = ? OR peserta_id = ?'
      ).bind(key, key).first()) as any;

      if (pesertaRow) {
        if (pesertaRow.status_peserta !== 'AKTIF') {
          return jsonResponse({
            success: false,
            message: `Akun santri ${pesertaRow.nama_lengkap} berstatus ${pesertaRow.status_peserta}. Hubungi musyrif.`,
          }, 403);
        }

        return jsonResponse({
          success: true,
          type: 'PESERTA',
          user: {
            id: `USER_${pesertaRow.peserta_id}`,
            username: pesertaRow.nim,
            namaLengkap: pesertaRow.nama_lengkap,
            role: 'PESERTA',
            statusAktif: true,
            pesertaId: pesertaRow.peserta_id,
            nim: pesertaRow.nim,
            programStudi: pesertaRow.program_studi,
            batchId: pesertaRow.batch_id,
          },
          peserta: pesertaRow,
        });
      }

      return jsonResponse({
        success: false,
        message: 'Username, NIM, atau ID santri tidak ditemukan di Cloudflare D1!',
      }, 404);
    }

    // 4. Manajemen Akun Users / Kredensial Admin & Petugas (GET, POST, DELETE /api/d1/users)
    if ((path === '/users' || path === '/d1/users') && request.method === 'GET') {
      const usersRes = await env.DB.prepare(
        'SELECT id, username, password_hash, nama_lengkap, role, gender, status_aktif, created_at, updated_at FROM users ORDER BY created_at ASC'
      ).all();
      return jsonResponse({
        success: true,
        users: (usersRes.results || []).map((u: any) => ({
          id: u.id,
          username: u.username,
          password: u.password_hash,
          passwordHash: u.password_hash,
          namaLengkap: u.nama_lengkap,
          role: u.role,
          gender: u.gender,
          statusAktif: Boolean(u.status_aktif),
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        })),
      });
    }

    if ((path === '/users' || path === '/d1/users') && request.method === 'POST') {
      const body = (await request.json()) as any;
      const { id, username, password, namaLengkap, role, gender, statusAktif } = body;

      if (!id || !username || !password || !namaLengkap) {
        return jsonResponse({ success: false, message: 'ID, username, password, dan nama lengkap wajib diisi!' }, 400);
      }

      await env.DB.prepare(
        `INSERT INTO users (id, username, password_hash, nama_lengkap, role, gender, status_aktif, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           password_hash = excluded.password_hash,
           nama_lengkap = excluded.nama_lengkap,
           role = excluded.role,
           gender = excluded.gender,
           status_aktif = excluded.status_aktif,
           updated_at = datetime('now')`
      ).bind(
        id,
        username.trim().toLowerCase(),
        password,
        namaLengkap.trim(),
        role || 'PETUGAS',
        gender || 'IKHWAN',
        statusAktif !== false ? 1 : 0
      ).run();

      return jsonResponse({
        success: true,
        message: `Akun ${username} (${namaLengkap}) berhasil disimpan ke Cloudflare D1 SQL!`,
      });
    }

    if ((path === '/users/delete' || path === '/d1/users/delete') && request.method === 'POST') {
      const body = (await request.json()) as { id: string };
      if (!body.id) {
        return jsonResponse({ success: false, message: 'ID pengguna wajib disertakan.' }, 400);
      }

      // Pastikan bukan menghapus admin terakhir
      const countRes = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND status_aktif = 1").first<any>();
      const userToDelete = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(body.id).first<any>();

      if (userToDelete?.role === 'ADMIN' && (countRes?.count || 0) <= 1) {
        return jsonResponse({ success: false, message: 'Tidak dapat menghapus admin utama satu-satunya!' }, 400);
      }

      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(body.id).run();
      return jsonResponse({ success: true, message: 'Akun berhasil dihapus dari Cloudflare D1.' });
    }

    // 5. Sync Pull dari D1 (GET /api/d1/sync)
    if ((path === '/sync' || path === '/d1/sync') && request.method === 'GET') {
      const [pesertaRes, absensiRes, jadwalRes, batchRes, izinRes, pembenaranRes, musyrifRes, usersRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM peserta').all(),
        env.DB.prepare('SELECT * FROM absensi ORDER BY waktu_server DESC LIMIT 500').all(),
        env.DB.prepare('SELECT * FROM jadwal_kegiatan').all(),
        env.DB.prepare('SELECT * FROM batch').all(),
        env.DB.prepare('SELECT * FROM izin ORDER BY waktu_pengajuan DESC').all(),
        env.DB.prepare('SELECT * FROM pembenaran ORDER BY waktu_pengajuan DESC').all(),
        env.DB.prepare('SELECT * FROM musyrif').all(),
        env.DB.prepare('SELECT id, username, password_hash, nama_lengkap, role, gender, status_aktif FROM users').all(),
      ]);

      return jsonResponse({
        success: true,
        data: {
          peserta: pesertaRes.results || [],
          absensi: absensiRes.results || [],
          jadwal: jadwalRes.results || [],
          batch: batchRes.results || [],
          izin: izinRes.results || [],
          pembenaran: pembenaranRes.results || [],
          musyrif: musyrifRes.results || [],
          users: usersRes.results || [],
        },
      });
    }

    // 6. Sync Push ke D1 (POST /api/d1/sync)
    if ((path === '/sync' || path === '/d1/sync') && request.method === 'POST') {
      const body = (await request.json()) as {
        peserta?: any[];
        absensi?: any[];
      };

      const statements: D1PreparedStatement[] = [];

      if (body.peserta && Array.isArray(body.peserta)) {
        for (const p of body.peserta) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO peserta (peserta_id, nim, nama_lengkap, gender, program_studi, batch_id, kamar, status_peserta, nomor_whatsapp, email, alamat, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(peserta_id) DO UPDATE SET
                 nim=excluded.nim,
                 nama_lengkap=excluded.nama_lengkap,
                 gender=excluded.gender,
                 program_studi=excluded.program_studi,
                 batch_id=excluded.batch_id,
                 kamar=excluded.kamar,
                 status_peserta=excluded.status_peserta,
                 nomor_whatsapp=excluded.nomor_whatsapp,
                 email=excluded.email,
                 alamat=excluded.alamat,
                 updated_at=datetime('now')`
            ).bind(
              p.pesertaId || p.peserta_id,
              p.nim,
              p.namaLengkap || p.nama_lengkap,
              p.gender || 'IKHWAN',
              p.programStudi || p.program_studi || 'Umum',
              p.batchId || p.batch_id || 'Batch 1',
              p.kamar || '',
              p.statusPeserta || p.status_peserta || 'AKTIF',
              p.nomorWhatsApp || p.nomor_whatsapp || '',
              p.email || '',
              p.alamat || ''
            )
          );
        }
      }

      if (body.absensi && Array.isArray(body.absensi)) {
        for (const a of body.absensi) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO absensi (absensi_id, jadwal_id, nama_kegiatan, tanggal, peserta_id, status_absensi, keterangan_waktu, menit_keterlambatan, alasan_terlambat, catatan, waktu_scan, waktu_server, pengguna_id, musyrif_bertugas, sumber_absensi, status_validasi)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(absensi_id) DO UPDATE SET
                 alasan_terlambat=excluded.alasan_terlambat,
                 catatan=excluded.catatan,
                 updated_at=datetime('now')`
            ).bind(
              a.absensiId || a.absensi_id,
              a.jadwalId || a.jadwal_id,
              a.namaKegiatan || a.nama_kegiatan,
              a.tanggal,
              a.pesertaId || a.peserta_id,
              a.statusAbsensi || a.status_absensi || 'HADIR',
              a.keteranganWaktu || a.keterangan_waktu || 'TEPAT_WAKTU',
              a.menitKeterlambatan || a.menit_keterlambatan || 0,
              a.alasanTerlambat || a.alasan_terlambat || '',
              a.catatan || '',
              a.waktuScan || a.waktu_scan || new Date().toISOString(),
              a.waktuServer || a.waktu_server || new Date().toISOString(),
              a.penggunaId || a.pengguna_id || 'U002',
              a.musyrifBertugas || a.musyrif_bertugas || '',
              a.sumberAbsensi || a.sumber_absensi || 'SCAN_QR',
              a.statusValidasi || a.status_validasi || 'SAH'
            )
          );
        }
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }

      return jsonResponse({
        success: true,
        count: statements.length,
        message: `Berhasil sinkronisasi ${statements.length} data ke Cloudflare D1!`,
      });
    }

    return jsonResponse({ error: 'Endpoint API tidak ditemukan.' }, 404);
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: err.message || 'Kesalahan internal di Cloudflare D1 Worker',
    }, 500);
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
