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
- Check-in/out, konfirmasi selesai, lapor tidak hadir, dan batalkan lowongan HANYA lewat
  supabase.rpc: check_in, check_out, confirm_completion, report_no_show, cancel_job
  (parameter: p_application_id atau p_job_id). Jangan update kolom checked_in_at/checked_out_at
  atau tabel uang dari client.
- Error bisnis dari database (saldo kurang, slot penuh, dll., error.code 'P0001') tampilkan ke
  user dan catat dengan console.warn; console.error hanya untuk error tak terduga.
- Uang bergerak hanya lewat fungsi database: credit_topup/fail_topup (khusus service_role, dari API route server),
  request_withdrawal (mahasiswa, rpc), resolve_withdrawal (admin). Client tidak boleh insert/update wallets,
  wallet_transactions, atau withdrawals.
- SUPABASE_SERVICE_ROLE_KEY dan MIDTRANS_SERVER_KEY hanya dipakai di kode server (file dengan
  `import 'server-only'`), tidak boleh ada di komponen client atau diawali NEXT_PUBLIC_.
- Ulasan HANYA lewat supabase.rpc('submit_review', { p_application_id, p_rating, p_comment }).
  Jangan insert ke tabel reviews dari client. Tabel reviews boleh dibaca (select).
  Saat embed profiles dari reviews, pakai hint FK karena ada dua relasi ke profiles
  (profiles!reviews_reviewer_id_fkey / profiles!reviews_reviewee_id_fkey).
- Halaman /admin TIDAK memakai service role. Semua aksi admin lewat rpc: admin_set_verification,
  resolve_withdrawal, admin_stats. Foto KTM hanya ditampilkan lewat signed URL berumur 60 detik
  (supabase.storage.from('ktm').createSignedUrl(path, 60)); jangan simpan atau log URL itu.
- Role admin tidak perlu onboarding dan hanya boleh mengakses /admin.
- Setelah akun terverifikasi (profiles.verified = true), nama, NIM, kampus, foto KTM, nama usaha, dan foto
  usaha TERKUNCI di database (error dari trigger). UI menampilkan field itu read-only dengan ikon kunci
  dan JANGAN mengirimnya saat update. profiles hanya boleh di-update pada full_name dan phone.
- Ajukan ulang verifikasi hanya lewat supabase.rpc('request_reverification'), dan hanya untuk
  verification_status = 'rejected'.
- Konstanta konfigurasi (email bantuan, nama level) disimpan di lib/config.ts dan lib/levels.ts.

## Database (sudah ada di Supabase, RLS aktif)
profiles, umkm_profiles, student_profiles, jobs, applications, payments, reviews, messages, wallets, wallet_transactions, withdrawals, job_templates, view profile_ratings.

- `jobs_feed`: View daftar lowongan aktif. Mahasiswa membaca lowongan lewat view `jobs_feed`, bukan tabel `jobs` langsung.