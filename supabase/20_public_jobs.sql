-- ============================================================
-- Labor2Go - View public_jobs_feed (pratinjau lowongan terbuka untuk halaman Welcome publik)
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang / idempoten)
-- ============================================================
-- Prinsip keamanan:
-- - Hanya menampilkan lowongan berstatus 'open', belum mulai, dan masih memiliki sisa slot.
-- - Tidak mengekspos umkm_id, nomor HP (phone), email, nama pemilik, alamat privat,
--   atau kolom verifikasi (verified, verification_status, verification_note).
-- - View berjalan dengan hak pemilik sehingga role anon tidak perlu izin SELECT langsung
--   ke tabel jobs, umkm_profiles, profiles, reviews, maupun applications.

create or replace view public.public_jobs_feed as
select
  j.id,
  j.title,
  j.location_name,
  j.lat,
  j.lng,
  j.start_at,
  j.end_at,
  j.pay_amount,
  j.created_at,
  u.business_name,
  u.business_type,
  coalesce(u.photo_url, p.avatar_url) as merchant_photo,
  r.avg_rating,
  coalesce(r.review_count, 0) as review_count,
  greatest(j.slots - coalesce(a.accepted_count, 0), 0) as slots_left
from public.jobs j
join public.umkm_profiles u on u.id = j.umkm_id
left join public.profiles p on p.id = j.umkm_id
left join (
  select reviewee_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*) as review_count
  from public.reviews
  group by reviewee_id
) r on r.reviewee_id = j.umkm_id
left join (
  select job_id, count(*) as accepted_count
  from public.applications
  where status = 'accepted'
  group by job_id
) a on a.job_id = j.id
where j.status = 'open'
  and j.start_at > now()
  and j.slots > coalesce(a.accepted_count, 0);

-- Izin eksplisit yang idempoten: hanya SELECT pada view publik ini
grant usage on schema public to anon, authenticated, service_role;
revoke all on public.public_jobs_feed from public;
grant select on public.public_jobs_feed to anon, authenticated, service_role;
