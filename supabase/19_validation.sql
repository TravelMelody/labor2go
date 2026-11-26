-- ============================================================
-- Labor2Go - Validasi input di level database
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- ============================================================
-- Kenapa di database? Validasi di tampilan bisa dilewati lewat API. Aturan di sini berlaku untuk semua jalur.
-- Constraint dibuat NOT VALID: hanya memeriksa data BARU/yang diubah. Data uji lama yang berisi simbol
-- tidak menghalangi pembuatan constraint, tetapi baris lama itu tidak bisa di-update sampai dibenahi.
-- (Jalankan labor2go_demo_reset.sql sebelum rilis untuk membersihkan data uji lama.)

-- ---------- Fungsi validasi (immutable) ----------
-- Nama orang: huruf (termasuk huruf beraksara/aksen), spasi, titik, apostrof, tanda hubung. 2-60 karakter.
create or replace function public.is_valid_person_name(p text)
returns boolean language sql immutable as $$
  select p ~ '^[[:alpha:]][[:alpha:] .''-]{1,59}$';
$$;

-- Daftar skill: maks 10, tiap skill 2-30 karakter, diawali huruf, boleh huruf/angka/spasi dan + / & . -
create or replace function public.are_valid_skills(p text[])
returns boolean language sql immutable as $$
  select p is null or (
    coalesce(array_length(p, 1), 0) <= 10
    and not exists (
      select 1 from unnest(p) s
      where s is null or s !~ '^[[:alpha:]][[:alnum:] +/&.-]{1,29}$'
    )
  );
$$;

-- ---------- profiles ----------
alter table public.profiles drop constraint if exists profiles_full_name_chk;
alter table public.profiles add constraint profiles_full_name_chk
  check (full_name is null or public.is_valid_person_name(full_name)) not valid;

-- Nomor HP/WhatsApp Indonesia: 08xx..., 628xx..., atau +628xx... (10-13 digit)
alter table public.profiles drop constraint if exists profiles_phone_chk;
alter table public.profiles add constraint profiles_phone_chk
  check (phone is null or phone ~ '^(\+?62|0)8[0-9]{8,11}$') not valid;

-- ---------- student_profiles ----------
alter table public.student_profiles drop constraint if exists student_nim_chk;
alter table public.student_profiles add constraint student_nim_chk
  check (nim is null or nim ~ '^[0-9]{6,20}$') not valid;

alter table public.student_profiles drop constraint if exists student_university_chk;
alter table public.student_profiles add constraint student_university_chk
  check (university is null or university ~ '^[[:alpha:]][[:alnum:] .,&()''-]{2,79}$') not valid;

alter table public.student_profiles drop constraint if exists student_skills_chk;
alter table public.student_profiles add constraint student_skills_chk
  check (public.are_valid_skills(skills)) not valid;

-- ---------- umkm_profiles ----------
alter table public.umkm_profiles drop constraint if exists umkm_business_name_chk;
alter table public.umkm_profiles add constraint umkm_business_name_chk
  check (business_name ~ '^[[:alnum:]][[:alnum:] .,&()''-]{1,59}$') not valid;

alter table public.umkm_profiles drop constraint if exists umkm_business_type_chk;
alter table public.umkm_profiles add constraint umkm_business_type_chk
  check (business_type is null or business_type in ('F&B', 'Retail', 'Event', 'Jasa', 'Lainnya')) not valid;

alter table public.umkm_profiles drop constraint if exists umkm_address_chk;
alter table public.umkm_profiles add constraint umkm_address_chk
  check (address is null or address ~ '^[[:alnum:]][[:alnum:] .,/():''-]{4,199}$') not valid;

-- ---------- jobs & job_templates ----------
alter table public.jobs drop constraint if exists jobs_title_chk;
alter table public.jobs add constraint jobs_title_chk
  check (title ~ '^[[:alnum:]][[:alnum:] .,&()/''-]{2,59}$') not valid;

alter table public.jobs drop constraint if exists jobs_description_chk;
alter table public.jobs add constraint jobs_description_chk
  check (description is null or (char_length(description) <= 500
         and description !~ '[\x01-\x08\x0B\x0C\x0E-\x1F]')) not valid;

alter table public.jobs drop constraint if exists jobs_location_chk;
alter table public.jobs add constraint jobs_location_chk
  check (location_name is null or location_name ~ '^[[:alnum:]][[:alnum:] .,/():''-]{4,199}$') not valid;

alter table public.job_templates drop constraint if exists templates_title_chk;
alter table public.job_templates add constraint templates_title_chk
  check (title ~ '^[[:alnum:]][[:alnum:] .,&()/''-]{2,59}$') not valid;

alter table public.job_templates drop constraint if exists templates_description_chk;
alter table public.job_templates add constraint templates_description_chk
  check (description is null or (char_length(description) <= 500
         and description !~ '[\x01-\x08\x0B\x0C\x0E-\x1F]')) not valid;

-- ---------- withdrawals: nomor tujuan hanya angka ----------
alter table public.withdrawals drop constraint if exists withdrawals_account_chk;
alter table public.withdrawals add constraint withdrawals_account_chk
  check (destination_account ~ '^[0-9]{5,20}$') not valid;

-- ---------- Signup tidak boleh gagal karena nama bersimbol ----------
-- Jika nama dari metadata tidak valid, simpan kosong (user mengisinya saat onboarding).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
begin
  if v_name is not null and not public.is_valid_person_name(v_name) then
    v_name := null;
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    case when new.raw_user_meta_data->>'role' in ('umkm', 'student')
         then (new.raw_user_meta_data->>'role')::public.user_role
         else 'student' end,
    v_name
  );
  return new;
end;
$$;
