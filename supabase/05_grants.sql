-- ============================================================
-- Labor2Go - GRANT per tabel (Supabase Data API: tabel baru tidak otomatis terbuka)
-- Jalankan di SQL Editor SETELAH labor2go_schema.sql dan labor2go_schema_wallet.sql
-- Prinsip: izin secukupnya per tabel. Baris yang boleh diakses tetap diatur RLS.
-- ============================================================

grant usage on schema public to authenticated, service_role;

-- ---------- Identitas ----------
-- profiles: baca semua kolom; UPDATE hanya full_name & phone (role/verified terkunci).
-- Baris profil dibuat oleh trigger, jadi tidak ada INSERT dari client.
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

grant select, insert, update on public.umkm_profiles to authenticated;

-- student_profiles: level & completed_jobs tidak boleh diubah dari client.
-- 'id' ikut di-grant UPDATE karena upsert (ON CONFLICT DO UPDATE) menyertakannya;
-- RLS (id = auth.uid()) tetap mencegah mengubah id ke milik orang lain.
grant select on public.student_profiles to authenticated;
revoke insert, update on public.student_profiles from authenticated;
grant insert (id, nim, university, skills, ktm_url) on public.student_profiles to authenticated;
grant update (id, nim, university, skills, ktm_url) on public.student_profiles to authenticated;

-- ---------- Inti marketplace ----------
grant select, insert, update on public.jobs to authenticated;
grant select, insert, update on public.applications to authenticated;
grant select, insert on public.reviews to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.job_templates to authenticated;

-- ---------- Uang: client hanya BACA (saldo diubah server via service_role) ----------
grant select on public.payments to authenticated;
grant select on public.wallets to authenticated;
grant select on public.wallet_transactions to authenticated;
grant select, insert on public.withdrawals to authenticated;

-- View rating rata-rata
grant select on public.profile_ratings to authenticated;

-- Fungsi pengecekan admin (dipakai policy Storage KTM)
grant execute on function public.is_admin() to authenticated;

-- ---------- Server (service role) ----------
-- Hanya dipakai di kode SERVER (route handler). Jangan pernah di client/browser.
grant all on all tables in schema public to service_role;

-- ---------- Cek hasil ----------
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and grantee = 'authenticated'
-- order by table_name, privilege_type;
