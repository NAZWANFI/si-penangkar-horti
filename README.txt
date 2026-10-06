SI PENANGKAR HORTI - Panduan pemasangan

1. SUPABASE
- Buka project Supabase kamu.
- Masuk SQL Editor.
- Buka database.sql dari folder ini.
- Copy seluruh isinya ke SQL Editor lalu Run.

2. BUAT AKUN PETUGAS
- Masuk Authentication > Users.
- Create user.
- Isi email dan password yang akan dipakai pada halaman login aplikasi.
- Setelah user dibuat, salin UUID user.
- Di SQL Editor jalankan:
  update public.profiles set role='editor' where id='UUID_USER_DI_SINI';
- Ganti UUID_USER_DI_SINI dengan UUID asli.

3. JALANKAN VERSI WEB
- Folder ini dapat dibuka dengan web server lokal.
- Jangan membuka file index.html dengan double-click jika browser memblokir fitur tertentu.
- Untuk VS Code, gunakan Live Server atau server lokal lain.

4. DESKTOP WINDOWS
- Install Node.js LTS.
- Buka terminal di folder project.
- Jalankan: npm install
- Jalankan: npm start
- Untuk membuat paket Windows: npm run dist

5. MOBILE ANDROID
- Versi HTML/CSS/JS yang sama dapat dibungkus memakai Capacitor.
- Langkah Capacitor dilakukan setelah versi web dan desktop sudah berhasil.

CATATAN KEAMANAN
- File supabase.js menggunakan publishable key, bukan secret key.
- Jangan memasukkan sb_secret_... atau service_role key ke HTML/JS.
- Keamanan perubahan data bergantung pada Row Level Security di database.sql.
