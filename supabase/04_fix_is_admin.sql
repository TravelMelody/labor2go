create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "ktm_read_own_or_admin" on storage.objects;
create policy "ktm_read_own_or_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'ktm' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
  ));