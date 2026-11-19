-- ============================================================
-- Labor2Go - View jobs_feed (daftar lowongan untuk Beranda & Eksplor mahasiswa)
-- Jalankan di Supabase: SQL Editor > New query > paste > Run
-- ============================================================
-- Kenapa view? Mahasiswa tidak boleh melihat lamaran orang lain (RLS), tapi kartu
-- lowongan perlu "sisa slot" dan rating merchant. View ini berjalan dengan hak
-- pemilik (bukan RLS pemanggil) dan HANYA mengeluarkan kolom publik dari
-- lowongan yang masih terbuka, belum mulai, dan masih punya slot.
-- (Supabase mungkin menandai ini di Security Advisor; itu disengaja.)

create or replace view public.jobs_feed as
select
  j.id,
  j.umkm_id,
  j.title,
  j.description,
  j.location_name,
  j.lat,
  j.lng,
  j.start_at,
  j.end_at,
  j.pay_amount,
  j.slots,
  j.created_at,
  u.business_name,
  u.business_type,
  u.photo_url as business_photo,
  r.avg_rating,
  coalesce(r.review_count, 0) as review_count,
  greatest(j.slots - coalesce(a.accepted_count, 0), 0) as slots_left
from public.jobs j
join public.umkm_profiles u on u.id = j.umkm_id
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

-- Hanya user yang login (bukan anon) yang boleh membaca
revoke all on public.jobs_feed from anon;
grant select on public.jobs_feed to authenticated;