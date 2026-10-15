# BIMMAPortal — Cloudflare D1

## Prinsip penyimpanan

- Cloudflare D1 adalah penyimpanan persisten dan sumber data saat sesi dibuka. Data bisnis tidak ditulis kembali ke `localStorage`; penyimpanan browser hanya dipakai sementara untuk mengimpor instalasi lama sekali saat koleksi D1 masih kosong, lalu key bisnis lama dibersihkan setelah bootstrap sukses. Cache dalam memori dipakai agar komponen React lama yang sinkron tetap dapat berjalan.
- Data peserta, batch, jadwal, absensi, izin, pembenaran, musyrif, konfigurasi, dan audit disimpan pada tabel `app_collections`. Data peserta juga disalin ke tabel relasional `peserta` agar login QR dan query relasional tetap kompatibel. Akun dan sesi disimpan di tabel relasional `users` dan `sessions`; password hanya disimpan dalam bentuk hash PBKDF2.
- Endpoint penulisan yang gagal tidak dianggap sukses oleh API. Penulisan koleksi dari cache aplikasi diantrikan; kegagalan ditampilkan sebagai pemberitahuan di dalam aplikasi.

## Deploy

**Deploy sebagai Cloudflare Worker dengan Static Assets**, memakai `wrangler.jsonc` dan `src/worker.ts` sebagai satu-satunya API. Jangan deploy proyek ini sebagai Cloudflare Pages: handler Pages lama yang skemanya bertentangan sudah dihapus agar tidak ada dua implementasi API yang berbeda.

1. Pastikan binding D1 `DB` pada environment Worker Production menunjuk ke database yang benar (`bimma-absensi-db`).
2. Jalankan migration secara berurutan: `npx wrangler d1 migrations apply bimma-absensi-db --remote`. Jangan menjalankan `schema.sql` bersamaan dengan migrations di database yang sama; `schema.sql` hanya untuk membuat skema lengkap pada database kosong.
3. Jalankan `npm install`, kemudian `npm run build`.
4. Deploy Worker dan assets dengan `npx wrangler deploy`.
5. Pastikan `https://absensi.bimma-uab.my.id/api/d1/health` mengembalikan `success: true`. Endpoint `/api/d1/health` harus dijalankan oleh Worker yang sama dengan binding `DB` di atas.
6. Login dengan akun yang memang ada pada tabel `users`. Jika database masih kosong dan belum memiliki admin, buat admin pertama secara aman menggunakan bootstrap di bawah.

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
