-- ============================================================
-- Labor2Go - Siklus kerja: check-in/out, pencairan dana, no-show, batal + refund
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- Prasyarat: labor2go_accept_escrow.sql sudah dijalankan.
-- ============================================================
-- Semua perpindahan uang dan perubahan check-in/out lewat fungsi di bawah.
-- Client TIDAK boleh mengubah kolom check-in/out atau saldo secara langsung.

-- ---------- 1. Perbarui trigger pengaman applications ----------
-- Fungsi RPC di bawah menyalakan flag 'labor2go.rpc' (hanya berlaku dalam transaksi itu)
-- sehingga perubahan yang mereka lakukan lolos. Update langsung dari client untuk
-- check-in/out kini ditolak (waktu harus berasal dari server).
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
  if current_setting('labor2go.rpc', true) = 'on' then
    return new;
  end if;

  if new.job_id <> old.job_id or new.student_id <> old.student_id then
    raise exception 'job_id dan student_id tidak boleh diubah';
  end if;

  if new.checked_in_at is distinct from old.checked_in_at
     or new.checked_out_at is distinct from old.checked_out_at then
    raise exception 'Check-in/check-out hanya bisa lewat tombol di aplikasi';
  end if;

  v_is_owner := exists (
    select 1 from public.jobs j
    where j.id = old.job_id and j.umkm_id = auth.uid()
  );

  if v_is_owner then
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

  else
    raise exception 'Tidak berhak mengubah lamaran ini';
  end if;

  return new;
end;
$$;

-- ---------- 2. Mahasiswa check-in ----------
create or replace function public.check_in(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found or v_app.student_id <> v_uid then
    raise exception 'Lamaran tidak ditemukan';
  end if;
  if v_app.status <> 'accepted' then raise exception 'Lamaran belum diterima'; end if;
  if v_app.checked_in_at is not null then raise exception 'Kamu sudah check-in'; end if;

  select * into v_job from public.jobs where id = v_app.job_id for update;
  if now() < v_job.start_at - interval '30 minutes' then
    raise exception 'Check-in baru dibuka 30 menit sebelum jam mulai';
  end if;
  if now() > v_job.end_at then
    raise exception 'Waktu kerja sudah berakhir';
  end if;

  perform set_config('labor2go.rpc', 'on', true);
  update public.applications set checked_in_at = now() where id = v_app.id;
  update public.jobs set status = 'in_progress'
   where id = v_job.id and status in ('open', 'filled');
end;
$$;

-- ---------- 3. Mahasiswa check-out ----------
create or replace function public.check_out(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found or v_app.student_id <> v_uid then
    raise exception 'Lamaran tidak ditemukan';
  end if;
  if v_app.status <> 'accepted' then raise exception 'Lamaran belum diterima'; end if;
  if v_app.checked_in_at is null then raise exception 'Kamu belum check-in'; end if;
  if v_app.checked_out_at is not null then raise exception 'Kamu sudah check-out'; end if;

  perform set_config('labor2go.rpc', 'on', true);
  update public.applications set checked_out_at = now() where id = v_app.id;
end;
$$;

-- ---------- 4. Merchant konfirmasi selesai -> upah dicairkan ke mahasiswa ----------
create or replace function public.confirm_completion(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_pay public.payments%rowtype;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Lamaran tidak ditemukan'; end if;
  select * into v_job from public.jobs where id = v_app.job_id for update;
  if v_job.umkm_id <> v_uid then raise exception 'Ini bukan lowongan kamu'; end if;
  if v_app.status <> 'accepted' then raise exception 'Lamaran tidak berstatus diterima'; end if;
  if v_app.checked_out_at is null then raise exception 'Mahasiswa belum check-out'; end if;

  select * into v_pay from public.payments
   where application_id = v_app.id and status = 'held' for update;
  if not found then raise exception 'Dana sudah dicairkan atau tidak ditemukan'; end if;

  update public.payments set status = 'released' where id = v_pay.id;

  update public.wallets
     set balance = balance + v_pay.amount, updated_at = now()
   where user_id = v_app.student_id;

  insert into public.wallet_transactions (user_id, type, amount, status, application_id, note)
  values (v_app.student_id, 'job_earning', v_pay.amount, 'success', v_app.id,
          'Upah: ' || v_job.title);

  -- Progres mahasiswa: level naik setiap 3 pekerjaan selesai
  update public.student_profiles
     set completed_jobs = completed_jobs + 1,
         level = 1 + ((completed_jobs + 1) / 3)
   where id = v_app.student_id;

  -- Lowongan selesai jika semua pekerja yang diterima sudah dibayar
  if not exists (
    select 1
    from public.applications a
    join public.payments p on p.application_id = a.id
    where a.job_id = v_job.id and a.status = 'accepted' and p.status <> 'released'
  ) then
    update public.jobs set status = 'completed' where id = v_job.id;
  end if;
end;
$$;

-- ---------- 5. Merchant lapor mahasiswa tidak hadir -> refund + penalti ----------
create or replace function public.report_no_show(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_pay public.payments%rowtype;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Lamaran tidak ditemukan'; end if;
  select * into v_job from public.jobs where id = v_app.job_id for update;
  if v_job.umkm_id <> v_uid then raise exception 'Ini bukan lowongan kamu'; end if;
  if v_app.status <> 'accepted' then raise exception 'Lamaran tidak berstatus diterima'; end if;
  if v_app.checked_in_at is not null then raise exception 'Mahasiswa sudah check-in'; end if;
  if now() < v_job.start_at + interval '30 minutes' then
    raise exception 'Laporan tidak hadir baru bisa dibuat 30 menit setelah jam mulai';
  end if;

  select * into v_pay from public.payments
   where application_id = v_app.id and status = 'held' for update;
  if not found then raise exception 'Dana tidak ditemukan atau sudah diproses'; end if;

  update public.payments set status = 'refunded' where id = v_pay.id;
  update public.wallets
     set balance = balance + v_pay.amount + v_pay.commission, updated_at = now()
   where user_id = v_uid;
  insert into public.wallet_transactions (user_id, type, amount, status, application_id, note)
  values (v_uid, 'refund', v_pay.amount + v_pay.commission, 'success', v_app.id,
          'Refund: mahasiswa tidak hadir - ' || v_job.title);

  update public.profiles set no_show_count = no_show_count + 1 where id = v_app.student_id;

  perform set_config('labor2go.rpc', 'on', true);
  update public.applications set status = 'withdrawn' where id = v_app.id;

  if not exists (
    select 1 from public.applications
    where job_id = v_job.id and status = 'accepted'
  ) then
    update public.jobs set status = 'cancelled' where id = v_job.id;
  elsif not exists (
    select 1
    from public.applications a
    join public.payments p on p.application_id = a.id
    where a.job_id = v_job.id and a.status = 'accepted' and p.status <> 'released'
  ) then
    -- pekerja lain sudah selesai dan dibayar
    update public.jobs set status = 'completed' where id = v_job.id;
  end if;
end;
$$;

-- ---------- 6. Merchant batalkan lowongan -> refund 100% ----------
create or replace function public.cancel_job(p_job_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_pay record;
  v_total bigint := 0;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Lowongan tidak ditemukan'; end if;
  if v_job.umkm_id <> v_uid then raise exception 'Ini bukan lowongan kamu'; end if;
  if v_job.status not in ('open', 'filled') then
    raise exception 'Lowongan dengan status % tidak bisa dibatalkan', v_job.status;
  end if;
  if exists (
    select 1 from public.applications
    where job_id = v_job.id and checked_in_at is not null
  ) then
    raise exception 'Sudah ada pekerja yang mulai bekerja';
  end if;

  for v_pay in
    select p.id as pay_id, p.amount, p.commission, p.application_id
    from public.payments p
    join public.applications a on a.id = p.application_id
    where a.job_id = v_job.id and p.status = 'held'
    for update of p
  loop
    update public.payments set status = 'refunded' where id = v_pay.pay_id;
    insert into public.wallet_transactions (user_id, type, amount, status, application_id, note)
    values (v_uid, 'refund', v_pay.amount + v_pay.commission, 'success', v_pay.application_id,
            'Refund pembatalan: ' || v_job.title);
    v_total := v_total + v_pay.amount + v_pay.commission;
  end loop;

  if v_total > 0 then
    update public.wallets
       set balance = balance + v_total, updated_at = now()
     where user_id = v_uid;
  end if;

  perform set_config('labor2go.rpc', 'on', true);
  update public.applications set status = 'withdrawn' where job_id = v_job.id and status = 'accepted';
  update public.applications set status = 'rejected'  where job_id = v_job.id and status = 'pending';
  update public.jobs set status = 'cancelled' where id = v_job.id;
end;
$$;

-- ---------- Izin eksekusi ----------
revoke all on function public.check_in(uuid) from public, anon;
revoke all on function public.check_out(uuid) from public, anon;
revoke all on function public.confirm_completion(uuid) from public, anon;
revoke all on function public.report_no_show(uuid) from public, anon;
revoke all on function public.cancel_job(uuid) from public, anon;

grant execute on function public.check_in(uuid) to authenticated;
grant execute on function public.check_out(uuid) to authenticated;
grant execute on function public.confirm_completion(uuid) to authenticated;
grant execute on function public.report_no_show(uuid) to authenticated;
grant execute on function public.cancel_job(uuid) to authenticated;