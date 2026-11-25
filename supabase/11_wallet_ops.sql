-- ============================================================
-- Labor2Go - Operasi dompet: top-up Midtrans + tarik tunai
-- Jalankan di Supabase: SQL Editor > New query > paste > Run (aman dijalankan ulang)
-- Prasyarat: labor2go_work_cycle.sql sudah dijalankan.
-- ============================================================

-- ---------- 1. Top-up: dipanggil HANYA oleh server (service_role) ----------
-- Alurnya: server membuat baris wallet_transactions 'pending' (type topup, external_ref = order_id),
-- lalu setelah Midtrans mengonfirmasi bayar, server memanggil credit_topup().
-- Idempoten: dipanggil berkali-kali (webhook + verifikasi manual) saldo hanya bertambah sekali.
create or replace function public.credit_topup(p_order_id text, p_gross_amount bigint)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_tx public.wallet_transactions%rowtype;
begin
  select * into v_tx
  from public.wallet_transactions
  where external_ref = p_order_id and type = 'topup'
  for update;

  if not found then
    raise exception 'Order top-up tidak ditemukan';
  end if;
  if v_tx.status <> 'pending' then
    return false; -- sudah diproses sebelumnya
  end if;
  if v_tx.amount <> p_gross_amount then
    raise exception 'Nominal pembayaran tidak cocok dengan order';
  end if;

  update public.wallet_transactions set status = 'success' where id = v_tx.id;
  update public.wallets
     set balance = balance + v_tx.amount, updated_at = now()
   where user_id = v_tx.user_id;
  return true;
end;
$$;

-- Tandai top-up gagal/kedaluwarsa (hanya jika masih pending)
create or replace function public.fail_topup(p_order_id text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update public.wallet_transactions
     set status = 'failed'
   where external_ref = p_order_id and type = 'topup' and status = 'pending';
  return found;
end;
$$;

revoke all on function public.credit_topup(text, bigint) from public, anon, authenticated;
revoke all on function public.fail_topup(text) from public, anon, authenticated;
grant execute on function public.credit_topup(text, bigint) to service_role;
grant execute on function public.fail_topup(text) to service_role;

-- ---------- 2. Tarik tunai mahasiswa ----------
-- Saldo langsung dipotong saat permintaan dibuat (supaya tidak bisa ditarik dua kali).
-- Admin kemudian memproses (resolve_withdrawal): transfer manual, atau tolak -> saldo kembali.
create or replace function public.request_withdrawal(
  p_amount bigint,
  p_destination_type text,
  p_destination_account text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Kamu harus login'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'student') then
    raise exception 'Hanya mahasiswa yang dapat menarik saldo';
  end if;
  if p_amount is null or p_amount < 10000 then
    raise exception 'Minimal penarikan Rp 10.000';
  end if;
  if p_destination_type not in ('gopay', 'dana', 'ovo', 'shopeepay', 'bank') then
    raise exception 'Tujuan penarikan tidak valid';
  end if;
  if length(trim(coalesce(p_destination_account, ''))) < 5 then
    raise exception 'Nomor tujuan tidak valid';
  end if;

  select balance into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance is null or v_balance < p_amount then
    raise exception 'Saldo tidak cukup';
  end if;

  update public.wallets
     set balance = balance - p_amount, updated_at = now()
   where user_id = v_uid;

  insert into public.withdrawals (user_id, amount, destination_type, destination_account)
  values (v_uid, p_amount, p_destination_type, trim(p_destination_account))
  returning id into v_id;

  insert into public.wallet_transactions (user_id, type, amount, status, external_ref, note)
  values (v_uid, 'withdrawal', p_amount, 'pending', v_id::text,
          'Tarik tunai ke ' || upper(p_destination_type));

  return v_id;
end;
$$;

-- Admin memproses penarikan (dipanggil dari dashboard admin atau SQL Editor)
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
    update public.withdrawals
       set status = 'processed', processed_at = now()
     where id = v_w.id;
    update public.wallet_transactions
       set status = 'success'
     where external_ref = v_w.id::text and type = 'withdrawal';
  else
    update public.withdrawals
       set status = 'rejected', processed_at = now()
     where id = v_w.id;
    update public.wallet_transactions
       set status = 'failed'
     where external_ref = v_w.id::text and type = 'withdrawal';
    update public.wallets
       set balance = balance + v_w.amount, updated_at = now()
     where user_id = v_w.user_id;
    insert into public.wallet_transactions (user_id, type, amount, status, external_ref, note)
    values (v_w.user_id, 'refund', v_w.amount, 'success', v_w.id::text,
            'Penarikan ditolak, saldo dikembalikan');
  end if;
end;
$$;

revoke all on function public.request_withdrawal(bigint, text, text) from public, anon;
revoke all on function public.resolve_withdrawal(uuid, boolean) from public, anon;
grant execute on function public.request_withdrawal(bigint, text, text) to authenticated;
grant execute on function public.resolve_withdrawal(uuid, boolean) to authenticated, service_role;

-- ---------- 3. Tutup jalan pintas: client tidak boleh menulis withdrawals langsung ----------
drop policy if exists "withdrawals_insert_own" on public.withdrawals;
revoke insert on public.withdrawals from authenticated;