-- ============================================================
-- Labor2Go - Perbaikan "infinite recursion detected in policy" (jobs <-> applications)
-- Jalankan di Supabase: SQL Editor > New query > paste > Run
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- Fungsi bantu: berjalan dengan hak pemilik fungsi sehingga TIDAK memicu RLS lagi
-- (inilah yang memutus lingkaran jobs -> applications -> jobs).
create or replace function public.is_job_owner(p_job_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.jobs
    where id = p_job_id and umkm_id = auth.uid()
  );
$$;

create or replace function public.has_applied(p_job_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.applications
    where job_id = p_job_id and student_id = auth.uid()
  );
$$;

grant execute on function public.is_job_owner(uuid) to authenticated;
grant execute on function public.has_applied(uuid) to authenticated;

-- ---------- Ganti policy yang saling menunjuk ----------
drop policy if exists "jobs_read" on public.jobs;
create policy "jobs_read" on public.jobs
  for select to authenticated
  using (
    status = 'open'
    or umkm_id = auth.uid()
    or public.has_applied(id)
  );

drop policy if exists "applications_read" on public.applications;
create policy "applications_read" on public.applications
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_job_owner(job_id)
  );

drop policy if exists "applications_update" on public.applications;
create policy "applications_update" on public.applications
  for update to authenticated
  using (
    student_id = auth.uid()
    or public.is_job_owner(job_id)
  );
