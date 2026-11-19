-- ============================================================
-- Labor2Go - Storage untuk upload KTM dan foto usaha
-- Jalankan di Supabase: SQL Editor > New query > paste > Run
-- ============================================================

-- Bucket:
--   ktm             -> PRIVAT (data sensitif; hanya pemilik dan admin yang boleh lihat)
--   business-photos -> PUBLIK (foto usaha boleh dilihat siapa saja)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('ktm', 'ktm', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('business-photos', 'business-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Aturan path file: <user_id>/<namafile>
-- Contoh: 3f2a...-uuid/ktm.jpg  -> hanya user dengan id tsb yang boleh upload ke folder itu.

-- ---------- KTM (privat) ----------
create policy "ktm_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ktm' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ktm_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'ktm' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ktm_read_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ktm' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- ---------- Foto usaha (publik baca, tulis hanya folder sendiri) ----------
create policy "bizphoto_read_all" on storage.objects
  for select to public
  using (bucket_id = 'business-photos');

create policy "bizphoto_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "bizphoto_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'business-photos' and (storage.foldername(name))[1] = auth.uid()::text);