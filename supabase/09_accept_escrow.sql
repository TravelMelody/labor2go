-- ============================================================
-- Labor2Go - Terima pelamar + escrow (dana ditahan) secara atomik
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- Prasyarat: schema, wallet, grants, rls_recursion fix, applications_guard sudah dijalankan.
-- ============================================================

-- ---------- 1. Pengaturan platform (biaya layanan disimpan di DB, bukan di browser) ----------
create table if not exists public.platform_settings (
  key text primary key,
  int_value bigint not null
);

alter table public.platform_settings enable row level security;

drop policy if exists "settings_read" on public.platform_settings;
create policy "settings_read" on public.platform_settings
  for select to authenticated using (true);

grant select on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;

insert into public.platform_settings (key, int_value)
values ('service_fee_per_worker', 5000)
on conflict (key) do nothing;

-- ---------- 2. accept_application: satu transaksi, semua-atau-tidak-sama-sekali ----------
create or replace function public.accept_application(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_fee bigint;
  v_total bigint;
  v_balance bigint;
  v_accepted int;
begin
  if v_uid is null then
    raise exception 'Kamu harus login';
  end if;

  -- Kunci baris lamaran dan lowongan supaya dua klik bersamaan tidak memotong saldo dua kali
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'Lamaran tidak ditemukan';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id for update;
  if v_job.umkm_id <> v_uid then
    raise exception 'Ini bukan lowongan kamu';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Lamaran ini sudah diproses';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Lowongan sudah tidak terbuka';
  end if;
  if v_job.start_at <= now() then
    raise exception 'Lowongan sudah melewati jam mulai';
  end if;

  select count(*) into v_accepted
  from public.applications
  where job_id = v_job.id and status = 'accepted';
  if v_accepted >= v_job.slots then
    raise exception 'Slot lowongan sudah penuh';
  end if;

  select int_value into v_fee from public.platform_settings where key = 'service_fee_per_worker';
  v_fee := coalesce(v_fee, 0);
  v_total := v_job.pay_amount + v_fee;

  select balance into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance is null then
    raise exception 'Dompet tidak ditemukan';
  end if;
  if v_balance < v_total then
    raise exception 'Saldo tidak cukup. Dibutuhkan Rp % (upah + biaya layanan), saldo kamu Rp %', v_total, v_balance;
  end if;

  -- Potong saldo merchant
  update public.wallets
     set balance = balance - v_total, updated_at = now()
   where user_id = v_uid;

  -- Catat mutasi dompet
  insert into public.wallet_transactions (user_id, type, amount, status, application_id, note)
  values (v_uid, 'job_payment', v_total, 'success', v_app.id,
          'Dana ditahan (escrow): ' || v_job.title);

  -- Dana ditahan platform: amount = upah mahasiswa, commission = biaya layanan
  insert into public.payments (application_id, amount, commission, status)
  values (v_app.id, v_job.pay_amount, v_fee, 'held');

  update public.applications set status = 'accepted' where id = v_app.id;

  -- Slot penuh: tutup lowongan dan tolak sisa pelamar yang masih pending
  if v_accepted + 1 >= v_job.slots then
    update public.jobs set status = 'filled' where id = v_job.id;
    update public.applications
       set status = 'rejected'
     where job_id = v_job.id and status = 'pending';
  end if;
end;
$$;

revoke all on function public.accept_application(uuid) from public, anon;
grant execute on function public.accept_application(uuid) to authenticated;

-- ---------- 3. Privasi: data detail mahasiswa (termasuk NIM) tidak lagi terbuka untuk semua ----------
create or replace function public.is_my_applicant(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.student_id = p_student_id and j.umkm_id = auth.uid()
  );
$$;

grant execute on function public.is_my_applicant(uuid) to authenticated;

drop policy if exists "student_profiles_read" on public.student_profiles;
create policy "student_profiles_read" on public.student_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_my_applicant(id) or public.is_admin());
  