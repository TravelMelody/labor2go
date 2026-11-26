-- ============================================================
-- Labor2Go - Reset data demo
-- Menghapus SEMUA akun selain admin beserta seluruh data turunannya
-- (profil, lowongan, lamaran, pembayaran, dompet, mutasi, ulasan, chat, penarikan).
-- Struktur database, pengaturan platform, dan akun admin TIDAK dihapus.
-- ⚠ Tidak bisa dibatalkan. Jalankan di Supabase SQL Editor hanya saat mau mulai bersih.
-- Setelah ini: kosongkan juga Storage > ktm dan business-photos lewat dashboard (file lama tidak ikut terhapus).
-- ============================================================

delete from auth.users
 where id not in (select id from public.profiles where role = 'admin');

truncate table public.admin_audit_log;

-- Cek hasil (seharusnya hanya admin yang tersisa, semua tabel lain 0)
select
  (select count(*) from public.profiles)            as profiles,
  (select count(*) from public.jobs)                as jobs,
  (select count(*) from public.applications)        as applications,
  (select count(*) from public.payments)            as payments,
  (select count(*) from public.wallet_transactions) as wallet_transactions,
  (select count(*) from public.reviews)             as reviews,
  (select count(*) from public.messages)            as messages,
  (select count(*) from public.withdrawals)         as withdrawals,
  (select int_value from public.platform_settings where key = 'service_fee_per_worker') as biaya_layanan;