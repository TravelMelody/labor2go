-- ============================================================
-- Labor2Go - Kunci kolom phone di profiles
-- ⚠ JALANKAN HANYA SETELAH kode aplikasi tidak lagi membaca profiles.phone secara langsung
--   (semua pembacaan nomor HP sudah lewat rpc: get_my_phone, get_counterpart_contact, admin_get_phone)
--   dan tidak ada lagi .select('*') pada tabel profiles. Kalau dijalankan lebih awal, halaman yang
--   masih membaca phone akan error "permission denied".
-- Jalankan di Supabase: SQL Editor > New query > paste > Run
-- ============================================================

-- Cabut izin baca seluruh kolom, lalu beri izin baca tanpa kolom phone
revoke select on public.profiles from authenticated;
grant select (id, role, full_name, verified, verification_status, verification_note, no_show_count, created_at)
  on public.profiles to authenticated;

-- Izin UPDATE (full_name, phone) tidak berubah: user tetap bisa memperbarui nomornya sendiri.

-- ---------- Untuk membatalkan (rollback) jika ada halaman yang error ----------
-- grant select on public.profiles to authenticated;
