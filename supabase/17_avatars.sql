-- ============================================================
-- Labor2Go - Foto profil (mahasiswa dan merchant)
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- ============================================================

-- Kolom foto profil (URL publik di bucket 'avatars'); bisa diubah user kapan saja
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_avatar_url_chk;
alter table public.profiles add constraint profiles_avatar_url_chk
  check (
    avatar_url is null
    or avatar_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-f-]{36}/[A-Za-z0-9._-]+(\?v=[0-9]+)?$'
  );

-- Izin kolom: boleh diubah sendiri, boleh dibaca (kolom phone tetap terkunci)
grant update (avatar_url) on public.profiles to authenticated;
grant select (avatar_url) on public.profiles to authenticated;

-- Bucket publik 'avatars' (maks 1 MB, hanya gambar). Aplikasi mengecilkan gambar sebelum upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Path file: <user_id>/avatar.<ext>; hanya pemilik folder yang boleh menulis, semua orang boleh membaca
drop policy if exists "avatars_read_all" on storage.objects;
create policy "avatars_read_all" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_upload_own" on storage.objects;
create policy "avatars_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);