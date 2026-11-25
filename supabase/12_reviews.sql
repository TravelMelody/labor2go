-- ============================================================
-- Labor2Go - Ulasan dua arah (mahasiswa <-> merchant) yang tervalidasi
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- ============================================================
-- Aturan:
--  * Ulasan hanya bisa diberikan setelah pekerjaan SELESAI (dana sudah dicairkan).
--  * Hanya pihak yang terlibat: mahasiswa menilai merchant, merchant menilai mahasiswa tsb.
--  * Satu ulasan per pasangan (pemberi -> penerima) per lowongan. Tidak bisa diedit.
--  * Rating 1-5, komentar opsional maks 500 karakter.

create or replace function public.submit_review(
  p_application_id uuid,
  p_rating int,
  p_comment text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_reviewee uuid;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_app from public.applications where id = p_application_id;
  if not found then raise exception 'Pekerjaan tidak ditemukan'; end if;
  select * into v_job from public.jobs where id = v_app.job_id;

  if v_app.status <> 'accepted' then
    raise exception 'Pekerjaan ini tidak berstatus diterima';
  end if;
  if not exists (
    select 1 from public.payments
    where application_id = v_app.id and status = 'released'
  ) then
    raise exception 'Ulasan baru bisa diberikan setelah pekerjaan selesai dan dibayar';
  end if;

  if v_uid = v_app.student_id then
    v_reviewee := v_job.umkm_id;
  elsif v_uid = v_job.umkm_id then
    v_reviewee := v_app.student_id;
  else
    raise exception 'Kamu tidak terlibat dalam pekerjaan ini';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating harus 1 sampai 5';
  end if;
  if v_comment is not null and char_length(v_comment) > 500 then
    raise exception 'Komentar maksimal 500 karakter';
  end if;

  begin
    insert into public.reviews (job_id, reviewer_id, reviewee_id, rating, comment)
    values (v_job.id, v_uid, v_reviewee, p_rating, v_comment);
  exception when unique_violation then
    raise exception 'Kamu sudah memberi ulasan untuk pekerjaan ini';
  end;
end;
$$;

revoke all on function public.submit_review(uuid, int, text) from public, anon;
grant execute on function public.submit_review(uuid, int, text) to authenticated;

-- Tutup jalan pintas: client tidak boleh menulis reviews langsung
drop policy if exists "reviews_insert_own" on public.reviews;
revoke insert on public.reviews from authenticated;