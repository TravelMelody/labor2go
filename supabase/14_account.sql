-- ============================================================
-- Labor2Go - Akun/Profil: ajukan ulang verifikasi + kunci data identitas
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- Prasyarat: labor2go_admin.sql sudah dijalankan.
-- ============================================================

-- ---------- 1. Ajukan ulang verifikasi (hanya untuk akun yang ditolak) ----------
-- Alur: user memperbaiki data/foto -> memanggil fungsi ini -> status kembali 'pending'.
create or replace function public.request_reverification()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;

  select verification_status, role into v_status, v_role
  from public.profiles where id = v_uid;

  if v_role not in ('student', 'umkm') then
    raise exception 'Akun ini tidak memerlukan verifikasi';
  end if;
  if v_status <> 'rejected' then
    raise exception 'Pengajuan ulang hanya untuk akun yang verifikasinya ditolak';
  end if;

  update public.profiles
     set verification_status = 'pending', verification_note = null, verified = false
   where id = v_uid;

  insert into public.admin_audit_log (admin_id, action, target_id, note)
  values (null, 'verification_resubmitted', v_uid, null);
end;
$$;

revoke all on function public.request_reverification() from public, anon;
grant execute on function public.request_reverification() to authenticated;

-- ---------- 2. Kunci data identitas setelah akun terverifikasi ----------
-- Setelah admin menyetujui, nama, NIM, kampus, foto KTM (mahasiswa) serta nama usaha dan
-- foto usaha (merchant) tidak boleh diubah sendiri. Admin dan server tetap boleh.
create or replace function public.is_verified_user(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select verified from public.profiles where id = p_user_id), false);
$$;

create or replace function public.lock_profile_identity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if old.verified and new.full_name is distinct from old.full_name then
    raise exception 'Nama tidak bisa diubah setelah akun terverifikasi. Hubungi admin.';
  end if;
  return new;
end;
$$;

create or replace function public.lock_student_identity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if public.is_verified_user(old.id)
     and (new.nim is distinct from old.nim
          or new.ktm_url is distinct from old.ktm_url
          or new.university is distinct from old.university) then
    raise exception 'NIM, kampus, dan foto KTM tidak bisa diubah setelah akun terverifikasi. Hubungi admin.';
  end if;
  return new;
end;
$$;

create or replace function public.lock_umkm_identity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if public.is_verified_user(old.id)
     and (new.business_name is distinct from old.business_name
          or new.photo_url is distinct from old.photo_url) then
    raise exception 'Nama usaha dan foto usaha tidak bisa diubah setelah akun terverifikasi. Hubungi admin.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_profile_identity on public.profiles;
create trigger trg_lock_profile_identity
  before update on public.profiles
  for each row execute function public.lock_profile_identity();

drop trigger if exists trg_lock_student_identity on public.student_profiles;
create trigger trg_lock_student_identity
  before update on public.student_profiles
  for each row execute function public.lock_student_identity();

drop trigger if exists trg_lock_umkm_identity on public.umkm_profiles;
create trigger trg_lock_umkm_identity
  before update on public.umkm_profiles
  for each row execute function public.lock_umkm_identity();
