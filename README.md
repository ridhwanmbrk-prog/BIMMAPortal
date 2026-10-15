<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4e636a8b-5e17-4136-8076-b516afdf5eee

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Migrasi D1 untuk penyimpanan data aplikasi

1. Pastikan binding `DB` di `wrangler.jsonc` menunjuk ke database D1 yang benar.
2. Jalankan migration berurutan pada database target:
   `npx wrangler d1 migrations apply bimma-absensi-db --remote`
3. Pastikan folder `migrations/` berisi `0001_initial.sql`, `0002_sessions.sql`, `0003_user_profile.sql`, dan `0004_app_collections.sql`.
4. Deploy Worker + assets dengan `npm run build` lalu `npx wrangler deploy`.
5. Login melalui endpoint D1; setelah sesi terautentikasi, aplikasi memuat koleksi D1 dan melakukan migrasi awal dari cache browser hanya bila tabel koleksi D1 masih kosong.

Akun disimpan melalui endpoint `/api/d1/users` dan tidak disimpan ke tabel JSON koleksi, agar kata sandi tidak tersalin sebagai teks biasa ke `app_collections`.
