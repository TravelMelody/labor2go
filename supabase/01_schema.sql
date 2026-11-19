-- ============================================================
-- Labor2Go - Schema awal (Supabase / PostgreSQL)
-- Cara pakai: Supabase Dashboard > SQL Editor > New query > paste > Run
-- ============================================================

-- ---------- ENUM ----------
create type user_role as enum ('umkm', 'student', 'admin');
create type job_status as enum ('open', 'filled', 'in_progress', 'completed', 'cancelled');
create type application_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type payment_status as enum ('pending', 'held', 'released', 'refunded');

-- ---------- TABEL ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  full_name text,
  phone text,
  verified boolean not null default false,
  no_show_count int not null default 0,
  created_at timestamptz not null default now()
);

create table umkm_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  business_name text not null,
  business_type text,            -- misal: F&B, Event Organizer
  address text,
  lat double precision,
  lng double precision,
  photo_url text
);

create table student_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  nim text,
  university text default 'Universitas Negeri Semarang',
  skills text[] default '{}',
  ktm_url text
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  umkm_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  location_name text,
  lat double precision,
  lng double precision,
  start_at timestamptz not null,
  end_at timestamptz not null,
  pay_amount int not null check (pay_amount > 0),   -- rupiah per orang
  slots int not null default 1 check (slots > 0),
  status job_status not null default 'open',
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  status application_status not null default 'pending',
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, student_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  amount int not null,
  commission int not null default 0,
  status payment_status not null default 'pending',
  midtrans_order_id text,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  reviewee_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (job_id, reviewer_id, reviewee_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on jobs (status, start_at);
create index on applications (student_id);
create index on messages (job_id, created_at);

-- ---------- AUTO-BUAT PROFIL SAAT SIGNUP ----------
-- Role hanya boleh 'umkm' atau 'student' dari form daftar (admin diset manual).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, role, full_name)
  values (
    new.id,
    case when new.raw_user_meta_data->>'role' in ('umkm', 'student')
         then (new.raw_user_meta_data->>'role')::user_role
         else 'student' end,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- ROW LEVEL SECURITY ----------
alter table profiles enable row level security;
alter table umkm_profiles enable row level security;
alter table student_profiles enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table payments enable row level security;
alter table reviews enable row level security;
alter table messages enable row level security;

-- profiles: user biasa hanya boleh ubah nama & no HP (role/verified hanya admin/service role)
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;

create policy "profiles_read" on profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on profiles
  for update to authenticated using (id = auth.uid());

create policy "umkm_profiles_read" on umkm_profiles
  for select to authenticated using (true);
create policy "umkm_profiles_write_own" on umkm_profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "student_profiles_read" on student_profiles
  for select to authenticated using (true);
create policy "student_profiles_write_own" on student_profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- jobs: semua user login bisa lihat job yang open; UMKM kelola job miliknya
create policy "jobs_read" on jobs
  for select to authenticated
  using (status = 'open' or umkm_id = auth.uid()
         or exists (select 1 from applications a
                    where a.job_id = jobs.id and a.student_id = auth.uid()));
create policy "jobs_insert_own" on jobs
  for insert to authenticated with check (umkm_id = auth.uid());
create policy "jobs_update_own" on jobs
  for update to authenticated using (umkm_id = auth.uid());

-- applications: mahasiswa melamar sendiri; pemilik job melihat & memutuskan
create policy "applications_read" on applications
  for select to authenticated
  using (student_id = auth.uid()
         or exists (select 1 from jobs j where j.id = job_id and j.umkm_id = auth.uid()));
create policy "applications_insert_own" on applications
  for insert to authenticated with check (student_id = auth.uid());
create policy "applications_update" on applications
  for update to authenticated
  using (student_id = auth.uid()
         or exists (select 1 from jobs j where j.id = job_id and j.umkm_id = auth.uid()));

-- payments: hanya baca oleh pihak terkait; tulis lewat server (service role)
create policy "payments_read" on payments
  for select to authenticated
  using (exists (select 1 from applications a
                 join jobs j on j.id = a.job_id
                 where a.id = application_id
                   and (a.student_id = auth.uid() or j.umkm_id = auth.uid())));

-- reviews: publik untuk user login; tulis atas nama sendiri
create policy "reviews_read" on reviews
  for select to authenticated using (true);
create policy "reviews_insert_own" on reviews
  for insert to authenticated with check (reviewer_id = auth.uid());

-- messages: hanya pengirim/penerima
create policy "messages_read" on messages
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "messages_insert_own" on messages
  for insert to authenticated with check (sender_id = auth.uid());

-- Aktifkan realtime untuk chat & notifikasi job baru
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table jobs;
