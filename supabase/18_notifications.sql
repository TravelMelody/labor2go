-- ============================================================
-- Labor2Go - Notifikasi dalam aplikasi
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- Prasyarat: labor2go_chat.sql, labor2go_admin.sql sudah dijalankan.
-- ============================================================
-- Notifikasi dibuat OTOMATIS oleh trigger database saat kejadian terjadi, sehingga tidak bisa
-- dipalsukan atau terlewat. Client hanya boleh membaca notifikasi miliknya dan menandainya dibaca.

-- ---------- 1. Tabel ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Realtime untuk lonceng notifikasi (abaikan jika sudah terdaftar)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ---------- 2. Fungsi bantu (internal, tidak bisa dipanggil client) ----------
create or replace function public.first_name(p_user uuid)
returns text
language sql stable
security definer set search_path = public
as $$
  select coalesce(nullif(split_part(coalesce(full_name, ''), ' ', 1), ''), 'Seseorang')
  from public.profiles where id = p_user;
$$;

create or replace function public.rupiah_text(p_amount bigint)
returns text
language sql immutable
as $$
  select 'Rp ' || replace(to_char(p_amount, 'FM999,999,999,999'), ',', '.');
$$;

create or replace function public.push_notification(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_ref uuid default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link, ref_id)
  values (p_user, p_type, p_title, p_body, p_link, p_ref);

  -- simpan maksimal 100 notifikasi terbaru per pengguna
  delete from public.notifications
   where user_id = p_user
     and id not in (
       select id from public.notifications
       where user_id = p_user order by created_at desc limit 100
     );
end;
$$;

revoke all on function public.first_name(uuid) from public, anon, authenticated;
revoke all on function public.push_notification(uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.rupiah_text(bigint) to authenticated;

-- ---------- 3. Tandai dibaca (satu, beberapa, atau semua) ----------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any(p_ids));
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Membuka percakapan juga menandai notifikasi chat-nya sebagai dibaca
create or replace function public.mark_thread_read(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.messages
     set read_at = now()
   where application_id = p_application_id
     and receiver_id = auth.uid()
     and read_at is null;

  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and type = 'chat_message'
     and ref_id = p_application_id
     and read_at is null;
end;
$$;

-- ---------- 4. Perbaikan: mahasiswa tidak boleh membatalkan sendiri setelah DITERIMA ----------
-- (Kalau dibolehkan, dana merchant yang sudah ditahan akan menggantung.)
create or replace function public.block_accepted_withdraw()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status = 'accepted' and new.status = 'withdrawn'
     and auth.uid() is not null
     and auth.uid() = old.student_id
     and current_setting('labor2go.rpc', true) is distinct from 'on' then
    raise exception 'Pekerjaan yang sudah diterima tidak bisa dibatalkan sendiri. Hubungi merchant lewat chat.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_accepted_withdraw on public.applications;
create trigger trg_block_accepted_withdraw
  before update on public.applications
  for each row execute function public.block_accepted_withdraw();

-- ---------- 5. Trigger: chat ----------
create or replace function public.trg_notify_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_existing uuid;
  v_title text;
  v_snip text := left(new.body, 80);
begin
  if new.application_id is null then return new; end if;
  v_title := 'Pesan baru dari ' || public.first_name(new.sender_id);

  -- Satu notifikasi belum-dibaca per percakapan (diperbarui, bukan dibanjiri)
  select id into v_existing
  from public.notifications
  where user_id = new.receiver_id and type = 'chat_message'
    and ref_id = new.application_id and read_at is null
  limit 1;

  if v_existing is not null then
    update public.notifications
       set title = v_title, body = v_snip, created_at = now()
     where id = v_existing;
  else
    perform public.push_notification(new.receiver_id, 'chat_message', v_title, v_snip,
                                     '/chat/' || new.application_id, new.application_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message
  after insert on public.messages
  for each row execute function public.trg_notify_message();

-- ---------- 6. Trigger: lamaran masuk ----------
create or replace function public.trg_notify_application_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id = new.job_id;
  perform public.push_notification(
    v_job.umkm_id, 'new_applicant', 'Pelamar baru',
    public.first_name(new.student_id) || ' melamar "' || v_job.title || '"',
    '/merchant/jobs/' || new.job_id, new.id);
  return new;
end;
$$;

drop trigger if exists trg_notify_application_insert on public.applications;
create trigger trg_notify_application_insert
  after insert on public.applications
  for each row execute function public.trg_notify_application_insert();

-- ---------- 7. Trigger: perubahan lamaran (diterima, ditolak, dibatalkan, check-in/out) ----------
create or replace function public.trg_notify_application_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_is_cancel_job boolean;
  v_is_no_show boolean;
  v_name text;
  v_body text;
begin
  select * into v_job from public.jobs where id = new.job_id;
  v_name := public.first_name(new.student_id);
  v_is_cancel_job := (v_job.status = 'cancelled') or (current_query() ilike '%cancel_job%');
  v_is_no_show := (current_query() ilike '%report_no_show%');

  if new.status is distinct from old.status then
    if old.status = 'withdrawn' and new.status = 'pending' then
      perform public.push_notification(
        v_job.umkm_id, 'new_applicant', 'Pelamar baru',
        v_name || ' melamar kembali "' || v_job.title || '"',
        '/merchant/jobs/' || new.job_id, new.id);

    elsif old.status = 'pending' and new.status = 'accepted' then
      perform public.push_notification(
        new.student_id, 'application_accepted', 'Lamaran diterima',
        'Kamu diterima untuk "' || v_job.title || '". Buka chat untuk berkoordinasi.',
        '/student/activity', new.id);

    elsif old.status = 'pending' and new.status = 'rejected' then
      v_body := case
        when v_is_cancel_job then 'Lowongan "' || v_job.title || '" dibatalkan oleh merchant.'
        when v_job.status = 'filled' then 'Lowongan "' || v_job.title || '" sudah terisi pekerja lain.'
        else 'Lamaranmu untuk "' || v_job.title || '" tidak dipilih.' end;
      perform public.push_notification(
        new.student_id, 'application_rejected', 'Lamaran tidak dipilih', v_body,
        '/student/activity', new.id);

    elsif old.status = 'accepted' and new.status = 'withdrawn' then
      if v_is_no_show then
        perform public.push_notification(
          new.student_id, 'reported_no_show', 'Kamu dilaporkan tidak hadir',
          'Merchant melaporkan ketidakhadiranmu pada "' || v_job.title || '". Ini tercatat di profilmu.',
          '/student/activity', new.id);
      else
        perform public.push_notification(
          new.student_id, 'job_cancelled', 'Pekerjaan dibatalkan',
          'Merchant membatalkan "' || v_job.title || '".',
          '/student/activity', new.id);
      end if;
    end if;
  end if;

  if new.checked_in_at is not null and old.checked_in_at is null then
    perform public.push_notification(
      v_job.umkm_id, 'check_in', v_name || ' sudah check-in',
      '"' || v_job.title || '"', '/merchant/jobs/' || new.job_id, new.id);
  end if;

  if new.checked_out_at is not null and old.checked_out_at is null then
    perform public.push_notification(
      v_job.umkm_id, 'check_out', v_name || ' selesai bekerja',
      'Konfirmasi selesai untuk mencairkan upah "' || v_job.title || '".',
      '/merchant/jobs/' || new.job_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_application_update on public.applications;
create trigger trg_notify_application_update
  after update on public.applications
  for each row execute function public.trg_notify_application_update();

-- ---------- 8. Trigger: uang (upah cair, refund, top-up, penarikan) ----------
create or replace function public.trg_notify_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into v_app from public.applications where id = new.application_id;
  select * into v_job from public.jobs where id = v_app.job_id;

  if new.status = 'released' then
    perform public.push_notification(
      v_app.student_id, 'payment_released', 'Upah dicairkan',
      public.rupiah_text(new.amount) || ' dari "' || v_job.title || '" masuk ke dompetmu.',
      '/student/wallet', new.application_id);
  elsif new.status = 'refunded' then
    perform public.push_notification(
      v_job.umkm_id, 'refund', 'Dana dikembalikan',
      public.rupiah_text(new.amount + new.commission) || ' untuk "' || v_job.title || '" kembali ke saldomu.',
      '/merchant/wallet', new.application_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_payment on public.payments;
create trigger trg_notify_payment
  after update on public.payments
  for each row execute function public.trg_notify_payment();

create or replace function public.trg_notify_topup()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.type = 'topup' and new.status = 'success' and old.status is distinct from 'success' then
    perform public.push_notification(
      new.user_id, 'topup_success', 'Saldo bertambah',
      'Isi saldo ' || public.rupiah_text(new.amount) || ' berhasil.', '/merchant/wallet', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_topup on public.wallet_transactions;
create trigger trg_notify_topup
  after update on public.wallet_transactions
  for each row execute function public.trg_notify_topup();

create or replace function public.trg_notify_withdrawal()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'processed' then
    perform public.push_notification(
      new.user_id, 'withdrawal_processed', 'Penarikan diproses',
      public.rupiah_text(new.amount) || ' ke ' || upper(new.destination_type) || ' telah ditransfer.',
      '/student/wallet', new.id);
  elsif new.status = 'rejected' then
    perform public.push_notification(
      new.user_id, 'withdrawal_rejected', 'Penarikan ditolak',
      'Penarikan ' || public.rupiah_text(new.amount) || ' ditolak, saldo dikembalikan.',
      '/student/wallet', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_withdrawal on public.withdrawals;
create trigger trg_notify_withdrawal
  after update on public.withdrawals
  for each row execute function public.trg_notify_withdrawal();

-- ---------- 9. Trigger: ulasan dan verifikasi ----------
create or replace function public.trg_notify_review()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = new.reviewee_id;
  perform public.push_notification(
    new.reviewee_id, 'review_received', 'Ulasan baru',
    public.first_name(new.reviewer_id) || ' memberimu ' || new.rating || ' bintang.',
    case when v_role = 'umkm' then '/merchant/account' else '/student/account' end,
    new.id);
  return new;
end;
$$;

drop trigger if exists trg_notify_review on public.reviews;
create trigger trg_notify_review
  after insert on public.reviews
  for each row execute function public.trg_notify_review();

create or replace function public.trg_notify_verification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_link text := case when new.role = 'umkm' then '/merchant/account/verification'
                      else '/student/account/verification' end;
begin
  if new.verification_status = 'approved' then
    perform public.push_notification(new.id, 'verification_approved', 'Akun terverifikasi',
      'Selamat, akunmu sudah diverifikasi admin.', v_link, new.id);
  elsif new.verification_status = 'rejected' then
    perform public.push_notification(new.id, 'verification_rejected', 'Verifikasi ditolak',
      coalesce(new.verification_note, 'Silakan perbaiki data dan ajukan ulang.'), v_link, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_verification on public.profiles;
create trigger trg_notify_verification
  after update of verification_status on public.profiles
  for each row
  when (old.verification_status is distinct from new.verification_status)
  execute function public.trg_notify_verification();