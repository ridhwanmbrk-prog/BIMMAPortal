
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DOMAIN?: string;
  ENVIRONMENT?: string;
}

type Role = 'ADMIN' | 'PETUGAS' | 'PESERTA';

interface Session {
  id: string;
  user_id: string | null;
  peserta_id: string | null;
  role: Role;
}

const SESSION_HOURS = 8;
const PASSWORD_ITERATIONS = 100_000;
const MAX_BODY_BYTES = 1_000_000;

const encoder = new TextEncoder();

const ALLOWED_ATTENDANCE_STATUSES = ['HADIR', 'IZIN', 'ALPA'] as const;

const ALLOWED_PARTICIPANT_STATUSES = ['AKTIF', 'LULUS', 'ALPA_BERAT', 'NONAKTIF'] as const;
const ALLOWED_IZIN_TYPES = ['IZIN_PULANG', 'IZIN_SAKIT', 'IZIN_AKADEMIK', 'IZIN_ORGANISASI', 'IZIN_MENDESAK'] as const;

function json(data: unknown, status = 200, origin = ''): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(
  message: string,
  status = 400,
  origin = '',
): Response {
  return json({ success: false, message }, status, origin);
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function newId(prefix = ''): string {
  return `${prefix}${crypto.randomUUID()}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(value),
  );

  return base64Url(new Uint8Array(digest));
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );

  return [
    'pbkdf2',
    PASSWORD_ITERATIONS,
    toBase64(salt),
    toBase64(new Uint8Array(derived)),
  ].join('$');
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (!stored) return { valid: false };

  if (stored.startsWith('pbkdf2$')) {
    try {
      const [, iterationsText, saltText, expectedText] = stored.split('$');
      const iterations = Number(iterationsText);

      if (
        !Number.isInteger(iterations) ||
        iterations < 100_000 ||
        iterations > 1_000_000 ||
        !saltText ||
        !expectedText
      ) {
        return { valid: false };
      }

      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
      );

      const derived = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: fromBase64(saltText),
          iterations,
        },
        key,
        256,
      );

      const actual = new Uint8Array(derived);
      const expected = fromBase64(expectedText);

      if (actual.length !== expected.length) {
        return { valid: false };
      }

      let difference = 0;

      for (let i = 0; i < actual.length; i++) {
        difference |= actual[i] ^ expected[i];
      }

      return { valid: difference === 0 };
    } catch {
      return { valid: false };
    }
  }

  // Kompatibilitas sementara untuk kata sandi lama yang masih plaintext.
  // Login berhasil akan menggantinya dengan hash PBKDF2.
  if (stored === password) {
    return {
      valid: true,
      upgradedHash: await hashPassword(password),
    };
  }

  return { valid: false };
}

function safeUser(row: any): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    namaLengkap: row.nama_lengkap ?? row.username ?? '',
    role: row.role,
    gender: row.gender ?? '',
    statusAktif: row.status_aktif === 'AKTIF',
  };
}

function mapPeserta(row: any): Record<string, unknown> {
  return {
    id: row.peserta_id,
    pesertaId: row.peserta_id,
    nim: row.nim ?? '',
    nama: row.nama_lengkap ?? '',
    namaLengkap: row.nama_lengkap ?? '',
    jurusan: row.program_studi ?? '',
    programStudi: row.program_studi ?? '',
    gender: row.gender ?? '',
    batchId: row.batch_id ?? '',
    kamar: row.kamar ?? '',
    nomorWhatsapp: row.nomor_whatsapp ?? '',
    email: row.email ?? '',
    alamat: row.alamat ?? '',
    tanggalMasuk: row.tanggal_masuk ?? '',
    status: row.status_peserta ?? '',
    statusPeserta: row.status_peserta ?? '',
    qrCode: row.qr_code ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapAbsensi(row: any): Record<string, unknown> {
  return {
    id: row.absensi_id,
    absensiId: row.absensi_id,
    pesertaId: row.peserta_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? '',
    tanggal: row.tanggal ?? '',
    status: row.status_absensi ?? '',
    statusAbsensi: row.status_absensi ?? '',
    keteranganWaktu: row.keterangan_waktu ?? 'TEPAT_WAKTU',
    menitKeterlambatan: row.menit_keterlambatan ?? 0,
    alasanTerlambat: row.alasan_terlambat ?? '',
    catatan: row.catatan ?? '',
    waktuScan: row.waktu_scan ?? '',
    waktuServer: row.waktu_server ?? '',
    penggunaId: row.pengguna_id ?? '',
    musyrifBertugas: row.musyrif_bertugas ?? '',
    sumberAbsensi: row.sumber_absensi ?? 'SCAN_QR',
    statusValidasi: row.status_validasi ?? 'SAH',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapJadwal(row: any): Record<string, unknown> {
  const tolerance = Number(row.toleransi_menit ?? 0);
  return {
    id: row.jadwal_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? '',
    hari: row.hari ?? '',
    jamMulai: row.jam_mulai ?? '',
    jamSelesai: row.jam_selesai ?? '',
    deskripsi: row.deskripsi ?? '',
    keterangan: row.deskripsi ?? '',
    toleransiMenit: tolerance,
    toleransiBukaAwal: tolerance,
    toleransiTutupAkhir: tolerance,
    wajib: true,
    status: row.status_aktif ?? '',
    statusAktif: row.status_aktif === 'AKTIF',
  };
}

function mapBatch(row: any): Record<string, unknown> {
  return {
    id: row.id,
    batchId: row.id,
    nama: row.nama ?? '',
    namaBatch: row.nama ?? '',
    tahun: row.tahun ?? '',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    status: row.status_aktif ?? '',
    statusBatch: row.status_aktif ?? '',
    createdAt: row.created_at ?? '',
  };
}

function mapIzin(row: any): Record<string, unknown> {
  return {
    id: row.izin_id,
    izinId: row.izin_id,
    pesertaId: row.peserta_id,
    jenisIzin: row.jenis_izin ?? '',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    waktuMulai: row.tanggal_mulai ?? '',
    waktuSelesai: row.tanggal_selesai ?? '',
    alasan: row.alasan ?? '',
    status: row.status_persetujuan ?? '',
    statusPersetujuan: row.status_persetujuan ?? '',
    disetujuiOleh: row.disetujui_oleh ?? '',
    waktuPengajuan: row.waktu_pengajuan ?? '',
    waktuPersetujuan: row.waktu_persetujuan ?? '',
    catatan: row.catatan ?? '',
    catatanAdmin: row.catatan ?? '',
    nomorSurat: row.nomor_surat ?? '',
    kodeVerifikasi: row.kode_verifikasi ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapPembenaran(row: any): Record<string, unknown> {
  return {
    id: row.pembenaran_id,
    pembenaranId: row.pembenaran_id,
    pesertaId: row.peserta_id,
    absensiId: row.absensi_id ?? '',
    jadwalId: row.jadwal_id ?? '',
    tanggal: row.tanggal ?? '',
    tanggalKejadian: row.tanggal ?? '',
    alasan: row.alasan ?? '',
    buktiLampiran: row.bukti_lampiran ?? '',
    status: row.status_pengajuan ?? '',
    statusPengajuan: row.status_pengajuan ?? '',
    statusPersetujuan: row.status_pengajuan ?? '',
    disetujuiOleh: row.disetujui_oleh ?? '',
    waktuPengajuan: row.waktu_pengajuan ?? '',
    waktuTindakan: row.waktu_tindakan ?? '',
    waktuKeputusan: row.waktu_tindakan ?? '',
    createdAt: row.created_at ?? '',
  };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}');

    return parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

async function readBody(request: Request): Promise<any> {
  const contentLength = Number(
    request.headers.get('Content-Length') ?? 0,
  );

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error('Ukuran permintaan terlalu besar.');
  }

  const text = await request.text();

  if (encoder.encode(text).length > MAX_BODY_BYTES) {
    throw new Error('Ukuran permintaan terlalu besar.');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Format JSON tidak valid.');
  }
}

async function createSession(
  env: Env,
  role: Role,
  userId: string | null,
  pesertaId: string | null,
): Promise<{ token: string; expiresAt: string }> {
  const token = base64Url(randomBytes(32));
  const tokenHash = await sha256(token);

  const expiresAt = new Date(
    Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  await env.DB.prepare(`
    INSERT INTO sessions
      (id, user_id, peserta_id, role, token_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(
      newId('ses_'),
      userId,
      pesertaId,
      role,
      tokenHash,
      expiresAt,
    )
    .run();

  return { token, expiresAt };
}

async function authenticate(
  request: Request,
  env: Env,
): Promise<Session | null> {
  const header = request.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/);
  if (!match) return null;

  const tokenHash = await sha256(match[1]);
  const session = await env.DB.prepare(`
    SELECT s.id, s.user_id, s.peserta_id, s.role
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN peserta p ON p.peserta_id = s.peserta_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > ?
      AND (
        (s.user_id IS NOT NULL AND u.status_aktif = 'AKTIF' AND u.role = s.role)
        OR
        (s.peserta_id IS NOT NULL AND p.status_peserta = 'AKTIF' AND s.role = 'PESERTA')
      )
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first<Session>();

  return session ?? null;
}

function requireRole(
  session: Session | null,
  roles: Role[],
): boolean {
  return Boolean(session && roles.includes(session.role));
}

async function audit(
  env: Env,
  userId: string | null,
  aksi: string,
  entitas?: string,
  entitasId?: string,
): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO audit_log (
        audit_id, waktu_server, pengguna_id, aksi,
        jenis_entitas, entitas_id, status_aksi
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId('audit_'),
      new Date().toISOString(),
      userId,
      aksi,
      entitas ?? null,
      entitasId ?? null,
      'BERHASIL',
    ).run();
  } catch {
    // Audit tidak boleh membuat permintaan utama gagal.
  }
}

async function login(
  body: any,
  env: Env,
  origin: string,
): Promise<Response> {
  const key = String(body?.key ?? '').trim();
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!key) return errorResponse('NIM atau username wajib diisi.', 400, origin);

  if (password) {
    const row = await env.DB.prepare(`
      SELECT id, username, password_hash, nama_lengkap, role, gender, status_aktif
      FROM users
      WHERE (username = ? OR id = ?)
        AND role IN ('ADMIN', 'PETUGAS')
        AND status_aktif = 'AKTIF'
      LIMIT 1
    `).bind(key, key).first<any>();

    if (!row) return errorResponse('Username atau kata sandi tidak valid.', 401, origin);

    const verification = await verifyPassword(password, row.password_hash);
    if (!verification.valid) return errorResponse('Username atau kata sandi tidak valid.', 401, origin);

    if (verification.upgradedHash) {
      await env.DB.prepare(`
        UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(verification.upgradedHash, row.id).run();
    }

    const session = await createSession(env, row.role, row.id, null);
    await audit(env, row.id, 'LOGIN', 'users', row.id);
    return json({ success: true, token: session.token, expiresAt: session.expiresAt, user: safeUser(row) }, 200, origin);
  }

  // Mode login peserta hanya untuk portal peserta; operasi petugas tetap memerlukan akun dan kata sandi.
  const peserta = await env.DB.prepare(`
    SELECT * FROM peserta
    WHERE (nim = ? OR peserta_id = ?) AND status_peserta = 'AKTIF'
    LIMIT 1
  `).bind(key, key).first<any>();

  if (!peserta) return errorResponse('Peserta tidak ditemukan atau tidak aktif.', 401, origin);

  const session = await createSession(env, 'PESERTA', null, peserta.peserta_id);
  await audit(env, null, 'LOGIN_PESERTA', 'peserta', peserta.peserta_id);
  return json({
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: peserta.peserta_id,
      username: peserta.nim,
      namaLengkap: peserta.nama_lengkap,
      role: 'PESERTA',
      gender: peserta.gender ?? '',
      statusAktif: true,
      pesertaId: peserta.peserta_id,
      nim: peserta.nim,
      programStudi: peserta.program_studi ?? '',
      batchId: peserta.batch_id ?? '',
    },
    peserta: mapPeserta(peserta),
  }, 200, origin);
}

async function getParticipantData(
  env: Env,
  pesertaId: string,
): Promise<Record<string, unknown>> {
  const [peserta, absensi, batch, jadwal, izin, pembenaran] = await Promise.all([
    env.DB.prepare('SELECT * FROM peserta WHERE peserta_id = ? LIMIT 1').bind(pesertaId).first<any>(),
    env.DB.prepare('SELECT * FROM absensi WHERE peserta_id = ? ORDER BY waktu_server DESC').bind(pesertaId).all<any>(),
    env.DB.prepare(`
      SELECT b.* FROM batch b
      JOIN peserta p ON p.batch_id = b.id
      WHERE p.peserta_id = ? LIMIT 1
    `).bind(pesertaId).all<any>(),
    env.DB.prepare(`
      SELECT * FROM jadwal_kegiatan
      WHERE status_aktif = 'AKTIF'
      ORDER BY hari, jam_mulai
    `).all<any>(),
    env.DB.prepare('SELECT * FROM izin WHERE peserta_id = ? ORDER BY tanggal_mulai DESC').bind(pesertaId).all<any>(),
    env.DB.prepare('SELECT * FROM pembenaran WHERE peserta_id = ? ORDER BY tanggal DESC').bind(pesertaId).all<any>(),
  ]);

  return {
    peserta: peserta ? [mapPeserta(peserta)] : [],
    absensi: absensi.results.map(mapAbsensi),
    batch: batch.results.map(mapBatch),
    jadwal: jadwal.results.map(mapJadwal),
    izin: izin.results.map(mapIzin),
    pembenaran: pembenaran.results.map(mapPembenaran),
    musyrif: [],
  };
}

async function getStaffData(env: Env): Promise<Record<string, unknown>> {
  const [peserta, absensi, jadwal, batch, izin, pembenaran, musyrif] = await Promise.all([
    env.DB.prepare('SELECT * FROM peserta ORDER BY nama_lengkap').all<any>(),
    env.DB.prepare('SELECT * FROM absensi ORDER BY waktu_server DESC').all<any>(),
    env.DB.prepare('SELECT * FROM jadwal_kegiatan ORDER BY hari, jam_mulai').all<any>(),
    env.DB.prepare('SELECT * FROM batch ORDER BY tanggal_mulai DESC').all<any>(),
    env.DB.prepare('SELECT * FROM izin ORDER BY tanggal_mulai DESC').all<any>(),
    env.DB.prepare('SELECT * FROM pembenaran ORDER BY tanggal DESC').all<any>(),
    env.DB.prepare('SELECT id, nama, kontak, status, peran, created_at FROM musyrif ORDER BY nama').all<any>(),
  ]);

  return {
    peserta: peserta.results.map(mapPeserta),
    absensi: absensi.results.map(mapAbsensi),
    jadwal: jadwal.results.map(mapJadwal),
    batch: batch.results.map(mapBatch),
    izin: izin.results.map(mapIzin),
    pembenaran: pembenaran.results.map(mapPembenaran),
    musyrif: musyrif.results.map((row: any) => ({
      id: row.id,
      nama: row.nama,
      kontak: row.kontak ?? '',
      status: row.status ?? '',
      peran: row.peran ?? '',
      createdAt: row.created_at ?? '',
    })),
  };
}

async function syncData(
  request: Request,
  env: Env,
  session: Session,
  origin: string,
): Promise<Response> {
  if (request.method === 'GET') {
    const data = session.role === 'PESERTA'
      ? await getParticipantData(env, session.peserta_id!)
      : await getStaffData(env);
    return json({ success: true, data }, 200, origin);
  }
  if (request.method !== 'POST') return errorResponse('Metode tidak didukung.', 405, origin);
  if (!requireRole(session, ['ADMIN', 'PETUGAS'])) return errorResponse('Akses ditolak.', 403, origin);

  const body = await readBody(request);
  const pesertaList = Array.isArray(body?.peserta) ? body.peserta : [];
  const absensiList = Array.isArray(body?.absensi) ? body.absensi : [];
  const batchList = Array.isArray(body?.batch) ? body.batch : [];
  const jadwalList = Array.isArray(body?.jadwal) ? body.jadwal : [];
  const izinList = Array.isArray(body?.izin) ? body.izin : [];
  const pembenaranList = Array.isArray(body?.pembenaran) ? body.pembenaran : [];

  if (pesertaList.length > 5000 || absensiList.length > 10000 || batchList.length > 500 || jadwalList.length > 10000 || izinList.length > 10000 || pembenaranList.length > 10000) {
    return errorResponse('Jumlah data dalam satu permintaan terlalu banyak.', 413, origin);
  }

  let savedBatch = 0;
  for (const b of batchList) {
    const id = String(b?.id ?? b?.batchId ?? b?.batch_id ?? '').trim();
    const nama = String(b?.nama ?? b?.namaBatch ?? b?.nama_batch ?? '').trim();
    const tahun = String(b?.tahun ?? '').trim();
    const mulai = String(b?.tanggalMulai ?? b?.tanggal_mulai ?? '').trim();
    const selesai = String(b?.tanggalSelesai ?? b?.tanggal_selesai ?? '').trim();
    if (!id || !nama || !mulai || !selesai) continue;
    const statusRaw = String(b?.status ?? b?.statusBatch ?? b?.status_aktif ?? 'AKTIF').toUpperCase();
    const status = ['AKTIF', 'NONAKTIF'].includes(statusRaw) ? statusRaw : 'AKTIF';
    await env.DB.prepare(`
      INSERT INTO batch (id, nama, tahun, tanggal_mulai, tanggal_selesai, status_aktif)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nama=excluded.nama, tahun=excluded.tahun,
        tanggal_mulai=excluded.tanggal_mulai, tanggal_selesai=excluded.tanggal_selesai,
        status_aktif=excluded.status_aktif
    `).bind(id, nama, tahun || null, mulai, selesai, status).run();
    savedBatch++;
  }

  let savedPeserta = 0;
  for (const p of pesertaList) {
    const nim = String(p?.nim ?? p?.NIM ?? '').trim();
    const nama = String(p?.nama ?? p?.namaLengkap ?? p?.nama_lengkap ?? '').trim();
    if (!nim || !nama) continue;
    const id = String(p?.pesertaId ?? p?.peserta_id ?? p?.id ?? nim).trim();
    const rawStatus = String(p?.statusPeserta ?? p?.status_peserta ?? p?.status ?? (p?.statusAktif === false ? 'NONAKTIF' : 'AKTIF')).toUpperCase();
    let status = rawStatus;
    if (status === 'SELESAI') status = 'LULUS';
    if (status === 'ALPA') status = 'ALPA_BERAT';
    if (!ALLOWED_PARTICIPANT_STATUSES.includes(status as any)) status = 'AKTIF';
    const batchId = String(p?.batchId ?? p?.batch_id ?? '').trim() || null;
    await env.DB.prepare(`
      INSERT INTO peserta (
        peserta_id, nim, nama_lengkap, gender, program_studi, batch_id, kamar,
        nomor_whatsapp, email, alamat, qr_code, tanggal_masuk, status_peserta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(peserta_id) DO UPDATE SET
        nim=excluded.nim, nama_lengkap=excluded.nama_lengkap, gender=excluded.gender,
        program_studi=excluded.program_studi, batch_id=excluded.batch_id, kamar=excluded.kamar,
        nomor_whatsapp=excluded.nomor_whatsapp, email=excluded.email, alamat=excluded.alamat,
        qr_code=excluded.qr_code, tanggal_masuk=excluded.tanggal_masuk,
        status_peserta=excluded.status_peserta, updated_at=CURRENT_TIMESTAMP
    `).bind(
      id, nim, nama, p?.gender ?? null, p?.programStudi ?? p?.program_studi ?? p?.jurusan ?? null,
      batchId, p?.kamar ?? null, p?.nomorWhatsapp ?? p?.nomor_whatsapp ?? p?.noHp ?? null,
      p?.email ?? null, p?.alamat ?? null, p?.qrCode ?? p?.qr_code ?? null,
      p?.tanggalMasuk ?? p?.tanggal_masuk ?? null, status,
    ).run();
    savedPeserta++;
  }

  let savedJadwal = 0;
  for (const j of jadwalList) {
    const id = String(j?.jadwalId ?? j?.jadwal_id ?? j?.id ?? '').trim();
    const nama = String(j?.namaKegiatan ?? j?.nama_kegiatan ?? j?.nama ?? '').trim();
    const mulai = String(j?.jamMulai ?? j?.jam_mulai ?? '').trim();
    const selesai = String(j?.jamSelesai ?? j?.jam_selesai ?? '').trim();
    if (!id || !nama || !mulai || !selesai) continue;
    const statusRaw = j?.statusAktif === false || String(j?.status ?? j?.status_aktif ?? '').toUpperCase() === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF';
    const toleransi = Math.max(0, Number(j?.toleransiMenit ?? j?.toleransiBukaAwal ?? j?.toleransiTutupAkhir ?? j?.toleransi_menit ?? 0) || 0);
    await env.DB.prepare(`
      INSERT INTO jadwal_kegiatan (jadwal_id, nama_kegiatan, hari, jam_mulai, jam_selesai, deskripsi, status_aktif, toleransi_menit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(jadwal_id) DO UPDATE SET nama_kegiatan=excluded.nama_kegiatan,
        hari=excluded.hari, jam_mulai=excluded.jam_mulai, jam_selesai=excluded.jam_selesai,
        deskripsi=excluded.deskripsi, status_aktif=excluded.status_aktif,
        toleransi_menit=excluded.toleransi_menit
    `).bind(
      id, nama, String(j?.hari ?? 'SETIAP_HARI'), mulai, selesai,
      j?.deskripsi ?? j?.keterangan ?? null, statusRaw, toleransi,
    ).run();
    savedJadwal++;
  }

  let savedAbsensi = 0;
  for (const a of absensiList) {
    const pesertaId = String(a?.pesertaId ?? a?.peserta_id ?? '').trim();
    const jadwalId = String(a?.jadwalId ?? a?.jadwal_id ?? '').trim();
    const tanggal = String(a?.tanggal ?? '').trim();
    if (!pesertaId || !jadwalId || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) continue;

    const rawStatus = String(a?.statusAbsensi ?? a?.status_absensi ?? a?.status ?? 'HADIR').toUpperCase();
    let status = rawStatus;
    if (status === 'ALFA') status = 'ALPA';
    if (status === 'SAKIT' || status === 'DISPENSASI') status = 'IZIN';
    if (status === 'TERLAMBAT') status = 'HADIR';
    if (!ALLOWED_ATTENDANCE_STATUSES.includes(status as any)) continue;

    const waktuServer = String(a?.waktuServer ?? a?.waktu_server ?? new Date().toISOString());
    const waktuScan = String(a?.waktuScan ?? a?.waktu_scan ?? waktuServer);
    const rawKet = String(a?.keteranganWaktu ?? a?.keterangan_waktu ?? (rawStatus === 'TERLAMBAT' ? 'TERLAMBAT' : 'TEPAT_WAKTU')).toUpperCase();
    const keteranganWaktu = rawKet === 'TERLAMBAT' ? 'TERLAMBAT' : 'TEPAT_WAKTU';
    const sumberRaw = String(a?.sumberAbsensi ?? a?.sumber_absensi ?? 'SCAN_QR').toUpperCase();
    const sumber = ['SCAN_QR', 'IZIN_SISTEM', 'PEMBENARAN_ADMIN', 'MANUAL'].includes(sumberRaw) ? sumberRaw : 'SCAN_QR';
    const validasiRaw = String(a?.statusValidasi ?? a?.status_validasi ?? 'SAH').toUpperCase();
    const validasi = ['SAH', 'DIKOREKSI', 'DIBATALKAN'].includes(validasiRaw) ? validasiRaw : 'SAH';
    const existing = await env.DB.prepare(`
      SELECT absensi_id FROM absensi WHERE peserta_id = ? AND jadwal_id = ? AND tanggal = ? LIMIT 1
    `).bind(pesertaId, jadwalId, tanggal).first<any>();

    if (existing) {
      await env.DB.prepare(`
        UPDATE absensi SET nama_kegiatan=?, status_absensi=?, keterangan_waktu=?,
          menit_keterlambatan=?, alasan_terlambat=?, catatan=?, waktu_scan=?, waktu_server=?,
          pengguna_id=?, musyrif_bertugas=?, sumber_absensi=?, status_validasi=?, updated_at=CURRENT_TIMESTAMP
        WHERE absensi_id=?
      `).bind(
        String(a?.namaKegiatan ?? a?.nama_kegiatan ?? ''), status, keteranganWaktu,
        Number(a?.menitKeterlambatan ?? a?.menit_keterlambatan ?? 0) || 0,
        a?.alasanTerlambat ?? a?.alasan_terlambat ?? null,
        a?.catatan ?? null, waktuScan, waktuServer,
        a?.penggunaId ?? a?.pengguna_id ?? session.user_id,
        a?.musyrifBertugas ?? a?.musyrif_bertugas ?? null,
        sumber, validasi, existing.absensi_id,
      ).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO absensi (
          absensi_id, jadwal_id, nama_kegiatan, tanggal, peserta_id, status_absensi,
          keterangan_waktu, menit_keterlambatan, alasan_terlambat, catatan,
          waktu_scan, waktu_server, pengguna_id, musyrif_bertugas, sumber_absensi, status_validasi
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        String(a?.absensiId ?? a?.absensi_id ?? a?.id ?? newId('abs_')),
        jadwalId, String(a?.namaKegiatan ?? a?.nama_kegiatan ?? ''), tanggal, pesertaId, status,
        keteranganWaktu, Number(a?.menitKeterlambatan ?? a?.menit_keterlambatan ?? 0) || 0,
        a?.alasanTerlambat ?? a?.alasan_terlambat ?? null, a?.catatan ?? null,
        waktuScan, waktuServer, a?.penggunaId ?? a?.pengguna_id ?? session.user_id,
        a?.musyrifBertugas ?? a?.musyrif_bertugas ?? null, sumber, validasi,
      ).run();
    }
    savedAbsensi++;
  }

  let savedIzin = 0;
  for (const item of izinList) {
    const id = String(item?.izinId ?? item?.izin_id ?? item?.id ?? '').trim();
    const pesertaId = String(item?.pesertaId ?? item?.peserta_id ?? '').trim();
    const mulai = String(item?.tanggalMulai ?? item?.tanggal_mulai ?? item?.waktuMulai ?? '').trim();
    const selesai = String(item?.tanggalSelesai ?? item?.tanggal_selesai ?? item?.waktuSelesai ?? '').trim();
    if (!id || !pesertaId || !mulai || !selesai) continue;
    const typeRaw = String(item?.jenisIzin ?? item?.jenis_izin ?? 'IZIN_MENDESAK').toUpperCase();
    let jenis = typeRaw;
    if (jenis === 'SAKIT') jenis = 'IZIN_SAKIT';
    if (jenis === 'IZIN_KHUSUS' || jenis === 'KEPERLUAN_SYARI') jenis = 'IZIN_MENDESAK';
    if (!ALLOWED_IZIN_TYPES.includes(jenis as any)) jenis = 'IZIN_MENDESAK';
    const statusRaw = String(item?.statusPersetujuan ?? item?.status_persetujuan ?? item?.status ?? 'MENUNGGU').toUpperCase();
    const status = ['MENUNGGU', 'DISETUJUI', 'DITOLAK'].includes(statusRaw) ? statusRaw : 'MENUNGGU';
    await env.DB.prepare(`
      INSERT INTO izin (
        izin_id, peserta_id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan,
        status_persetujuan, disetujui_oleh, waktu_pengajuan, waktu_persetujuan,
        catatan, nomor_surat, kode_verifikasi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(izin_id) DO UPDATE SET jenis_izin=excluded.jenis_izin,
        tanggal_mulai=excluded.tanggal_mulai, tanggal_selesai=excluded.tanggal_selesai,
        alasan=excluded.alasan, status_persetujuan=excluded.status_persetujuan,
        disetujui_oleh=excluded.disetujui_oleh, waktu_pengajuan=excluded.waktu_pengajuan,
        waktu_persetujuan=excluded.waktu_persetujuan, catatan=excluded.catatan,
        nomor_surat=excluded.nomor_surat, kode_verifikasi=excluded.kode_verifikasi,
        updated_at=CURRENT_TIMESTAMP
    `).bind(
      id, pesertaId, jenis, mulai, selesai, item?.alasan ?? '', status,
      item?.disetujuiOleh ?? item?.disetujui_oleh ?? item?.diputuskanOleh ?? null,
      item?.waktuPengajuan ?? item?.waktu_pengajuan ?? new Date().toISOString(),
      item?.waktuPersetujuan ?? item?.waktu_persetujuan ?? item?.waktuKeputusan ?? null,
      item?.catatan ?? item?.catatanAdmin ?? null, item?.nomorSurat ?? item?.nomor_surat ?? null,
      item?.kodeVerifikasi ?? item?.kode_verifikasi ?? null,
    ).run();
    savedIzin++;
  }

  let savedPembenaran = 0;
  for (const item of pembenaranList) {
    const id = String(item?.pembenaranId ?? item?.pembenaran_id ?? item?.id ?? '').trim();
    const pesertaId = String(item?.pesertaId ?? item?.peserta_id ?? '').trim();
    const tanggal = String(item?.tanggalKejadian ?? item?.tanggal ?? item?.tanggal_kejadian ?? '').trim();
    if (!id || !pesertaId || !tanggal) continue;
    const statusRaw = String(item?.statusPengajuan ?? item?.status_pengajuan ?? item?.statusPersetujuan ?? item?.status ?? 'MENUNGGU').toUpperCase();
    const status = ['MENUNGGU', 'DISETUJUI', 'DITOLAK'].includes(statusRaw) ? statusRaw : 'MENUNGGU';
    await env.DB.prepare(`
      INSERT INTO pembenaran (
        pembenaran_id, peserta_id, absensi_id, jadwal_id, tanggal, alasan,
        bukti_lampiran, status_pengajuan, disetujui_oleh, waktu_pengajuan, waktu_tindakan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pembenaran_id) DO UPDATE SET absensi_id=excluded.absensi_id,
        jadwal_id=excluded.jadwal_id, tanggal=excluded.tanggal, alasan=excluded.alasan,
        bukti_lampiran=excluded.bukti_lampiran, status_pengajuan=excluded.status_pengajuan,
        disetujui_oleh=excluded.disetujui_oleh, waktu_pengajuan=excluded.waktu_pengajuan,
        waktu_tindakan=excluded.waktu_tindakan
    `).bind(
      id, pesertaId, item?.absensiId ?? item?.absensi_id ?? null,
      item?.jadwalId ?? item?.jadwal_id ?? null, tanggal, item?.alasan ?? '',
      item?.buktiLampiran ?? item?.bukti_lampiran ?? null, status,
      item?.disetujuiOleh ?? item?.disetujui_oleh ?? item?.diputuskanOleh ?? null,
      item?.waktuPengajuan ?? item?.waktu_pengajuan ?? new Date().toISOString(),
      item?.waktuTindakan ?? item?.waktu_tindakan ?? item?.waktuKeputusan ?? null,
    ).run();
    savedPembenaran++;
  }

  await audit(env, session.user_id, 'SYNC', 'data');
  const count = savedBatch + savedPeserta + savedJadwal + savedAbsensi + savedIzin + savedPembenaran;
  return json({
    success: true, count, batchDisimpan: savedBatch, pesertaDisimpan: savedPeserta,
    jadwalDisimpan: savedJadwal, absensiDisimpan: savedAbsensi,
    izinDisimpan: savedIzin, pembenaranDisimpan: savedPembenaran,
    message: 'Permintaan sinkronisasi selesai diproses.',
  }, 200, origin);
}

async function usersEndpoint(
  request: Request,
  env: Env,
  session: Session,
  origin: string,
): Promise<Response> {
  if (!requireRole(session, ['ADMIN'])) return errorResponse('Hanya admin yang dapat mengelola akun.', 403, origin);

  if (request.method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT id, username, nama_lengkap, role, gender, status_aktif, created_at, updated_at
      FROM users ORDER BY nama_lengkap, username
    `).all<any>();
    return json({
      success: true,
      users: result.results.map((row: any) => ({
        id: row.id, username: row.username, namaLengkap: row.nama_lengkap,
        role: row.role, gender: row.gender ?? '', statusAktif: row.status_aktif === 'AKTIF',
        createdAt: row.created_at, updatedAt: row.updated_at,
      })),
    }, 200, origin);
  }
  if (request.method !== 'POST') return errorResponse('Metode tidak didukung.', 405, origin);

  const body = await readBody(request);
  const id = String(body?.id ?? '').trim();
  const username = String(body?.username ?? '').trim();
  const namaLengkap = String(body?.namaLengkap ?? body?.nama_lengkap ?? '').trim();
  const password = typeof body?.password === 'string' ? body.password : '';
  const role = String(body?.role ?? '').toUpperCase();
  const gender = String(body?.gender ?? '').toUpperCase();
  const statusAktif = body?.statusAktif === false ? 'NONAKTIF' : 'AKTIF';

  if (!username || !namaLengkap) return errorResponse('Username dan nama lengkap wajib diisi.', 400, origin);
  if (!['ADMIN', 'PETUGAS'].includes(role)) return errorResponse('Peran akun tidak valid.', 400, origin);
  if (gender && !['IKHWAN', 'AKHWAT'].includes(gender)) return errorResponse('Gender akun tidak valid.', 400, origin);

  const existing = id ? await env.DB.prepare('SELECT id, role, status_aktif FROM users WHERE id = ? LIMIT 1').bind(id).first<any>() : null;
  if (id && !existing) return errorResponse('Akun yang akan diperbarui tidak ditemukan.', 404, origin);
  if (!existing && password.length < 10) return errorResponse('Kata sandi akun baru minimal 10 karakter.', 400, origin);
  if (password && password.length < 10) return errorResponse('Kata sandi minimal 10 karakter.', 400, origin);

  const demotingLastAdmin = existing?.role === 'ADMIN' && existing?.status_aktif === 'AKTIF' && (role !== 'ADMIN' || statusAktif !== 'AKTIF');
  if (demotingLastAdmin) {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM users WHERE role='ADMIN' AND status_aktif='AKTIF' AND id != ?`).bind(id).first<{ total: number }>();
    if (!count || count.total < 1) return errorResponse('Admin aktif terakhir tidak dapat dinonaktifkan atau diubah perannya.', 400, origin);
  }

  const accountId = id || newId('usr_');
  try {
    if (existing && !password) {
      await env.DB.prepare(`
        UPDATE users SET username=?, nama_lengkap=?, role=?, gender=?, status_aktif=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
      `).bind(username, namaLengkap, role, gender || null, statusAktif, accountId).run();
    } else {
      const passwordHash = await hashPassword(password);
      await env.DB.prepare(`
        INSERT INTO users (id, username, password_hash, nama_lengkap, role, gender, status_aktif)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET username=excluded.username, password_hash=excluded.password_hash,
          nama_lengkap=excluded.nama_lengkap, role=excluded.role, gender=excluded.gender,
          status_aktif=excluded.status_aktif, updated_at=CURRENT_TIMESTAMP
      `).bind(accountId, username, passwordHash, namaLengkap, role, gender || null, statusAktif).run();
    }
  } catch {
    return errorResponse('Akun gagal disimpan. Pastikan username belum digunakan.', 409, origin);
  }

  await env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`).bind(new Date().toISOString(), accountId).run();
  await audit(env, session.user_id, 'SAVE_USER', 'users', accountId);
  return json({ success: true, id: accountId, message: 'Akun berhasil disimpan.' }, 200, origin);
}

async function deleteUser(
  request: Request,
  env: Env,
  session: Session,
  origin: string,
): Promise<Response> {
  if (!requireRole(session, ['ADMIN'])) return errorResponse('Hanya admin yang dapat menghapus akun.', 403, origin);
  if (request.method !== 'POST') return errorResponse('Metode tidak didukung.', 405, origin);
  const body = await readBody(request);
  const id = String(body?.id ?? '').trim();
  if (!id) return errorResponse('ID akun wajib diisi.', 400, origin);
  if (session.user_id === id) return errorResponse('Kamu tidak dapat menghapus akun yang sedang digunakan.', 400, origin);

  const target = await env.DB.prepare('SELECT id, role, status_aktif FROM users WHERE id=? LIMIT 1').bind(id).first<any>();
  if (!target) return errorResponse('Akun tidak ditemukan.', 404, origin);
  if (target.role === 'ADMIN' && target.status_aktif === 'AKTIF') {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM users WHERE role='ADMIN' AND status_aktif='AKTIF'`).first<{ total: number }>();
    if (count && count.total <= 1) return errorResponse('Admin aktif terakhir tidak dapat dihapus.', 400, origin);
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(new Date().toISOString(), id),
    env.DB.prepare('DELETE FROM users WHERE id=?').bind(id),
  ]);
  await audit(env, session.user_id, 'DELETE_USER', 'users', id);
  return json({ success: true, message: 'Akun berhasil dihapus.' }, 200, origin);
}

async function logout(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const header = request.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/);

  if (match) {
    await env.DB.prepare(`
      UPDATE sessions
      SET revoked_at = ?
      WHERE token_hash = ? AND revoked_at IS NULL
    `)
      .bind(new Date().toISOString(), await sha256(match[1]))
      .run();
  }

  return json(
    { success: true, message: 'Sesi diakhiri.' },
    200,
    origin,
  );
}

async function routeApi(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin
          ? { 'Access-Control-Allow-Origin': origin }
          : {}),
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    });
  }

  if (path === '/api/health' || path === '/api/d1/health') {
    try {
      await env.DB.prepare('SELECT 1 AS ok').first();

      return json(
        {
          success: true,
          status: 'ok',
          database: 'Cloudflare D1',
          environment: env.ENVIRONMENT ?? 'unknown',
        },
        200,
        origin,
      );
    } catch {
      return errorResponse(
        'D1 belum tersedia atau migrasi belum dijalankan.',
        503,
        origin,
      );
    }
  }

  if (!path.startsWith('/api/d1/')) {
    return errorResponse('Endpoint tidak ditemukan.', 404, origin);
  }

  try {
    if (path === '/api/d1/login' && request.method === 'POST') {
      return await login(await readBody(request), env, origin);
    }

    if (path === '/api/d1/logout' && request.method === 'POST') {
      return await logout(request, env, origin);
    }

    const session = await authenticate(request, env);

    if (!session) {
      return errorResponse(
        'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.',
        401,
        origin,
      );
    }

    if (path === '/api/d1/sync') {
      return await syncData(request, env, session, origin);
    }

    if (path === '/api/d1/users') {
      return await usersEndpoint(request, env, session, origin);
    }

    if (path === '/api/d1/users/delete') {
      return await deleteUser(request, env, session, origin);
    }

    return errorResponse('Endpoint tidak ditemukan.', 404, origin);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Ukuran permintaan terlalu besar.'
    ) {
      return errorResponse(error.message, 413, origin);
    }

    if (
      error instanceof Error &&
      error.message === 'Format JSON tidak valid.'
    ) {
      return errorResponse(error.message, 400, origin);
    }

    console.error('D1 API request failed:', error);

    return errorResponse(
      'Terjadi kesalahan pada server.',
      500,
      origin,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    let configuredDomain: string;

    try {
      configuredDomain = env.DOMAIN
        ? new URL(env.DOMAIN).origin
        : url.origin;
    } catch {
      return errorResponse('Konfigurasi domain server tidak valid.', 500);
    }

    const allowedOrigins = new Set([
      configuredDomain,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);

    const requestOrigin = request.headers.get('Origin') ?? '';
    const origin = allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : '';

    if (requestOrigin && !origin) {
      return errorResponse('Origin tidak diizinkan.', 403);
    }

    if (url.pathname.startsWith('/api/')) {
      return routeApi(request, env, origin);
    }

    // Pertahankan handler aset frontend Vite/Cloudflare.
    return env.ASSETS.fetch(request);
  },
};
