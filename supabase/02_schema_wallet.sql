-- ============================================================
-- Labor2Go - Tambahan schema (Dompet, Penarikan, Panggil Ulang Cepat, Level)
-- JALANKAN SETELAH labor2go_schema.sql (SQL Editor > New query > Run)
-- ============================================================

-- ---------- ENUM ----------
create type wallet_tx_type as enum (
  'topup',          -- UMKM isi saldo
  'job_payment',    -- UMKM bayar job (dana ditahan)
  'job_earning',    -- Mahasiswa terima upah
  'commission',     -- Potongan komisi platform
  'withdrawal',     -- Tarik tunai
  'refund'          -- Pengembalian dana
);
create type tx_status as enum ('pending', 'success', 'failed');
create type withdrawal_status as enum ('pending', 'processed', 'rejected');

-- ---------- TABEL ----------
-- Saldo dompet (1 user = 1 dompet). Saldo HANYA diubah dari server (service role).
create table wallets (
  user_id uuid primary key references profiles(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Riwayat mutasi (jangan pernah diedit; koreksi = transaksi baru)
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type wallet_tx_type not null,
  amount bigint not null check (amount > 0),
  status tx_status not null default 'pending',
  application_id uuid references applications(id) on delete set null,
  external_ref text,               -- misal order_id Midtrans
  note text,
  created_at timestamptz not null default now()
);
create index on wallet_transactions (user_id, created_at desc);

-- Permintaan tarik tunai mahasiswa
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount bigint not null check (amount >= 10000),
  destination_type text not null,  -- 'dana', 'gopay', 'ovo', 'bank'
  destination_account text not null,
  status withdrawal_status not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- "Panggil Ulang Cepat": template job favorit UMKM
create table job_templates (
  id uuid primary key default gen_random_uuid(),
  umkm_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  duration_hours numeric(4,1) not null default 2,
  pay_amount int not null check (pay_amount > 0),
  slots int not null default 1,
  created_at timestamptz not null default now()
);

-- Level / progres mahasiswa (untuk badge "Level 3" dan bonus)
alter table student_profiles
  add column if not exists level int not null default 1,
  add column if not exists completed_jobs int not null default 0;

-- Rating rata-rata untuk bintang (mis. 4.9) di kartu profil/job
create view profile_ratings with (security_invoker = true) as
  select reviewee_id as user_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*) as review_count
  from reviews
  group by reviewee_id;

-- ---------- DOMPET OTOMATIS UNTUK USER BARU ----------
create or replace function handle_new_wallet()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_profile_created_wallet
  after insert on profiles
  for each row execute function handle_new_wallet();

-- Backfill: user yang sudah terdaftar sebelum file ini dijalankan
insert into wallets (user_id)
select id from profiles
on conflict do nothing;

-- ---------- ROW LEVEL SECURITY ----------
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table withdrawals enable row level security;
alter table job_templates enable row level security;

-- Dompet & mutasi: hanya BACA milik sendiri. Tidak ada policy insert/update,
-- jadi perubahan saldo hanya bisa lewat server (service role) -> aman dari curang.
create policy "wallets_read_own" on wallets
  for select to authenticated using (user_id = auth.uid());

create policy "wallet_tx_read_own" on wallet_transactions
  for select to authenticated using (user_id = auth.uid());

-- Penarikan: user boleh melihat & mengajukan milik sendiri (status selalu pending)
create policy "withdrawals_read_own" on withdrawals
  for select to authenticated using (user_id = auth.uid());
create policy "withdrawals_insert_own" on withdrawals
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- Template job: UMKM kelola miliknya sendiri
create policy "job_templates_own" on job_templates
  for all to authenticated
  using (umkm_id = auth.uid()) with check (umkm_id = auth.uid());

-- Level & jumlah job selesai tidak boleh diubah dari client
revoke insert, update on student_profiles from authenticated;
grant insert (id, nim, university, skills, ktm_url) on student_profiles to authenticated;
grant update (nim, university, skills, ktm_url) on student_profiles to authenticated;
