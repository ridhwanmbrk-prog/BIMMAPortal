
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
    // Schema D1 saat ini tidak menyimpan nama tampilan/gender akun staf.
    namaLengkap: row.nama_lengkap ?? row.username ?? '',
    role: row.role,
    gender: row.gender ?? '',
    statusAktif: row.status === 'AKTIF',
    pesertaId: row.peserta_id ?? undefined,
  };
}

function mapPeserta(row: any): Record<string, unknown> {
  return {
    id: row.id,
    pesertaId: row.id,
    nim: row.nim ?? '',
    nama: row.nama ?? '',
    namaLengkap: row.nama ?? '',
    jurusan: row.jurusan ?? '',
    programStudi: row.jurusan ?? '',
    gender: row.gender ?? '',
    batchId: row.batch_id ?? '',
    kamar: '',
    nomorWhatsapp: row.nomor_whatsapp ?? '',
    email: row.email ?? '',
    alamat: row.alamat ?? '',
    tanggalMasuk: row.tanggal_masuk ?? '',
    status: row.status ?? '',
    statusPeserta: row.status ?? '',
    qrCode: row.qr_code ?? row.nim ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapAbsensi(row: any): Record<string, unknown> {
  let extra: any = {};
  try {
    extra = row.keterangan ? JSON.parse(row.keterangan) : {};
  } catch {
    extra = { catatan: row.keterangan ?? '' };
  }
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) extra = {};
  return {
    id: row.id,
    absensiId: row.id,
    pesertaId: row.peserta_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? extra.namaKegiatan ?? '',
    tanggal: row.tanggal ?? '',
    status: row.status ?? 'HADIR',
    statusAbsensi: row.status ?? 'HADIR',
    keteranganWaktu: extra.keteranganWaktu ?? 'TEPAT_WAKTU',
    menitKeterlambatan: extra.menitKeterlambatan ?? 0,
    alasanTerlambat: extra.alasanTerlambat ?? '',
    catatan: extra.catatan ?? (typeof row.keterangan === 'string' ? row.keterangan : ''),
    waktuScan: extra.waktuScan ?? row.waktu_server ?? '',
    waktuServer: row.waktu_server ?? '',
    penggunaId: extra.penggunaId ?? '',
    musyrifBertugas: extra.musyrifBertugas ?? '',
    sumberAbsensi: extra.sumberAbsensi ?? 'SCAN_QR',
    statusValidasi: extra.statusValidasi ?? 'SAH',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapJadwal(row: any): Record<string, unknown> {
  return {
    id: row.id,
    jadwalId: row.id,
    batchId: row.batch_id ?? '',
    namaKegiatan: row.nama_kegiatan ?? '',
    tanggal: row.tanggal ?? '',
    hari: row.tanggal ?? '',
    jamMulai: row.jam_mulai ?? '',
    jamSelesai: row.jam_selesai ?? '',
    deskripsi: '',
    keterangan: '',
    toleransiMenit: 0,
    toleransiBukaAwal: 0,
    toleransiTutupAkhir: 0,
    wajib: Number(row.wajib ?? 1) === 1,
    status: row.status ?? 'AKTIF',
    statusAktif: row.status === 'AKTIF',
  };
}

function mapBatch(row: any): Record<string, unknown> {
  return {
    id: row.id,
    batchId: row.id,
    nama: row.nama ?? '',
    namaBatch: row.nama ?? '',
    tahun: row.tanggal_mulai ? String(row.tanggal_mulai).slice(0, 4) : '',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    status: row.status ?? 'AKTIF',
    statusBatch: row.status ?? 'AKTIF',
    createdAt: row.created_at ?? '',
  };
}

function mapIzin(row: any): Record<string, unknown> {
  let extra: any = {};
  try { extra = row.alasan ? JSON.parse(row.alasan) : {}; }
  catch { extra = { alasan: row.alasan ?? '' }; }
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) extra = {};
  return {
    id: row.id,
    izinId: row.id,
    pesertaId: row.peserta_id,
    jenisIzin: extra.jenisIzin ?? 'IZIN_MENDESAK',
    tanggalMulai: row.tanggal_mulai ?? '',
    tanggalSelesai: row.tanggal_selesai ?? '',
    waktuMulai: row.tanggal_mulai ?? '',
    waktuSelesai: row.tanggal_selesai ?? '',
    alasan: extra.alasan ?? row.alasan ?? '',
    status: row.status ?? 'MENUNGGU',
    statusPersetujuan: row.status ?? 'MENUNGGU',
    disetujuiOleh: extra.disetujuiOleh ?? '',
    waktuPengajuan: extra.waktuPengajuan ?? row.created_at ?? '',
    waktuPersetujuan: extra.waktuPersetujuan ?? '',
    catatan: extra.catatan ?? '',
    catatanAdmin: extra.catatan ?? '',
    nomorSurat: extra.nomorSurat ?? '',
    kodeVerifikasi: extra.kodeVerifikasi ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function mapPembenaran(row: any): Record<string, unknown> {
  let extra: any = {};
  try { extra = row.alasan ? JSON.parse(row.alasan) : {}; }
  catch { extra = { alasan: row.alasan ?? '' }; }
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) extra = {};
  return {
    id: row.id,
    pembenaranId: row.id,
    pesertaId: row.peserta_id,
    absensiId: extra.absensiId ?? '',
    jadwalId: extra.jadwalId ?? '',
    namaKegiatan: extra.namaKegiatan ?? '',
    tanggal: row.tanggal ?? '',
    tanggalKejadian: row.tanggal ?? '',
    alasan: extra.alasan ?? row.alasan ?? '',
    buktiLampiran: extra.buktiLampiran ?? '',
    status: row.status ?? 'MENUNGGU',
    statusPengajuan: row.status ?? 'MENUNGGU',
    statusPersetujuan: row.status ?? 'MENUNGGU',
    disetujuiOleh: extra.disetujuiOleh ?? '',
    waktuPengajuan: extra.waktuPengajuan ?? row.created_at ?? '',
    waktuTindakan: extra.waktuTindakan ?? '',
    waktuKeputusan: extra.waktuTindakan ?? '',
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
    LEFT JOIN peserta p ON p.id = s.peserta_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > ?
      AND (
        (s.user_id IS NOT NULL AND u.status = 'AKTIF' AND u.role = s.role)
        OR
        (s.peserta_id IS NOT NULL AND p.status = 'AKTIF' AND s.role = 'PESERTA')
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
      INSERT INTO audit_logs (id, user_id, aksi, entitas, entitas_id, detail_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      newId('audit_'), userId, aksi, entitas ?? null, entitasId ?? null,
      JSON.stringify({ waktuServer: new Date().toISOString(), statusAksi: 'BERHASIL' }),
    ).run();
  } catch {
    // Audit gagal tidak boleh membatalkan operasi utama.
  }
}

async function login(body: any, env: Env, origin: string): Promise<Response> {
  const key = String(body?.key ?? '').trim();
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!key) return errorResponse('NIM atau username wajib diisi.', 400, origin);

  if (password) {
    const row = await env.DB.prepare(`
      SELECT id, username, password_hash, role, peserta_id, status, created_at, updated_at
      FROM users
      WHERE (username = ? OR id = ?)
        AND role IN ('ADMIN', 'PETUGAS')
        AND status = 'AKTIF'
      LIMIT 1
    `).bind(key, key).first<any>();
    if (!row) return errorResponse('Username atau kata sandi tidak valid.', 401, origin);
    const verification = await verifyPassword(password, row.password_hash);
    if (!verification.valid) return errorResponse('Username atau kata sandi tidak valid.', 401, origin);
    if (verification.upgradedHash) {
      await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(verification.upgradedHash, row.id).run();
    }
    const session = await createSession(env, row.role, row.id, null);
    await audit(env, row.id, 'LOGIN', 'users', row.id);
    return json({ success: true, token: session.token, expiresAt: session.expiresAt, user: safeUser(row) }, 200, origin);
  }

  // Sesuai kontrak frontend saat ini, peserta masuk menggunakan NIM/ID tanpa kata sandi.
  // Untuk produksi, sebaiknya login peserta dilindungi PIN/kata sandi tambahan.
  const peserta = await env.DB.prepare(`
    SELECT p.*, (SELECT bp.batch_id FROM batch_peserta bp WHERE bp.peserta_id = p.id LIMIT 1) AS batch_id
    FROM peserta p
    WHERE (p.nim = ? OR p.id = ?) AND p.status = 'AKTIF'
    LIMIT 1
  `).bind(key, key).first<any>();
  if (!peserta) return errorResponse('Peserta tidak ditemukan atau tidak aktif.', 401, origin);
  const session = await createSession(env, 'PESERTA', null, peserta.id);
  await audit(env, null, 'LOGIN_PESERTA', 'peserta', peserta.id);
  return json({
    success: true, token: session.token, expiresAt: session.expiresAt,
    user: {
      id: peserta.id, username: peserta.nim, namaLengkap: peserta.nama,
      role: 'PESERTA', gender: peserta.gender ?? '', statusAktif: true,
      pesertaId: peserta.id, nim: peserta.nim, programStudi: peserta.jurusan ?? '',
      batchId: peserta.batch_id ?? '',
    },
    peserta: mapPeserta(peserta),
  }, 200, origin);
}

async function getParticipantData(env: Env, pesertaId: string): Promise<Record<string, unknown>> {
  const [peserta, absensi, batch, jadwal, izin, pembenaran] = await Promise.all([
    env.DB.prepare(`SELECT p.*, (SELECT bp.batch_id FROM batch_peserta bp WHERE bp.peserta_id=p.id LIMIT 1) AS batch_id FROM peserta p WHERE p.id=? LIMIT 1`).bind(pesertaId).first<any>(),
    env.DB.prepare(`SELECT a.*, j.nama_kegiatan, j.tanggal FROM absensi a LEFT JOIN jadwal_kegiatan j ON j.id=a.jadwal_id WHERE a.peserta_id=? ORDER BY a.waktu_server DESC`).bind(pesertaId).all<any>(),
    env.DB.prepare(`SELECT b.* FROM batch b JOIN batch_peserta bp ON bp.batch_id=b.id WHERE bp.peserta_id=? ORDER BY b.tanggal_mulai DESC`).bind(pesertaId).all<any>(),
    env.DB.prepare(`SELECT j.* FROM jadwal_kegiatan j JOIN batch_peserta bp ON bp.batch_id=j.batch_id WHERE bp.peserta_id=? AND j.status='AKTIF' ORDER BY j.tanggal, j.jam_mulai`).bind(pesertaId).all<any>(),
    env.DB.prepare('SELECT * FROM izin WHERE peserta_id=? ORDER BY tanggal_mulai DESC').bind(pesertaId).all<any>(),
    env.DB.prepare('SELECT * FROM pembenaran WHERE peserta_id=? ORDER BY tanggal DESC').bind(pesertaId).all<any>(),
  ]);
  return {
    peserta: peserta ? [mapPeserta(peserta)] : [],
    absensi: absensi.results.map(mapAbsensi),
    jadwal: jadwal.results.map(mapJadwal),
    batch: batch.results.map(mapBatch),
    izin: izin.results.map(mapIzin),
    pembenaran: pembenaran.results.map(mapPembenaran),
    musyrif: [],
  };
}

async function getStaffData(env: Env): Promise<Record<string, unknown>> {
  const [peserta, absensi, jadwal, batch, izin, pembenaran, musyrif] = await Promise.all([
    env.DB.prepare(`SELECT p.*, (SELECT bp.batch_id FROM batch_peserta bp WHERE bp.peserta_id=p.id LIMIT 1) AS batch_id FROM peserta p ORDER BY p.nama`).all<any>(),
    env.DB.prepare(`SELECT a.*, j.nama_kegiatan, j.tanggal FROM absensi a LEFT JOIN jadwal_kegiatan j ON j.id=a.jadwal_id ORDER BY a.waktu_server DESC`).all<any>(),
    env.DB.prepare('SELECT * FROM jadwal_kegiatan ORDER BY tanggal, jam_mulai').all<any>(),
    env.DB.prepare('SELECT * FROM batch ORDER BY tanggal_mulai DESC').all<any>(),
    env.DB.prepare('SELECT * FROM izin ORDER BY tanggal_mulai DESC').all<any>(),
    env.DB.prepare('SELECT * FROM pembenaran ORDER BY tanggal DESC').all<any>(),
    env.DB.prepare('SELECT id, nama, data_json, created_at FROM musyrif ORDER BY nama').all<any>(),
  ]);
  return {
    peserta: peserta.results.map(mapPeserta),
    absensi: absensi.results.map(mapAbsensi),
    jadwal: jadwal.results.map(mapJadwal),
    batch: batch.results.map(mapBatch),
    izin: izin.results.map(mapIzin),
    pembenaran: pembenaran.results.map(mapPembenaran),
    musyrif: musyrif.results.map((row: any) => ({ id: row.id, nama: row.nama, ...safeJson(row.data_json), createdAt: row.created_at ?? '' })),
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
    const mulai = String(b?.tanggalMulai ?? b?.tanggal_mulai ?? '').trim();
    const selesai = String(b?.tanggalSelesai ?? b?.tanggal_selesai ?? '').trim();
    if (!id || !nama || !mulai || !selesai) continue;
    const statusRaw = String(b?.status ?? b?.statusBatch ?? 'AKTIF').toUpperCase();
    const status = ['AKTIF', 'NONAKTIF'].includes(statusRaw) ? statusRaw : 'AKTIF';
    await env.DB.prepare(`
      INSERT INTO batch (id, nama, tanggal_mulai, tanggal_selesai, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nama=excluded.nama, tanggal_mulai=excluded.tanggal_mulai,
        tanggal_selesai=excluded.tanggal_selesai, status=excluded.status, updated_at=CURRENT_TIMESTAMP
    `).bind(id, nama, mulai, selesai, status).run();
    savedBatch++;
  }

  let savedPeserta = 0;
  for (const p of pesertaList) {
    const nim = String(p?.nim ?? p?.NIM ?? '').trim();
    const nama = String(p?.nama ?? p?.namaLengkap ?? p?.nama_lengkap ?? '').trim();
    if (!nim || !nama) continue;
    const id = String(p?.pesertaId ?? p?.peserta_id ?? p?.id ?? nim).trim();
    const rawStatus = String(p?.statusPeserta ?? p?.status_peserta ?? p?.status ?? (p?.statusAktif === false ? 'NONAKTIF' : 'AKTIF')).toUpperCase();
    const status = ['AKTIF', 'LULUS', 'ALPA_BERAT', 'NONAKTIF', 'IZIN', 'BELUM_AKTIF', 'SELESAI', 'MUTASI'].includes(rawStatus) ? rawStatus : 'AKTIF';
    await env.DB.prepare(`
      INSERT INTO peserta (id, nim, nama, jurusan, gender, nomor_whatsapp, email, alamat, tanggal_masuk, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nim=excluded.nim, nama=excluded.nama, jurusan=excluded.jurusan,
        gender=excluded.gender, nomor_whatsapp=excluded.nomor_whatsapp, email=excluded.email,
        alamat=excluded.alamat, tanggal_masuk=excluded.tanggal_masuk, status=excluded.status,
        updated_at=CURRENT_TIMESTAMP
    `).bind(
      id, nim, nama, p?.jurusan ?? p?.programStudi ?? p?.program_studi ?? null, p?.gender ?? null,
      p?.nomorWhatsapp ?? p?.nomor_whatsapp ?? p?.noHp ?? null, p?.email ?? null, p?.alamat ?? null,
      p?.tanggalMasuk ?? p?.tanggal_masuk ?? null, status,
    ).run();
    const batchId = String(p?.batchId ?? p?.batch_id ?? '').trim();
    if (batchId) {
      await env.DB.prepare(`INSERT OR IGNORE INTO batch_peserta (batch_id, peserta_id) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM batch WHERE id=?) AND EXISTS (SELECT 1 FROM peserta WHERE id=?)`)
        .bind(batchId, id, batchId, id).run();
    }
    savedPeserta++;
  }

  let savedJadwal = 0;
  for (const j of jadwalList) {
    const id = String(j?.jadwalId ?? j?.jadwal_id ?? j?.id ?? '').trim();
    const batchId = String(j?.batchId ?? j?.batch_id ?? '').trim();
    const nama = String(j?.namaKegiatan ?? j?.nama_kegiatan ?? j?.nama ?? '').trim();
    const tanggal = String(j?.tanggal ?? '').trim();
    if (!id || !batchId || !nama || !tanggal) continue;
    const mulai = String(j?.jamMulai ?? j?.jam_mulai ?? '').trim() || null;
    const selesai = String(j?.jamSelesai ?? j?.jam_selesai ?? '').trim() || null;
    const wajib = j?.wajib === false || Number(j?.wajib) === 0 ? 0 : 1;
    const status = j?.statusAktif === false || String(j?.status ?? '').toUpperCase() === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF';
    await env.DB.prepare(`
      INSERT INTO jadwal_kegiatan (id, batch_id, nama_kegiatan, tanggal, jam_mulai, jam_selesai, wajib, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET batch_id=excluded.batch_id, nama_kegiatan=excluded.nama_kegiatan,
        tanggal=excluded.tanggal, jam_mulai=excluded.jam_mulai, jam_selesai=excluded.jam_selesai,
        wajib=excluded.wajib, status=excluded.status, updated_at=CURRENT_TIMESTAMP
    `).bind(id, batchId, nama, tanggal, mulai, selesai, wajib, status).run();
    savedJadwal++;
  }

  let savedAbsensi = 0;
  for (const a of absensiList) {
    const pesertaId = String(a?.pesertaId ?? a?.peserta_id ?? '').trim();
    const jadwalId = String(a?.jadwalId ?? a?.jadwal_id ?? '').trim();
    if (!pesertaId || !jadwalId) continue;
    let status = String(a?.statusAbsensi ?? a?.status_absensi ?? a?.status ?? 'HADIR').toUpperCase();
    if (status === 'ALFA') status = 'ALPA';
    if (status === 'SAKIT' || status === 'DISPENSASI') status = 'IZIN';
    if (status === 'TERLAMBAT') status = 'HADIR';
    if (!ALLOWED_ATTENDANCE_STATUSES.includes(status as any)) continue;
    const waktuServer = String(a?.waktuServer ?? a?.waktu_server ?? a?.waktuScan ?? a?.waktu_scan ?? new Date().toISOString());
    const metadata = {
      namaKegiatan: a?.namaKegiatan ?? a?.nama_kegiatan ?? '',
      keteranganWaktu: a?.keteranganWaktu ?? a?.keterangan_waktu ?? 'TEPAT_WAKTU',
      menitKeterlambatan: Number(a?.menitKeterlambatan ?? a?.menit_keterlambatan ?? 0) || 0,
      alasanTerlambat: a?.alasanTerlambat ?? a?.alasan_terlambat ?? '',
      catatan: a?.catatan ?? '',
      waktuScan: a?.waktuScan ?? a?.waktu_scan ?? waktuServer,
      penggunaId: a?.penggunaId ?? a?.pengguna_id ?? session.user_id ?? '',
      musyrifBertugas: a?.musyrifBertugas ?? a?.musyrif_bertugas ?? '',
      sumberAbsensi: a?.sumberAbsensi ?? a?.sumber_absensi ?? 'SCAN_QR',
      statusValidasi: a?.statusValidasi ?? a?.status_validasi ?? 'SAH',
    };
    const id = String(a?.absensiId ?? a?.absensi_id ?? a?.id ?? newId('abs_')).trim();
    await env.DB.prepare(`
      INSERT INTO absensi (id, peserta_id, jadwal_id, status, waktu_server, keterangan)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(peserta_id, jadwal_id) DO UPDATE SET status=excluded.status,
        waktu_server=excluded.waktu_server, keterangan=excluded.keterangan, updated_at=CURRENT_TIMESTAMP
    `).bind(id, pesertaId, jadwalId, status, waktuServer, JSON.stringify(metadata)).run();
    savedAbsensi++;
  }

  let savedIzin = 0;
  for (const item of izinList) {
    const id = String(item?.izinId ?? item?.izin_id ?? item?.id ?? '').trim();
    const pesertaId = String(item?.pesertaId ?? item?.peserta_id ?? '').trim();
    const mulai = String(item?.tanggalMulai ?? item?.tanggal_mulai ?? item?.waktuMulai ?? '').trim();
    const selesai = String(item?.tanggalSelesai ?? item?.tanggal_selesai ?? item?.waktuSelesai ?? '').trim();
    if (!id || !pesertaId || !mulai || !selesai) continue;
    const statusRaw = String(item?.statusPersetujuan ?? item?.status_persetujuan ?? item?.status ?? 'MENUNGGU').toUpperCase();
    const status = ['MENUNGGU', 'DISETUJUI', 'DITOLAK'].includes(statusRaw) ? statusRaw : 'MENUNGGU';
    const metadata = {
      alasan: item?.alasan ?? '', jenisIzin: item?.jenisIzin ?? item?.jenis_izin ?? 'IZIN_MENDESAK',
      disetujuiOleh: item?.disetujuiOleh ?? item?.disetujui_oleh ?? item?.diputuskanOleh ?? '',
      waktuPengajuan: item?.waktuPengajuan ?? item?.waktu_pengajuan ?? new Date().toISOString(),
      waktuPersetujuan: item?.waktuPersetujuan ?? item?.waktu_persetujuan ?? item?.waktuKeputusan ?? '',
      catatan: item?.catatan ?? item?.catatanAdmin ?? '', nomorSurat: item?.nomorSurat ?? '',
      kodeVerifikasi: item?.kodeVerifikasi ?? '',
    };
    await env.DB.prepare(`
      INSERT INTO izin (id, peserta_id, tanggal_mulai, tanggal_selesai, alasan, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET peserta_id=excluded.peserta_id, tanggal_mulai=excluded.tanggal_mulai,
        tanggal_selesai=excluded.tanggal_selesai, alasan=excluded.alasan, status=excluded.status,
        updated_at=CURRENT_TIMESTAMP
    `).bind(id, pesertaId, mulai, selesai, JSON.stringify(metadata), status).run();
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
    const metadata = {
      alasan: item?.alasan ?? '', absensiId: item?.absensiId ?? item?.absensi_id ?? '',
      jadwalId: item?.jadwalId ?? item?.jadwal_id ?? '', namaKegiatan: item?.namaKegiatan ?? '',
      buktiLampiran: item?.buktiLampiran ?? '', disetujuiOleh: item?.disetujuiOleh ?? item?.diputuskanOleh ?? '',
      waktuPengajuan: item?.waktuPengajuan ?? new Date().toISOString(),
      waktuTindakan: item?.waktuTindakan ?? item?.waktuKeputusan ?? '',
    };
    await env.DB.prepare(`
      INSERT INTO pembenaran (id, peserta_id, tanggal, alasan, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET peserta_id=excluded.peserta_id, tanggal=excluded.tanggal,
        alasan=excluded.alasan, status=excluded.status, updated_at=CURRENT_TIMESTAMP
    `).bind(id, pesertaId, tanggal, JSON.stringify(metadata), status).run();
    savedPembenaran++;
  }

  await audit(env, session.user_id, 'SYNC', 'data');
  const count = savedBatch + savedPeserta + savedJadwal + savedAbsensi + savedIzin + savedPembenaran;
  return json({ success: true, count, batchDisimpan: savedBatch, pesertaDisimpan: savedPeserta,
    jadwalDisimpan: savedJadwal, absensiDisimpan: savedAbsensi, izinDisimpan: savedIzin,
    pembenaranDisimpan: savedPembenaran, message: 'Permintaan sinkronisasi selesai diproses.' }, 200, origin);
}

async function usersEndpoint(
  request: Request,
  env: Env,
  session: Session,
  origin: string,
): Promise<Response> {
  if (!requireRole(session, ['ADMIN'])) return errorResponse('Hanya admin yang dapat mengelola akun.', 403, origin);
  if (request.method === 'GET') {
    const result = await env.DB.prepare(`SELECT id, username, role, peserta_id, status, created_at, updated_at FROM users ORDER BY username`).all<any>();
    return json({ success: true, users: result.results.map((row: any) => ({
      id: row.id, username: row.username, namaLengkap: row.username, role: row.role,
      gender: '', statusAktif: row.status === 'AKTIF', pesertaId: row.peserta_id ?? undefined,
      createdAt: row.created_at, updatedAt: row.updated_at,
    })) }, 200, origin);
  }
  if (request.method !== 'POST') return errorResponse('Metode tidak didukung.', 405, origin);
  const body = await readBody(request);
  const id = String(body?.id ?? '').trim();
  const username = String(body?.username ?? '').trim();
  const password = typeof body?.password === 'string' ? body.password : '';
  const role = String(body?.role ?? '').toUpperCase();
  const status = body?.statusAktif === false ? 'NONAKTIF' : 'AKTIF';
  if (!username) return errorResponse('Username wajib diisi.', 400, origin);
  if (!['ADMIN', 'PETUGAS'].includes(role)) return errorResponse('Peran akun tidak valid.', 400, origin);
  const existing = id ? await env.DB.prepare('SELECT id, role, status FROM users WHERE id=? LIMIT 1').bind(id).first<any>() : null;
  if (id && !existing) return errorResponse('Akun yang akan diperbarui tidak ditemukan.', 404, origin);
  if (!existing && password.length < 10) return errorResponse('Kata sandi akun baru minimal 10 karakter.', 400, origin);
  if (password && password.length < 10) return errorResponse('Kata sandi minimal 10 karakter.', 400, origin);
  if (existing?.role === 'ADMIN' && existing?.status === 'AKTIF' && (role !== 'ADMIN' || status !== 'AKTIF')) {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM users WHERE role='ADMIN' AND status='AKTIF' AND id != ?`).bind(id).first<{ total: number }>();
    if (!count || count.total < 1) return errorResponse('Admin aktif terakhir tidak dapat dinonaktifkan atau diubah perannya.', 400, origin);
  }
  const accountId = id || newId('usr_');
  try {
    if (existing && !password) {
      await env.DB.prepare(`UPDATE users SET username=?, role=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(username, role, status, accountId).run();
    } else {
      const passwordHash = await hashPassword(password);
      await env.DB.prepare(`
        INSERT INTO users (id, username, password_hash, role, status)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET username=excluded.username, password_hash=excluded.password_hash,
          role=excluded.role, status=excluded.status, updated_at=CURRENT_TIMESTAMP
      `).bind(accountId, username, passwordHash, role, status).run();
    }
  } catch {
    return errorResponse('Akun gagal disimpan. Pastikan username belum digunakan.', 409, origin);
  }
  await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(new Date().toISOString(), accountId).run();
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
  const target = await env.DB.prepare('SELECT id, role, status FROM users WHERE id=? LIMIT 1').bind(id).first<any>();
  if (!target) return errorResponse('Akun tidak ditemukan.', 404, origin);
  if (target.role === 'ADMIN' && target.status === 'AKTIF') {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM users WHERE role='ADMIN' AND status='AKTIF'`).first<{ total: number }>();
    if (count && count.total <= 1) return errorResponse('Admin aktif terakhir tidak dapat dihapus.', 400, origin);
  }
  // Soft-delete: sessions memiliki foreign key ke users, jadi akun dinonaktifkan agar relasi historis tetap valid.
  await env.DB.batch([
    env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(new Date().toISOString(), id),
    env.DB.prepare(`UPDATE users SET status='NONAKTIF', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id),
  ]);
  await audit(env, session.user_id, 'DELETE_USER', 'users', id);
  return json({ success: true, message: 'Akun berhasil dinonaktifkan.' }, 200, origin);
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
