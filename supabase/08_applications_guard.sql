-- ============================================================
-- Labor2Go - Pengaman tabel applications
-- Menutup celah: mahasiswa tidak boleh menyetujui lamarannya sendiri.
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- ============================================================

-- ---------- 1. INSERT: hanya mahasiswa, status awal pending, lowongan masih terbuka ----------
drop policy if exists "applications_insert_own" on public.applications;
create policy "applications_insert_own" on public.applications
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and checked_in_at is null
    and checked_out_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.status = 'open' and j.start_at > now()
    )
  );

-- ---------- 2. UPDATE: aturan perpindahan status ----------
-- Mahasiswa : pending/accepted -> withdrawn (batal), withdrawn -> pending (melamar lagi),
--             serta mengisi check-in/check-out HANYA saat status accepted.
-- Merchant  : pending -> accepted / rejected (pemilik lowongan saja).
-- Server (service_role / SQL Editor, auth.uid() kosong): bebas, dipakai untuk escrow nanti.
create or replace function public.guard_application_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.job_id <> old.job_id or new.student_id <> old.student_id then
    raise exception 'job_id dan student_id tidak boleh diubah';
  end if;

  v_is_owner := exists (
    select 1 from public.jobs j
    where j.id = old.job_id and j.umkm_id = auth.uid()
  );

  if v_is_owner then
    -- Merchant tidak boleh mengisi waktu check-in/out atas nama mahasiswa
    if new.checked_in_at is distinct from old.checked_in_at
       or new.checked_out_at is distinct from old.checked_out_at then
      raise exception 'Merchant tidak boleh mengubah waktu check-in/check-out';
    end if;
    if new.status is distinct from old.status then
      if not (old.status = 'pending' and new.status in ('accepted', 'rejected')) then
        raise exception 'Perubahan status % -> % tidak diizinkan untuk merchant', old.status, new.status;
      end if;
    end if;

  elsif old.student_id = auth.uid() then
    if new.status is distinct from old.status then
      if not (
        (old.status in ('pending', 'accepted') and new.status = 'withdrawn')
        or (old.status = 'withdrawn' and new.status = 'pending')
      ) then
        raise exception 'Perubahan status % -> % tidak diizinkan untuk mahasiswa', old.status, new.status;
      end if;
    end if;
    -- Check-in/out hanya untuk lamaran yang sudah diterima
    if (new.checked_in_at is distinct from old.checked_in_at
        or new.checked_out_at is distinct from old.checked_out_at)
       and old.status <> 'accepted' then
      raise exception 'Check-in/check-out hanya untuk lamaran yang sudah diterima';
    end if;

  else
    raise exception 'Tidak berhak mengubah lamaran ini';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_application_update on public.applications;
create trigger trg_guard_application_update
  before update on public.applications
  for each row execute function public.guard_application_update();