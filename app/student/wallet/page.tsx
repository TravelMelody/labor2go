import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StudentWalletView } from '@/components/student/StudentWalletView'
import {
  WALLET_TX_PAGE_SIZE,
  type WalletTransactionItem,
} from '@/components/wallet/WalletTransactionList'

export const metadata = {
  title: 'Dana & Dompet – Labor2Go',
  description: 'Kelola saldo, penghasilan, dan penarikan dana mahasiswa Labor2Go',
}

function StudentWalletSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-6 animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100 px-4 flex items-center justify-between">
        <div className="w-24 h-7 rounded bg-gray-200" />
        <div className="w-12 h-5 rounded bg-gray-200" />
        <div className="w-8" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-5">
        <div className="bg-white rounded-3xl p-5 border border-gray-100 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="w-24 h-3.5 rounded bg-gray-200" />
            <div className="w-28 h-5 rounded-full bg-gray-200" />
          </div>
          <div className="w-40 h-9 rounded-lg bg-gray-200" />
          <div className="h-12 rounded-full bg-gray-200" />
          <div className="h-10 rounded-xl bg-gray-100" />
        </div>
        <div className="w-36 h-5 rounded bg-gray-200" />
        <div className="h-20 rounded-2xl bg-white border border-gray-100" />
        <div className="h-20 rounded-2xl bg-white border border-gray-100" />
      </div>
    </div>
  )
}

async function StudentWalletContent() {
  await connection()

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/student/wallet')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, verified')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Gagal membaca profil pengguna untuk dompet mahasiswa:', profileError)
  }

  if (profile?.role && profile.role !== 'student') {
    redirect('/merchant/wallet')
  }

  const [walletRes, paymentsRes, txRes] = await Promise.all([
    supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('amount, applications!inner(student_id)')
      .eq('status', 'held')
      .eq('applications.student_id', user.id),
    supabase
      .from('wallet_transactions')
      .select(
        'id, type, amount, status, application_id, external_ref, note, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, WALLET_TX_PAGE_SIZE),
  ])

  if (walletRes.error) {
    console.error('Gagal membaca saldo dompet mahasiswa:', walletRes.error)
  }
  if (paymentsRes.error) {
    console.error('Gagal membaca dana menunggu cair mahasiswa:', paymentsRes.error)
  }
  if (txRes.error) {
    console.error('Gagal membaca riwayat transaksi mahasiswa:', txRes.error)
  }

  const initialBalance = Number(walletRes.data?.balance ?? 0)
  const initialPendingAmount = (
    (paymentsRes.data ?? []) as Array<{ amount: number | string | null }>
  ).reduce<number>((sum, row) => sum + Number(row.amount ?? 0), 0)
  const rawTx = (txRes.data ?? []) as WalletTransactionItem[]
  const initialHasMore = rawTx.length > WALLET_TX_PAGE_SIZE
  const initialTransactions = rawTx.slice(0, WALLET_TX_PAGE_SIZE)

  return (
    <StudentWalletView
      userId={user.id}
      initialBalance={initialBalance}
      initialPendingAmount={initialPendingAmount}
      initialIsVerified={Boolean(profile?.verified)}
      initialTransactions={initialTransactions}
      initialHasMore={initialHasMore}
    />
  )
}

export default function StudentWalletPage() {
  return (
    <Suspense fallback={<StudentWalletSkeleton />}>
      <StudentWalletContent />
    </Suspense>
  )
}
