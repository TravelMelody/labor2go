-- ============================================================
-- Labor2Go - Chat dalam aplikasi + akses kontak terkontrol
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- Prasyarat: labor2go_account.sql sudah dijalankan.
-- File ini AMAN dijalankan sekarang (tidak merusak kode yang ada).
-- ============================================================

-- ---------- 1. Struktur pesan ----------
alter table public.messages
  add column if not exists application_id uuid references public.applications(id) on delete cascade,
  add column if not exists read_at timestamptz;

create index if not exists messages_application_idx on public.messages (application_id, created_at);
create index if not exists messages_unread_idx on public.messages (receiver_id) where read_at is null;

-- Pesan hanya boleh dikirim/diubah lewat fungsi di bawah (bukan langsung dari client)
drop policy if exists "messages_insert_own" on public.messages;
revoke insert, update, delete on public.messages from authenticated;
-- (SELECT tetap: pengirim dan penerima saja, lewat policy "messages_read")

-- ---------- 2. Kirim pesan ----------
-- Chat hanya terbuka untuk lamaran yang sudah DITERIMA, antar dua pihak pekerjaan itu.
create or replace function public.send_message(p_application_id uuid, p_body text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_to uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_app from public.applications where id = p_application_id;
  if not found then raise exception 'Percakapan tidak ditemukan'; end if;
  select * into v_job from public.jobs where id = v_app.job_id;

  if v_uid = v_app.student_id then
    v_to := v_job.umkm_id;
  elsif v_uid = v_job.umkm_id then
    v_to := v_app.student_id;
  else
    raise exception 'Kamu tidak terlibat dalam percakapan ini';
  end if;

  if v_app.status <> 'accepted' then
    raise exception 'Chat hanya tersedia setelah lamaran diterima';
  end if;
  if char_length(v_body) < 1 then raise exception 'Pesan tidak boleh kosong'; end if;
  if char_length(v_body) > 1000 then raise exception 'Pesan maksimal 1000 karakter'; end if;

  if (select count(*) from public.messages
       where sender_id = v_uid and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Terlalu banyak pesan, tunggu sebentar';
  end if;

  insert into public.messages (job_id, application_id, sender_id, receiver_id, body)
  values (v_job.id, v_app.id, v_uid, v_to, v_body)
  returning id into v_id;

  return v_id;
end;
$$;

-- Tandai pesan masuk pada satu percakapan sebagai sudah dibaca
create or replace function public.mark_thread_read(p_application_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.messages
     set read_at = now()
   where application_id = p_application_id
     and receiver_id = auth.uid()
     and read_at is null;
$$;

-- ---------- 3. Akses nomor HP yang terkontrol ----------
-- Nomor HP milik sendiri
create or replace function public.get_my_phone()
returns text
language sql stable
security definer set search_path = public
as $$
  select phone from public.profiles where id = auth.uid();
$$;

-- Nomor HP lawan pekerjaan: hanya jika lamaran sudah diterima dan kamu terlibat
create or replace function public.get_counterpart_contact(p_application_id uuid)
returns table (full_name text, phone text)
language plpgsql stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_other uuid;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select * into v_app from public.applications where id = p_application_id;
  if not found then raise exception 'Pekerjaan tidak ditemukan'; end if;
  select * into v_job from public.jobs where id = v_app.job_id;

  if v_uid = v_app.student_id then
    v_other := v_job.umkm_id;
  elsif v_uid = v_job.umkm_id then
    v_other := v_app.student_id;
  else
    raise exception 'Kamu tidak terlibat dalam pekerjaan ini';
  end if;

  if v_app.status <> 'accepted' then
    raise exception 'Kontak baru tersedia setelah lamaran diterima';
  end if;

  return query select p.full_name, p.phone from public.profiles p where p.id = v_other;
end;
$$;

-- Admin melihat nomor HP saat verifikasi (tercatat di audit log)
create or replace function public.admin_get_phone(p_user_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_phone text;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  select phone into v_phone from public.profiles where id = p_user_id;
  insert into public.admin_audit_log (admin_id, action, target_id, note)
  values (auth.uid(), 'phone_viewed', p_user_id, null);
  return v_phone;
end;
$$;

-- ---------- Izin eksekusi ----------
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.mark_thread_read(uuid) from public, anon;
revoke all on function public.get_my_phone() from public, anon;
revoke all on function public.get_counterpart_contact(uuid) from public, anon;
revoke all on function public.admin_get_phone(uuid) from public, anon;

grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.get_my_phone() to authenticated;
grant execute on function public.get_counterpart_contact(uuid) to authenticated;
grant execute on function public.admin_get_phone(uuid) to authenticated;