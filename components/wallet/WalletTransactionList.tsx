'use client'

import React from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  ReceiptText,
  RefreshCw,
} from 'lucide-react'
import { formatDateTimeWIB, formatRupiah } from '@/lib/format'
import type {
  WalletTxType,
  WalletTxStatus,
  WalletTransactionItem,
} from '@/lib/wallet'

interface WalletTransactionListProps {
  role: 'merchant' | 'student'
  transactions: WalletTransactionItem[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onCheckTopupStatus?: (orderId: string) => void
  checkingOrderId?: string | null
}

const MERCHANT_LABELS: Record<WalletTxType, string> = {
  topup: 'Isi Saldo',
  job_payment: 'Dana ditahan',
  refund: 'Pengembalian dana',
  commission: 'Biaya layanan',
  job_earning: 'Upah',
  withdrawal: 'Tarik Tunai',
}

const STUDENT_LABELS: Record<WalletTxType, string> = {
  job_earning: 'Upah',
  withdrawal: 'Tarik Tunai',
  refund: 'Pengembalian dana',
  topup: 'Isi Saldo',
  job_payment: 'Dana ditahan',
  commission: 'Biaya layanan',
}

function isCreditType(type: WalletTxType): boolean {
  return type === 'topup' || type === 'refund' || type === 'job_earning'
}

function getStatusBadge(
  role: 'merchant' | 'student',
  type: WalletTxType,
  status: WalletTxStatus
): { label: string; className: string } {
  if (status === 'pending') {
    const label =
      role === 'student' && type === 'withdrawal'
        ? 'Menunggu pemrosesan'
        : 'Menunggu'
    return {
      label,
      className:
        'bg-amber-50 text-amber-700 border border-amber-200/80',
    }
  }

  if (status === 'success') {
    return {
      label: 'Berhasil',
      className:
        'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    }
  }

  return {
    label: 'Gagal',
    className: 'bg-red-50 text-red-700 border border-red-200/80',
  }
}

export function WalletTransactionList({
  role,
  transactions,
  hasMore,
  loadingMore,
  onLoadMore,
  onCheckTopupStatus,
  checkingOrderId,
}: WalletTransactionListProps) {
  const labels = role === 'merchant' ? MERCHANT_LABELS : STUDENT_LABELS

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-8 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-[#EFF4FF] text-[#0B1C30] flex items-center justify-center mb-3">
          <ReceiptText className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-[#0B1C30] mb-1">
          Belum ada riwayat transaksi
        </p>
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
          Semua mutasi saldo dompet kamu akan tercatat otomatis di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {transactions.map((tx) => {
        const isCredit = isCreditType(tx.type)
        const label = labels[tx.type] ?? tx.type
        const badge = getStatusBadge(role, tx.type, tx.status)
        const canCheckTopup =
          role === 'merchant' &&
          tx.type === 'topup' &&
          tx.status === 'pending' &&
          Boolean(tx.external_ref) &&
          Boolean(onCheckTopupStatus)
        const isCheckingThis =
          Boolean(tx.external_ref) && checkingOrderId === tx.external_ref

        return (
          <div
            key={tx.id}
            className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-[0_2px_10px_rgba(26,43,76,0.04)] flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isCredit
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {isCredit ? (
                  <ArrowDownLeft className="w-5 h-5 stroke-[2.2]" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0B1C30] truncate">
                  {label}
                </p>
                {tx.note && (
                  <p className="text-xs text-gray-600 line-clamp-2 mt-0.5 leading-snug">
                    {tx.note}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-1 font-medium">
                  {formatDateTimeWIB(tx.created_at)}
                </p>

                {canCheckTopup && tx.external_ref && onCheckTopupStatus && (
                  <button
                    type="button"
                    disabled={Boolean(checkingOrderId)}
                    onClick={() => onCheckTopupStatus(tx.external_ref!)}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFEDE0] text-[#FF6B00] hover:bg-[#FFE0C7] disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold transition-colors"
                  >
                    {isCheckingThis ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>{isCheckingThis ? 'Memeriksa...' : 'Cek status'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end shrink-0 text-right gap-1">
              <span
                className={`text-sm font-extrabold whitespace-nowrap ${
                  isCredit ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {isCredit ? '+' : '-'} {formatRupiah(tx.amount)}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
          </div>
        )
      })}

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-1 w-full h-11 rounded-full bg-white border border-gray-200 text-[#0B1C30] hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-bold flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all"
        >
          {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{loadingMore ? 'Memuat...' : 'Muat lebih banyak'}</span>
        </button>
      )}
    </div>
  )
}
