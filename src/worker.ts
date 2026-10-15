
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
        (
          s.user_id IS NOT NULL
          AND u.status_aktif = 'AKTIF'
          AND u.role = s.role
        )
        OR
        (
          s.peserta_id IS NOT NULL
          AND p.status_peserta = 'AKTIF'
          AND s.role = 'PESERTA'
        )
      )
    LIMIT 1
  `)
    .bind(tokenHash, new Date().toISOString())
    .first<Session>();

  return session ?? null;
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
        waktu_server,
        pengguna_id,
        aksi,
        jenis_entitas,
        entitas_id,
        status_aksi
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(
        new Date().toISOString(),
        userId,
        aksi,
        entitas ?? null,
        entitasId ?? null,
        'BERHASIL',
      )
      .run();
  } catch (error) {
    // Kegagalan pencatatan audit tidak boleh membocorkan detail database.
    console.error('Audit log gagal disimpan.');
  }
}


async function login(
  body: any,
  env: Env,
  origin: string,
): Promise<Response> {
  const key = String(body?.key ?? '').trim();
  const password =
    typeof body?.password === 'string' ? body.password : '';

  if (!key) {
    return errorResponse(
      'NIM atau username wajib diisi.',
      400,
      origin,
    );
  }

  // Login admin/petugas: username atau ID beserta kata sandi.
  if (password) {
    const row = await env.DB.prepare(`
      SELECT
        id,
        username,
        password_hash,
        nama_lengkap,
        role,
        gender,
        status_aktif
      FROM users
      WHERE (username = ? OR id = ?)
        AND role IN ('ADMIN', 'PETUGAS')
        AND status_aktif = 'AKTIF'
      LIMIT 1
    `)
      .bind(key, key)
      .first<any>();

    if (!row) {
      return errorResponse(
        'Username atau kata sandi tidak valid.',
        401,
        origin,
      );
    }

    const verification = await verifyPassword(
      password,
      row.password_hash,
    );

    if (!verification.valid) {
      return errorResponse(
        'Username atau kata sandi tidak valid.',
        401,
        origin,
      );
    }

    if (verification.upgradedHash) {
      await env.DB.prepare(`
        UPDATE users
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .bind(verification.upgradedHash, row.id)
        .run();
    }

    const session = await createSession(
      env,
      row.role,
      row.id,
      null,
    );

    await audit(env, row.id, 'LOGIN', 'users', row.id);

    return json(
      {
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: safeUser(row),
      },
      200,
      origin,
    );
  }

  // Login peserta memakai NIM atau ID peserta.
  const peserta = await env.DB.prepare(`
    SELECT
      peserta_id,
      nim,
      nama_lengkap,
      gender,
      program_studi,
      batch_id,
      kamar,
      nomor_whatsapp,
      email,
      alamat,
      qr_code,
      tanggal_masuk,
      status_peserta,
      created_at,
      updated_at
    FROM peserta
    WHERE (nim = ? OR peserta_id = ?)
      AND status_peserta = 'AKTIF'
    LIMIT 1
  `)
    .bind(key, key)
    .first<any>();

  if (!peserta) {
    return errorResponse(
      'Peserta tidak ditemukan atau tidak aktif.',
      401,
      origin,
    );
  }

  const session = await createSession(
    env,
    'PESERTA',
    null,
    peserta.peserta_id,
  );

  return json(
    {
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: peserta.peserta_id,
        username: peserta.nim,
        namaLengkap: peserta.nama_lengkap,
        role: 'PESERTA',
        statusAktif: true,
      },
      peserta: mapPeserta(peserta),
    },
    200,
    origin,
  );
}


async function getParticipantData(
  env: Env,
  pesertaId: string,
): Promise<Record<string, unknown>> {
  const [
    peserta,
    absensi,
    batch,
    jadwal,
    izin,
    pembenaran,
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT *
      FROM peserta
      WHERE peserta_id = ?
      LIMIT 1
    `)
      .bind(pesertaId)
      .first<any>(),

    env.DB.prepare(`
      SELECT *
      FROM absensi
      WHERE peserta_id = ?
      ORDER BY waktu_server DESC
    `)
      .bind(pesertaId)
      .all<any>(),

    env.DB.prepare(`
      SELECT b.*
      FROM batch b
      JOIN peserta p ON p.batch_id = b.id
      WHERE p.peserta_id = ?
      LIMIT 1
    `)
      .bind(pesertaId)
      .all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM jadwal_kegiatan
      WHERE status_aktif = 'AKTIF'
      ORDER BY hari, jam_mulai
    `).all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM izin
      WHERE peserta_id = ?
      ORDER BY tanggal_mulai DESC
    `)
      .bind(pesertaId)
      .all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM pembenaran
      WHERE peserta_id = ?
      ORDER BY tanggal DESC
    `)
      .bind(pesertaId)
      .all<any>(),
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

async function getStaffData(
  env: Env,
): Promise<Record<string, unknown>> {
  const [
    peserta,
    absensi,
    jadwal,
    batch,
    izin,
    pembenaran,
    musyrif,
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT *
      FROM peserta
      ORDER BY nama_lengkap
    `).all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM absensi
      ORDER BY waktu_server DESC
    `).all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM jadwal_kegiatan
      ORDER BY hari, jam_mulai
    `).all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM batch
      ORDER BY tanggal_mulai DESC
    `).all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM izin
      ORDER BY tanggal_mulai DESC
    `).all<any>(),

    env.DB.prepare(`
      SELECT *
      FROM pembenaran
      ORDER BY tanggal DESC
    `).all<any>(),

    env.DB.prepare(`
      SELECT id, nama, kontak, status, peran, created_at
      FROM musyrif
      ORDER BY nama
    `).all<any>(),
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
    keteranganWaktu: row.keterangan_waktu ?? '',
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
  return {
    id: row.jadwal_id,
    jadwalId: row.jadwal_id,
    namaKegiatan: row.nama_kegiatan ?? '',
    hari: row.hari ?? '',
    jamMulai: row.jam_mulai ?? '',
    jamSelesai: row.jam_selesai ?? '',
    deskripsi: row.deskripsi ?? '',
    toleransiMenit: row.toleransi_menit ?? 0,
    toleransiBukaAwal: row.toleransi_menit ?? 0,
    toleransiTutupAkhir: row.toleransi_menit ?? 0,
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
    nomorSurat: row.nomor_surat ?? '',
    kodeVerifikasi: row.kode_verifikasi ?? '',
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
    alasan: row.alasan ?? '',
    buktiLampiran: row.bukti_lampiran ?? '',
    status: row.status_pengajuan ?? '',
    statusPengajuan: row.status_pengajuan ?? '',
    disetujuiOleh: row.disetujui_oleh ?? '',
    waktuPengajuan: row.waktu_pengajuan ?? '',
    waktuTindakan: row.waktu_tindakan ?? '',
    createdAt: row.created_at ?? '',
  };
}
