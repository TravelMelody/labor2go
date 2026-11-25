-- ============================================================
-- Labor2Go - Dashboard admin: verifikasi, audit log, statistik
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- Prasyarat: labor2go_wallet_ops.sql dan labor2go_reviews.sql sudah dijalankan.
-- ============================================================

-- ---------- 1. Status verifikasi di profiles ----------
-- 'verified' (boolean) tetap dipakai UI yang sudah ada; verification_status menyimpan detailnya.
alter table public.profiles
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_note text;

alter table public.profiles drop constraint if exists profiles_verification_status_check;
alter table public.profiles
  add constraint profiles_verification_status_check
  check (verification_status in ('pending', 'approved', 'rejected'));

update public.profiles set verification_status = 'approved'
 where verified and verification_status = 'pending';

-- (Kolom baru ini tidak bisa diubah user: izin UPDATE profiles hanya untuk full_name & phone.)

-- ---------- 2. Jejak audit tindakan admin ----------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
drop policy if exists "audit_read_admin" on public.admin_audit_log;
create policy "audit_read_admin" on public.admin_audit_log
  for select to authenticated using (public.is_admin());
grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;

-- ---------- 3. Admin boleh membaca semua permintaan penarikan ----------
drop policy if exists "withdrawals_read_admin" on public.withdrawals;
create policy "withdrawals_read_admin" on public.withdrawals
  for select to authenticated using (public.is_admin());

-- ---------- 4. Setujui / tolak verifikasi ----------
create or replace function public.admin_set_verification(
  p_user_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat memverifikasi';
  end if;

  select role into v_role from public.profiles where id = p_user_id;
  if not found then raise exception 'Pengguna tidak ditemukan'; end if;
  if v_role = 'admin' then raise exception 'Akun admin tidak perlu diverifikasi'; end if;

  if v_role = 'student' and not exists (select 1 from public.student_profiles where id = p_user_id) then
    raise exception 'Mahasiswa ini belum melengkapi profil';
  end if;
  if v_role = 'umkm' and not exists (select 1 from public.umkm_profiles where id = p_user_id) then
    raise exception 'Merchant ini belum melengkapi profil';
  end if;

  if not p_approve and (v_note is null or char_length(v_note) < 5) then
    raise exception 'Alasan penolakan wajib diisi (minimal 5 karakter)';
  end if;

  update public.profiles
     set verified = p_approve,
         verification_status = case when p_approve then 'approved' else 'rejected' end,
         verification_note = case when p_approve then null else v_note end
   where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_id, note)
  values (auth.uid(),
          case when p_approve then 'verification_approved' else 'verification_rejected' end,
          p_user_id, v_note);
end;
$$;

-- ---------- 5. Proses penarikan (versi dengan audit log) ----------
create or replace function public.resolve_withdrawal(p_withdrawal_id uuid, p_approve boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_w public.withdrawals%rowtype;
begin
  if not (auth.uid() is null or public.is_admin()) then
    raise exception 'Hanya admin yang dapat memproses penarikan';
  end if;

  select * into v_w from public.withdrawals where id = p_withdrawal_id for update;
  if not found then raise exception 'Penarikan tidak ditemukan'; end if;
  if v_w.status <> 'pending' then raise exception 'Penarikan sudah diproses'; end if;

  if p_approve then
    update public.withdrawals set status = 'processed', processed_at = now() where id = v_w.id;
    update public.wallet_transactions set status = 'success'
     where external_ref = v_w.id::text and type = 'withdrawal';
  else
    update public.withdrawals set status = 'rejected', processed_at = now() where id = v_w.id;
    update public.wallet_transactions set status = 'failed'
     where external_ref = v_w.id::text and type = 'withdrawal';
    update public.wallets
       set balance = balance + v_w.amount, updated_at = now()
     where user_id = v_w.user_id;
    insert into public.wallet_transactions (user_id, type, amount, status, external_ref, note)
    values (v_w.user_id, 'refund', v_w.amount, 'success', v_w.id::text,
            'Penarikan ditolak, saldo dikembalikan');
  end if;

  insert into public.admin_audit_log (admin_id, action, target_id, note)
  values (auth.uid(),
          case when p_approve then 'withdrawal_processed' else 'withdrawal_rejected' end,
          v_w.id,
          'Rp ' || v_w.amount || ' ke ' || upper(v_w.destination_type));
end;
$$;

-- ---------- 6. Statistik ringkasan untuk dashboard ----------
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;

  return jsonb_build_object(
    'students',            (select count(*) from public.profiles where role = 'student'),
    'merchants',           (select count(*) from public.profiles where role = 'umkm'),
    'pending_verification',(select count(*) from public.profiles
                             where role in ('student', 'umkm') and verification_status = 'pending'
                               and (exists (select 1 from public.student_profiles s where s.id = profiles.id)
                                 or exists (select 1 from public.umkm_profiles u where u.id = profiles.id))),
    'verified_users',      (select count(*) from public.profiles where verified),
    'jobs_open',           (select count(*) from public.jobs where status = 'open'),
    'jobs_in_progress',    (select count(*) from public.jobs where status in ('filled', 'in_progress')),
    'jobs_completed',      (select count(*) from public.jobs where status = 'completed'),
    'jobs_cancelled',      (select count(*) from public.jobs where status = 'cancelled'),
    'escrow_held',         (select coalesce(sum(amount + commission), 0) from public.payments where status = 'held'),
    'paid_to_workers',     (select coalesce(sum(amount), 0) from public.payments where status = 'released'),
    'platform_revenue',    (select coalesce(sum(commission), 0) from public.payments where status = 'released'),
    'pending_withdrawals', (select count(*) from public.withdrawals where status = 'pending'),
    'pending_withdrawal_amount', (select coalesce(sum(amount), 0) from public.withdrawals where status = 'pending'),
    'no_shows',            (select coalesce(sum(no_show_count), 0) from public.profiles),
    'reviews',             (select count(*) from public.reviews),
    'avg_rating',          (select round(avg(rating)::numeric, 2) from public.reviews)
  );
end;
$$;

-- ---------- Izin eksekusi ----------
revoke all on function public.admin_set_verification(uuid, boolean, text) from public, anon;
revoke all on function public.admin_stats() from public, anon;
revoke all on function public.resolve_withdrawal(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verification(uuid, boolean, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.resolve_withdrawal(uuid, boolean) to authenticated, service_role;