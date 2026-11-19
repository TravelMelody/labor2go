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

## Database (sudah ada di Supabase, RLS aktif)
profiles, umkm_profiles, student_profiles, jobs, applications, payments, reviews, messages, wallets, wallet_transactions, withdrawals, job_templates, view profile_ratings.