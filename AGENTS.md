# Labor2Go – konteks proyek
Marketplace tenaga kerja mikro: UMKM (role 'umkm') memasang lowongan, mahasiswa (role 'student') melamar.

## Stack
Next.js App Router + TypeScript, Tailwind CSS, Supabase (@supabase/ssr), lucide-react. UI bahasa Indonesia, mobile-first (maks ~420px).

## Aturan
- Referensi desain ada di design/images (screenshot) dan design/code (HTML). Itu REFERENSI, jangan di-copy mentah; tulis ulang sebagai komponen React.
- Dilarang: Tailwind CDN, gambar dari URL eksternal, data hardcoded. Semua data dari Supabase.
- Warna utama oranye #FF6B00. Logo di /public/logo.png dan /public/logo-merchant.png.
- Jangan pernah mengubah saldo wallets dari client. Perubahan uang hanya lewat route handler server dengan service role key (hanya di server).
- Jangan commit .env.local. Kerjakan satu layar per tugas dan sebutkan file yang diubah.
- Jangan pernah menampilkan, mencetak, atau meng-commit isi .env.local atau API key.
- Setiap tabel/view baru di schema public WAJIB disertai GRANT eksplisit ke role
  authenticated (secukupnya) plus RLS. Tabel baru tidak otomatis terbuka ke Data API.
- Tabel applications: dari client, mahasiswa hanya boleh INSERT dengan status 'pending' dan
  meng-UPDATE status ke 'withdrawn' (batal) atau kembali ke 'pending'. Hanya pemilik lowongan yang
  boleh mengubah pending -> accepted/rejected. Jangan pernah mengirim status lain dari client.
- Terima pelamar HANYA lewat supabase.rpc('accept_application', { p_application_id }).
  Jangan pernah mengubah wallets/payments/wallet_transactions dari client, dan jangan
  meng-update applications.status = 'accepted' langsung. Biaya layanan dibaca dari tabel
  platform_settings (key 'service_fee_per_worker'), bukan hardcode.

## Database (sudah ada di Supabase, RLS aktif)
profiles, umkm_profiles, student_profiles, jobs, applications, payments, reviews, messages, wallets, wallet_transactions, withdrawals, job_templates, view profile_ratings.

- `jobs_feed`: View daftar lowongan aktif. Mahasiswa membaca lowongan lewat view `jobs_feed`, bukan tabel `jobs` langsung.