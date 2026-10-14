// Cloudflare Pages Function - D1 Database API Handler
// Database ID: dd5dbf9a-56c0-4ee0-85df-a698c7c99e56 (bimma-absensi-db)
// Domain: https://absensi.bimma-uab.my.id/

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

interface Env {
  DB: D1Database;
}

interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequest(context: EventContext<Env, 'route', any>) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');

  if (request.method === 'OPTIONS') {
    return onRequestOptions();
  }

  // Cek ketersediaan binding D1
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
    // 1. HEALTH CHECK: /api/health atau /api/d1/health
    if (path === '/health' || path === '/d1/health') {
      const result = await env.DB.prepare('SELECT 1 as test').first();
      return jsonResponse({
        success: true,
        connected: true,
        databaseName: 'bimma-absensi-db',
        databaseId: 'dd5dbf9a-56c0-4ee0-85df-a698c7c99e56',
        test: result,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. QUERY / EXECUTE: POST /api/d1/query
    if ((path === '/query' || path === '/d1/query') && request.method === 'POST') {
      const body = await request.json() as { sql: string; params?: any[] };
      if (!body.sql) {
        return jsonResponse({ error: 'SQL query parameter wajib diisi.' }, 400);
      }

      const stmt = env.DB.prepare(body.sql);
      const bound = body.params && body.params.length > 0 ? stmt.bind(...body.params) : stmt;
      const res = await bound.all();
      return jsonResponse({ success: true, results: res.results, meta: res.meta });
    }

    // 3. LOGIN PESERTA & PETUGAS VIA D1: POST /api/d1/login
    if ((path === '/login' || path === '/d1/login') && request.method === 'POST') {
      const body = await request.json() as { key: string; password?: string };
      const key = (body.key || '').trim();
      const keyLower = key.toLowerCase();

      // Cek akun petugas/admin di tabel users D1
      if (body.password) {
        const userRow = await env.DB.prepare(
          'SELECT id, username, password_hash, nama_lengkap, role, gender, status_aktif FROM users WHERE (LOWER(username) = ? OR LOWER(id) = ?) AND status_aktif = 1'
        ).bind(keyLower, keyLower).first() as any;

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
      const pesertaRow = await env.DB.prepare(
        'SELECT peserta_id, nim, nama_lengkap, gender, program_studi, batch_id, kamar, status_peserta, nomor_whatsapp, email, alamat FROM peserta WHERE nim = ? OR peserta_id = ?'
      ).bind(key, key).first() as any;

      if (pesertaRow) {
        if (pesertaRow.status_peserta !== 'AKTIF') {
          return jsonResponse({
            success: false,
            message: `Akun santri ${pesertaRow.nama_lengkap} berstatus ${pesertaRow.status_peserta}. Hubungi admin.`,
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

    // 4. MANAJEMEN AKUN USERS / KREDENSIAL ADMIN & PETUGAS (GET, POST, DELETE /api/d1/users)
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

      const countRes = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND status_aktif = 1").first<any>();
      const userToDelete = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(body.id).first<any>();

      if (userToDelete?.role === 'ADMIN' && (countRes?.count || 0) <= 1) {
        return jsonResponse({ success: false, message: 'Tidak dapat menghapus admin utama satu-satunya!' }, 400);
      }

      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(body.id).run();
      return jsonResponse({ success: true, message: 'Akun berhasil dihapus dari Cloudflare D1.' });
    }

    // 5. SYNC PULL (Ambil data lengkap dari D1): GET /api/d1/sync
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

    // 6. SYNC PUSH (Simpan batch santri atau kehadiran ke D1): POST /api/d1/sync
    if ((path === '/sync' || path === '/d1/sync') && request.method === 'POST') {
      const body = await request.json() as {
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

    return jsonResponse({ error: 'Endpoint tidak ditemukan.' }, 404);
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: err.message || 'Internal Error on Cloudflare D1 Function',
    }, 500);
  }
}
