# BIMMAPortal — Cloudflare D1

## Prinsip penyimpanan

- Cloudflare D1 adalah penyimpanan persisten dan sumber data saat sesi dibuka. Data bisnis tidak ditulis kembali ke `localStorage`; penyimpanan browser hanya dipakai sementara untuk mengimpor instalasi lama sekali saat koleksi D1 masih kosong, lalu key bisnis lama dibersihkan setelah bootstrap sukses. Cache dalam memori dipakai agar komponen React lama yang sinkron tetap dapat berjalan.
- `app_collections` tetap dipertahankan sebagai sumber kompatibilitas untuk frontend yang masih memakai API koleksi. Setelah skema tambahan diterapkan, `PESERTA`, `BATCH`, dan `IZIN` disalin ke tabel relasional masing-masing secara non-destruktif; payload JSON lengkap disimpan pada kolom `data_json` agar field aplikasi tidak hilang. Relasi peserta-batch disimpan di `batch_peserta`. Akun dan sesi tetap disimpan pada `users` dan `sessions`; password hanya disimpan dalam bentuk hash PBKDF2.
- Endpoint penulisan yang gagal tidak dianggap sukses oleh API. Penulisan koleksi dari cache aplikasi diantrikan; kegagalan ditampilkan sebagai pemberitahuan di dalam aplikasi.

## Deploy

**Deploy sebagai Cloudflare Worker dengan Static Assets**, memakai `wrangler.jsonc` dan `src/worker.ts` sebagai satu-satunya API. Jangan deploy proyek ini sebagai Cloudflare Pages: handler Pages lama yang skemanya bertentangan sudah dihapus agar tidak ada dua implementasi API yang berbeda.

1. Pastikan binding D1 `DB` pada environment Worker Production menunjuk ke database yang benar (`bimma-absensi-db`).
2. Untuk database produksi yang sudah berisi data, pastikan ada cadangan yang dapat dipulihkan sebelum mengubah skema.
3. Pada D1 SQL Console, terapkan isi `migrations/0005_relational_payloads.sql` **satu kali saja** pada database yang benar. Jangan jalankan ulang migrations lama atau `schema.sql` pada database berisi data; perintah `ALTER TABLE` di file-file tersebut bukan untuk dijalankan berulang. Jika migration 0005 pernah diterapkan sebagian, periksa `PRAGMA table_info(...)` dan tambahkan hanya kolom yang belum ada—jangan tempel ulang seluruh file.
4. Jalankan `npm install`, kemudian `npm run build`.
5. Deploy Worker dan assets dengan `npx wrangler deploy`.
6. Pastikan `https://absensi.bimma-uab.my.id/api/d1/health` mengembalikan `success: true`. Endpoint `/api/d1/health` harus dijalankan oleh Worker yang sama dengan binding `DB` di atas.
7. Login sebagai Admin. Jika belum ada akun Admin, ikuti bagian **Bootstrap admin pertama** di bawah terlebih dahulu. Buka **Pengaturan Sistem**, lalu gunakan tombol **Migrasikan PESERTA, BATCH, IZIN** satu kali setelah skema 0005 diterapkan. Jika validasi menemukan ID duplikat, tanggal izin tidak lengkap, atau rujukan peserta/batch yang tidak tersedia, proses berhenti dan koleksi JSON lama tetap dipertahankan.
8. Setelah UI menyatakan migrasi selesai, jalankan query verifikasi di bagian **Pemeriksaan migrasi relasional** di bawah. Jumlah di tabel sumber lama tetap dipertahankan.

## Bootstrap admin pertama (hanya bila tabel users belum memiliki admin)

1. Pasang secret sementara: `npx wrangler secret put ADMIN_BOOTSTRAP_SECRET`. Isi secret acak yang kuat.
2. Setelah deploy, panggil endpoint bootstrap melalui terminal tepercaya dengan secret yang sama dan password admin baru minimal 12 karakter:

```bash
curl -X POST 'https://absensi.bimma-uab.my.id/api/admin/bootstrap' \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Bootstrap-Secret: SECRET_YANG_TADI_DIPASANG' \
  --data '{"username":"admin-baru","password":"GANTI_DENGAN_PASSWORD_UNIK_MINIMAL_12_KARAKTER"}'
```

3. Setelah berhasil, hapus secret bootstrap dari Worker: `npx wrangler secret delete ADMIN_BOOTSTRAP_SECRET`. Jangan gunakan password contoh, dan jangan simpan secret di frontend atau repository. Bila tabel `users` sudah mempunyai admin, endpoint akan menolak bootstrap.

## Pemeriksaan

- Coba login, buka Data Santri, buat/edit/hapus data, lalu refresh dan buka aplikasi dari browser lain. Data harus tetap muncul.
- Periksa `Application > Local Storage`: key bisnis `bimma_peserta`, `bimma_absensi`, `bimma_jadwal`, `bimma_batch`, `bimma_izin`, `bimma_pembenaran`, `bimma_musyrif`, `bimma_config`, `bimma_audit`, dan `bimma_users_accounts` seharusnya dihapus setelah bootstrap D1 berhasil. `bimma_current_user` dan preferensi tampilan/navigasi boleh tetap tersimpan di browser.
- Jika muncul notifikasi kegagalan simpan D1 atau HTTP 429, jangan menghapus browser data lama secara manual; periksa log Worker dan ulangi setelah penyebab request ditangani.


## Migrasi relasional bertahap

- Endpoint `POST /api/d1/admin/relational-migrate` hanya menerima sesi Admin. Tombol di Pengaturan memanggil endpoint tersebut.
- Migrasi awal bersifat upsert/idempoten untuk ID yang sama dan mempertahankan `app_collections`; status selesai dicatat pada `app_config` dengan ID `relational_seed_v1`.
- `PESERTA`, `BATCH`, dan `IZIN` sekarang ditulis ke koleksi JSON lama dan tabel relasional dalam satu alur Worker. Data relasional belum dijadikan satu-satunya sumber baca aplikasi.
- **Belum melakukan cutover seluruh sistem.** Skema `jadwal_kegiatan` dan `absensi` saat ini belum mewakili jadwal kegiatan berulang dengan benar (absensi punya batas unik peserta-jadwal), jadi jangan alihkan seluruh bacaan ke tabel relasional sebelum desain dan migrasinya diverifikasi.


## Pemeriksaan migrasi relasional

Jalankan tiap query secara terpisah pada D1 SQL Console untuk menghindari batasan query gabungan di console:

```sql
SELECT id, nama, tanggal_mulai, tanggal_selesai, status FROM batch ORDER BY id;
SELECT id, nim, nama, status FROM peserta ORDER BY id;
SELECT batch_id, peserta_id FROM batch_peserta ORDER BY batch_id, peserta_id;
SELECT id, peserta_id, tanggal_mulai, tanggal_selesai, status, jenis_izin FROM izin ORDER BY id;
SELECT collection_key, length(value_json) AS ukuran_json FROM app_collections ORDER BY collection_key;
```

Berdasarkan pemeriksaan awal database, hasil yang diharapkan sesudah migrasi adalah 2 batch, 2 peserta, 2 relasi peserta-batch, dan 3 izin (jika seluruh data izin lolos validasi). Koleksi JSON `PESERTA`, `BATCH`, dan `IZIN` harus tetap ada. Jangan menghapus `app_collections` atau penanda `relational_seed_v1`; tahap ini baru mengisi salinan relasional, belum memindahkan seluruh pembacaan aplikasi dari JSON.
