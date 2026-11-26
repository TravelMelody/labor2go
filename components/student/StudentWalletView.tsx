'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/format'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { WalletTransactionList } from '@/components/wallet/WalletTransactionList'
import {
  WALLET_TX_PAGE_SIZE,
  type WalletTransactionItem,
} from '@/lib/wallet'

const MIN_WITHDRAWAL_AMOUNT = 10_000

const WITHDRAWAL_DESTINATIONS = [
  { value: 'gopay', label: 'GoPay', placeholder: 'Contoh: 081234567890' },
  { value: 'dana', label: 'DANA', placeholder: 'Contoh: 081234567890' },
  { value: 'ovo', label: 'OVO', placeholder: 'Contoh: 081234567890' },
  {
    value: 'shopeepay',
    label: 'ShopeePay',
    placeholder: 'Contoh: 081234567890',
  },
  {
    value: 'bank',
    label: 'Bank',
    placeholder: 'Contoh: BCA 1234567890 a.n. Nama',
  },
] as const

type WithdrawalDestination = (typeof WITHDRAWAL_DESTINATIONS)[number]['value']

interface StudentWalletViewProps {
  userId: string
  initialBalance: number
  initialPendingAmount: number
  initialIsVerified: boolean
  initialTransactions: WalletTransactionItem[]
  initialHasMore: boolean
}

export function StudentWalletView({
  userId,
  initialBalance,
  initialPendingAmount,
  initialIsVerified,
  initialTransactions,
  initialHasMore,
}: StudentWalletViewProps) {
  const supabase = useMemo(() => createClient(), [])

  const [balance, setBalance] = useState<number>(initialBalance)
  const [pendingAmount, setPendingAmount] =
    useState<number>(initialPendingAmount)
  const [isVerified, setIsVerified] = useState<boolean>(initialIsVerified)
  const [transactions, setTransactions] =
    useState<WalletTransactionItem[]>(initialTransactions)
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore)
  const [loadedLimit, setLoadedLimit] = useState<number>(WALLET_TX_PAGE_SIZE)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)

  const loadedLimitRef = useRef<number>(loadedLimit)
  useEffect(() => {
    loadedLimitRef.current = loadedLimit
  }, [loadedLimit])

  // Withdrawal bottom sheet state
  const [isWithdrawSheetOpen, setIsWithdrawSheetOpen] = useState<boolean>(false)
  const [amountInput, setAmountInput] = useState<string>('')
  const [destinationType, setDestinationType] =
    useState<WithdrawalDestination>('gopay')
  const [destinationAccount, setDestinationAccount] = useState<string>('')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] =
    useState<boolean>(false)
  const withdrawInFlightRef = useRef<boolean>(false)

  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type })
    },
    []
  )

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      setToast(null)
    }, 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const refreshWalletData = useCallback(
    async (limitOverride?: number) => {
      const targetLimit = limitOverride ?? loadedLimitRef.current

      try {
        const [walletRes, paymentsRes, profileRes, txRes] = await Promise.all([
          supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('payments')
            .select('amount, applications!inner(student_id)')
            .eq('status', 'held')
            .eq('applications.student_id', userId),
          supabase
            .from('profiles')
            .select('verified')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('wallet_transactions')
            .select(
              'id, type, amount, status, application_id, external_ref, note, created_at'
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(0, targetLimit),
        ])

        if (walletRes.error) {
          console.error('Gagal memperbarui saldo dompet mahasiswa:', walletRes.error)
        } else {
          setBalance(Number(walletRes.data?.balance ?? 0))
        }

        if (paymentsRes.error) {
          console.error('Gagal memperbarui dana menunggu cair:', paymentsRes.error)
        } else if (paymentsRes.data) {
          const totalHeld = (
            paymentsRes.data as Array<{ amount: number | string | null }>
          ).reduce<number>((sum, row) => sum + Number(row.amount ?? 0), 0)
          setPendingAmount(totalHeld)
        }

        if (profileRes.error) {
          console.error('Gagal memperbarui status verifikasi:', profileRes.error)
        } else if (profileRes.data) {
          setIsVerified(Boolean(profileRes.data.verified))
        }

        if (txRes.error) {
          console.error('Gagal memperbarui riwayat transaksi mahasiswa:', txRes.error)
        } else if (txRes.data) {
          const rows = txRes.data as WalletTransactionItem[]
          const more = rows.length > targetLimit
          setHasMore(more)
          setTransactions(rows.slice(0, targetLimit))
        }
      } catch (err) {
        console.error('Kesalahan tak terduga saat memperbarui dompet mahasiswa:', err)
      }
    },
    [supabase, userId]
  )

  useAutoRefresh(() => {
    void refreshWalletData()
  }, 20000)

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const start = transactions.length
      const end = start + WALLET_TX_PAGE_SIZE

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select(
          'id, type, amount, status, application_id, external_ref, note, created_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) {
        console.error('Gagal memuat transaksi mahasiswa lebih banyak:', error)
        showToast('Gagal memuat riwayat transaksi tambahan', 'error')
        return
      }

      if (data) {
        const rows = data as WalletTransactionItem[]
        const more = rows.length > WALLET_TX_PAGE_SIZE
        const nextItems = rows.slice(0, WALLET_TX_PAGE_SIZE)

        setTransactions((prev) => {
          const existingIds = new Set(prev.map((item) => item.id))
          const deduped = nextItems.filter((item) => !existingIds.has(item.id))
          return [...prev, ...deduped]
        })
        setHasMore(more)
        setLoadedLimit((prev) => prev + WALLET_TX_PAGE_SIZE)
      }
    } catch (err) {
      console.error('Kesalahan tak terduga saat memuat riwayat tambahan:', err)
      showToast('Gagal memuat riwayat transaksi tambahan', 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  const parsedAmount = useMemo(() => {
    const digits = amountInput.replace(/\D/g, '')
    if (!digits) return 0
    return Number.parseInt(digits, 10)
  }, [amountInput])

  const selectedDestination = useMemo(
    () =>
      WITHDRAWAL_DESTINATIONS.find((item) => item.value === destinationType) ??
      WITHDRAWAL_DESTINATIONS[0],
    [destinationType]
  )

  const openWithdrawSheet = () => {
    if (isSubmittingWithdraw || withdrawInFlightRef.current) return
    setWithdrawError(null)
    setIsWithdrawSheetOpen(true)
  }

  const closeWithdrawSheet = () => {
    if (isSubmittingWithdraw || withdrawInFlightRef.current) return
    setIsWithdrawSheetOpen(false)
    setWithdrawError(null)
  }

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (withdrawInFlightRef.current || isSubmittingWithdraw) return

    if (!Number.isInteger(parsedAmount) || parsedAmount < MIN_WITHDRAWAL_AMOUNT) {
      setWithdrawError('Minimal penarikan Rp 10.000')
      return
    }

    if (parsedAmount > balance) {
      setWithdrawError('Nominal melebihi saldo tersedia')
      return
    }

    const trimmedAccount = destinationAccount.trim()
    if (trimmedAccount.length < 5) {
      setWithdrawError('Nomor tujuan minimal 5 karakter')
      return
    }

    withdrawInFlightRef.current = true
    setIsSubmittingWithdraw(true)
    setWithdrawError(null)

    try {
      const { error } = await supabase.rpc('request_withdrawal', {
        p_amount: parsedAmount,
        p_destination_type: destinationType,
        p_destination_account: trimmedAccount,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Validasi bisnis request_withdrawal:', error.message)
        } else {
          console.error('Kesalahan tak terduga saat request_withdrawal:', error)
        }
        setWithdrawError(error.message || 'Gagal mengajukan penarikan saldo')
        return
      }

      setIsWithdrawSheetOpen(false)
      setAmountInput('')
      setDestinationAccount('')
      showToast('Permintaan penarikan berhasil diajukan', 'success')
      await refreshWalletData()
    } catch (err) {
      console.error('Kesalahan tak terduga saat mengajukan penarikan:', err)
      setWithdrawError('Terjadi kesalahan saat mengajukan penarikan saldo')
    } finally {
      withdrawInFlightRef.current = false
      setIsSubmittingWithdraw(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed top-4 left-4 right-4 max-w-[388px] mx-auto z-[70] p-3.5 rounded-2xl border shadow-lg flex items-center justify-between gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-red-50 border-red-200 text-red-950'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="text-xs font-bold leading-snug">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-full hover:bg-black/5 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="Labor2Go"
            width={110}
            height={30}
            className="h-7 w-auto object-contain"
            priority
          />
        </div>
        <h1 className="text-base font-bold text-[#0B1C30] absolute left-1/2 -translate-x-1/2">
          Dana
        </h1>
        <div className="w-8" aria-hidden="true" />
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {/* Hero Card: Saldo Mahasiswa */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-500">
              Saldo Tersedia
            </span>
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-bold shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Aman &amp; Terverifikasi</span>
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1C30] tracking-tight break-words">
            {formatRupiah(balance)}
          </h2>

          <button
            type="button"
            onClick={openWithdrawSheet}
            disabled={isSubmittingWithdraw}
            className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-[0_6px_16px_-4px_rgba(255,107,0,0.35)] active:scale-[0.99] transition-all"
          >
            <span>Tarik Saldo</span>
            <ArrowRight className="w-4.5 h-4.5" />
          </button>

          <div className="bg-[#EFF4FF]/80 -mx-5 -mb-5 px-5 py-3 flex items-center justify-between gap-2 border-t border-blue-100/70">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span className="text-xs font-medium text-gray-600 truncate">
                Menunggu Cair
              </span>
            </div>
            <span className="text-xs font-extrabold text-[#0B1C30] shrink-0">
              {formatRupiah(pendingAmount)}
            </span>
          </div>
        </section>

        {/* Riwayat Transaksi */}
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-bold text-[#0B1C30] px-0.5">
            Riwayat Transaksi
          </h3>

          <WalletTransactionList
            role="student"
            transactions={transactions}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
          />
        </section>
      </main>

      {/* Bottom Sheet: Tarik Saldo */}
      {isWithdrawSheetOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[#0B1C30]/50 backdrop-blur-[2px] flex items-end justify-center"
          onClick={closeWithdrawSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-sheet-title"
            className="w-full max-w-[420px] bg-white rounded-t-3xl p-5 pb-8 shadow-2xl border-t border-gray-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  id="withdraw-sheet-title"
                  className="text-base font-extrabold text-[#0B1C30]"
                >
                  Tarik Saldo
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Saldo tersedia:{' '}
                  <span className="font-bold text-[#0B1C30]">
                    {formatRupiah(balance)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeWithdrawSheet}
                disabled={isSubmittingWithdraw}
                aria-label="Tutup form tarik saldo"
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleWithdrawalSubmit}
              className="flex flex-col gap-4"
            >
              {/* Input Nominal */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="withdraw-amount-input"
                    className="text-xs font-bold text-[#0B1C30]"
                  >
                    Nominal Penarikan
                  </label>
                  {balance >= MIN_WITHDRAWAL_AMOUNT && (
                    <button
                      type="button"
                      disabled={isSubmittingWithdraw}
                      onClick={() => {
                        setAmountInput(String(balance))
                        setWithdrawError(null)
                      }}
                      className="text-[11px] font-bold text-[#FF6B00] hover:underline"
                    >
                      Tarik Semua
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-bold text-gray-500 pointer-events-none">
                    Rp
                  </span>
                  <input
                    id="withdraw-amount-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={
                      parsedAmount > 0
                        ? parsedAmount.toLocaleString('id-ID')
                        : ''
                    }
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      setAmountInput(digits)
                      setWithdrawError(null)
                    }}
                    placeholder="Masukkan nominal (min. 10.000)"
                    disabled={isSubmittingWithdraw}
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-[#F8F9FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 focus:border-[#FF6B00] text-sm font-bold text-[#0B1C30]"
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Min. Rp 10.000 • Maks. {formatRupiah(balance)}
                </p>
              </div>

              {/* Pilihan Tujuan */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[#0B1C30]">
                  Tujuan Penarikan
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {WITHDRAWAL_DESTINATIONS.map((dest) => {
                    const isSelected = destinationType === dest.value
                    return (
                      <button
                        key={dest.value}
                        type="button"
                        disabled={isSubmittingWithdraw}
                        onClick={() => {
                          setDestinationType(dest.value)
                          setWithdrawError(null)
                        }}
                        className={`h-10 rounded-xl border text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#FFEDE0] border-[#FF6B00] text-[#FF6B00]'
                            : 'bg-[#F8F9FF] border-gray-200 text-[#0B1C30] hover:border-orange-200'
                        }`}
                      >
                        {dest.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Nomor Tujuan */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="withdraw-account-input"
                  className="text-xs font-bold text-[#0B1C30]"
                >
                  Nomor / Rekening Tujuan ({selectedDestination.label})
                </label>
                <input
                  id="withdraw-account-input"
                  type="text"
                  value={destinationAccount}
                  onChange={(e) => {
                    setDestinationAccount(e.target.value)
                    setWithdrawError(null)
                  }}
                  placeholder={selectedDestination.placeholder}
                  disabled={isSubmittingWithdraw}
                  className="w-full h-12 px-3.5 rounded-xl border border-gray-200 bg-[#F8F9FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 focus:border-[#FF6B00] text-sm font-medium text-[#0B1C30]"
                />
              </div>

              {/* Info Simulasi */}
              <div className="p-3 rounded-xl bg-[#EFF4FF] border border-blue-100 text-xs text-gray-700 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#0B1C30] shrink-0 mt-0.5" />
                <span>
                  Penarikan diproses admin (simulasi), biasanya dalam 1x24 jam.
                </span>
              </div>

              {withdrawError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{withdrawError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingWithdraw}
                className="h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_6px_16px_-4px_rgba(255,107,0,0.35)] active:scale-[0.99] transition-all"
              >
                {isSubmittingWithdraw && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>
                  {isSubmittingWithdraw ? 'Mengajukan...' : 'Ajukan Penarikan'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
