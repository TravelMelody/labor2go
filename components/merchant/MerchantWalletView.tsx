'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Script from 'next/script'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Landmark,
  Loader2,
  PlusCircle,
  ShieldCheck,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/format'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  WALLET_TX_PAGE_SIZE,
  WalletTransactionList,
  type WalletTransactionItem,
} from '@/components/wallet/WalletTransactionList'

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result?: unknown) => void
          onPending?: (result?: unknown) => void
          onError?: (result?: unknown) => void
          onClose?: () => void
        }
      ) => void
    }
  }
}

const MIN_TOPUP_AMOUNT = 10_000
const MAX_TOPUP_AMOUNT = 5_000_000
const QUICK_TOPUP_AMOUNTS = [50_000, 100_000, 200_000, 500_000] as const

interface MerchantWalletViewProps {
  userId: string
  initialBalance: number
  initialHeldAmount: number
  initialIsVerified: boolean
  initialTransactions: WalletTransactionItem[]
  initialHasMore: boolean
}

export function MerchantWalletView({
  userId,
  initialBalance,
  initialHeldAmount,
  initialIsVerified,
  initialTransactions,
  initialHasMore,
}: MerchantWalletViewProps) {
  const supabase = useMemo(() => createClient(), [])

  const [balance, setBalance] = useState<number>(initialBalance)
  const [heldAmount, setHeldAmount] = useState<number>(initialHeldAmount)
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

  // Top-up bottom sheet & Midtrans Snap state
  const [isTopupSheetOpen, setIsTopupSheetOpen] = useState<boolean>(false)
  const [amountInput, setAmountInput] = useState<string>('')
  const [topupError, setTopupError] = useState<string | null>(null)
  const [isSubmittingTopup, setIsSubmittingTopup] = useState<boolean>(false)
  const [snapReady, setSnapReady] = useState<boolean>(false)
  const [snapScriptError, setSnapScriptError] = useState<boolean>(false)
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null)

  const topupInFlightRef = useRef<boolean>(false)
  const verifyInFlightRef = useRef<Set<string>>(new Set())

  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
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
            .select('amount, commission')
            .eq('status', 'held'),
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
          console.error('Gagal memperbarui saldo dompet merchant:', walletRes.error)
        } else {
          setBalance(Number(walletRes.data?.balance ?? 0))
        }

        if (paymentsRes.error) {
          console.error('Gagal memperbarui dana ditahan merchant:', paymentsRes.error)
        } else if (paymentsRes.data) {
          const totalHeld = (
            paymentsRes.data as Array<{
              amount: number | string | null
              commission: number | string | null
            }>
          ).reduce<number>(
            (sum, row) =>
              sum + Number(row.amount ?? 0) + Number(row.commission ?? 0),
            0
          )
          setHeldAmount(totalHeld)
        }

        if (profileRes.error) {
          console.error('Gagal memperbarui status verifikasi:', profileRes.error)
        } else if (profileRes.data) {
          setIsVerified(Boolean(profileRes.data.verified))
        }

        if (txRes.error) {
          console.error('Gagal memperbarui riwayat transaksi merchant:', txRes.error)
        } else if (txRes.data) {
          const rows = txRes.data as WalletTransactionItem[]
          const more = rows.length > targetLimit
          setHasMore(more)
          setTransactions(rows.slice(0, targetLimit))
        }
      } catch (err) {
        console.error('Kesalahan tak terduga saat memperbarui dompet merchant:', err)
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
        console.error('Gagal memuat transaksi merchant lebih banyak:', error)
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

  const verifyTopupOrder = useCallback(
    async (orderId: string, options?: { showToastFeedback?: boolean }) => {
      if (!orderId || verifyInFlightRef.current.has(orderId)) return

      verifyInFlightRef.current.add(orderId)
      setCheckingOrderId(orderId)

      try {
        const res = await fetch('/api/topup/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        })

        const data = (await res.json().catch(() => null)) as {
          status?: 'paid' | 'pending' | 'failed'
          balance?: number
          error?: string
        } | null

        if (!res.ok) {
          if (options?.showToastFeedback) {
            showToast(
              data?.error || 'Gagal memeriksa status pembayaran',
              'error'
            )
          }
          await refreshWalletData()
          return
        }

        if (typeof data?.balance === 'number') {
          setBalance(Number(data.balance))
        }

        await refreshWalletData()

        if (options?.showToastFeedback) {
          if (data?.status === 'paid') {
            showToast('Saldo berhasil ditambahkan!', 'success')
          } else if (data?.status === 'pending') {
            showToast('Pembayaran masih menunggu penyelesaian.', 'info')
          } else if (data?.status === 'failed') {
            showToast('Pembayaran gagal atau kedaluwarsa.', 'error')
          }
        }
      } catch (err) {
        console.error('Kesalahan tak terduga saat verifikasi top-up:', err)
        if (options?.showToastFeedback) {
          showToast('Gagal memeriksa status pembayaran ke server', 'error')
        }
      } finally {
        verifyInFlightRef.current.delete(orderId)
        setCheckingOrderId((current) => (current === orderId ? null : current))
      }
    },
    [refreshWalletData, showToast]
  )

  const parsedAmount = useMemo(() => {
    const digits = amountInput.replace(/\D/g, '')
    if (!digits) return 0
    return Number.parseInt(digits, 10)
  }, [amountInput])

  const openTopupSheet = () => {
    if (isSubmittingTopup || topupInFlightRef.current) return
    setTopupError(null)
    setIsTopupSheetOpen(true)
  }

  const closeTopupSheet = () => {
    if (isSubmittingTopup || topupInFlightRef.current) return
    setIsTopupSheetOpen(false)
    setTopupError(null)
  }

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (topupInFlightRef.current || isSubmittingTopup) return

    if (
      !Number.isInteger(parsedAmount) ||
      parsedAmount < MIN_TOPUP_AMOUNT ||
      parsedAmount > MAX_TOPUP_AMOUNT
    ) {
      setTopupError(
        'Nominal isi saldo harus antara Rp 10.000 hingga Rp 5.000.000'
      )
      return
    }

    topupInFlightRef.current = true
    setIsSubmittingTopup(true)
    setTopupError(null)

    let snapOpened = false

    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedAmount }),
      })

      const data = (await res.json().catch(() => null)) as {
        token?: string
        order_id?: string
        error?: string
      } | null

      if (!res.ok || !data?.token || !data?.order_id) {
        setTopupError(data?.error || 'Gagal membuat transaksi isi saldo')
        return
      }

      const orderId = data.order_id
      const snapToken = data.token

      if (typeof window === 'undefined' || typeof window.snap?.pay !== 'function') {
        await refreshWalletData()
        setTopupError(
          'Popup pembayaran Midtrans belum siap. Silakan muat ulang atau klik "Cek status" pada riwayat.'
        )
        return
      }

      setIsTopupSheetOpen(false)
      setAmountInput('')

      const handleSnapCallback = () => {
        topupInFlightRef.current = false
        setIsSubmittingTopup(false)
        void verifyTopupOrder(orderId, { showToastFeedback: true })
      }

      snapOpened = true
      window.snap.pay(snapToken, {
        onSuccess: handleSnapCallback,
        onPending: handleSnapCallback,
        onError: handleSnapCallback,
        onClose: handleSnapCallback,
      })
    } catch (err) {
      console.error('Kesalahan tak terduga saat memproses top-up:', err)
      if (!snapOpened) {
        setTopupError('Terjadi kesalahan saat menghubungi layanan pembayaran')
      } else {
        showToast('Popup pembayaran gagal dibuka', 'error')
      }
    } finally {
      if (!snapOpened) {
        topupInFlightRef.current = false
        setIsSubmittingTopup(false)
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-28">
      <Script
        src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? ''}
        strategy="afterInteractive"
        onLoad={() => {
          setSnapReady(true)
          setSnapScriptError(false)
        }}
        onReady={() => {
          if (typeof window !== 'undefined' && typeof window.snap?.pay === 'function') {
            setSnapReady(true)
            setSnapScriptError(false)
          }
        }}
        onError={() => {
          setSnapReady(false)
          setSnapScriptError(true)
        }}
      />

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed top-4 left-4 right-4 max-w-[388px] mx-auto z-[70] p-3.5 rounded-2xl border shadow-lg flex items-center justify-between gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-950'
                : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 shrink-0" />
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

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center justify-center">
        <h1 className="text-base font-bold text-[#0B1C30]">Dana Usaha</h1>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {/* Hero Card: Saldo Usaha */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-500">
              Saldo Upah Tersedia
            </span>
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-bold shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Aman &amp; Terverifikasi</span>
              </span>
            )}
          </div>

          <h2 className="text-3xl font-extrabold text-[#0B1C30] tracking-tight">
            {formatRupiah(balance)}
          </h2>

          {/* Dual Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={openTopupSheet}
              disabled={isSubmittingTopup}
              className="h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-[0_6px_16px_-4px_rgba(255,107,0,0.35)] active:scale-[0.98] transition-all"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              <span>Isi Saldo</span>
            </button>

            <button
              type="button"
              disabled
              aria-disabled="true"
              className="h-12 rounded-full bg-gray-100 text-gray-400 cursor-not-allowed font-bold text-xs flex flex-col items-center justify-center leading-tight px-2 border border-gray-200/70"
            >
              <span className="inline-flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5" />
                <span>Tarik Sisa Dana</span>
              </span>
              <span className="text-[10px] font-semibold text-gray-400">
                Segera hadir
              </span>
            </button>
          </div>

          {/* Dana Ditahan (Escrow) */}
          <div className="bg-[#EFF4FF] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 border border-blue-100/70">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span className="text-xs font-medium text-gray-600 truncate">
                Dana Ditahan (Tugas Berjalan)
              </span>
            </div>
            <span className="text-xs font-extrabold text-[#0B1C30] shrink-0">
              {formatRupiah(heldAmount)}
            </span>
          </div>
        </section>

        {/* Riwayat Transaksi */}
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-bold text-[#0B1C30] px-0.5">
            Riwayat
          </h3>

          <WalletTransactionList
            role="merchant"
            transactions={transactions}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
            onCheckTopupStatus={(orderId) =>
              void verifyTopupOrder(orderId, { showToastFeedback: true })
            }
            checkingOrderId={checkingOrderId}
          />
        </section>
      </main>

      {/* Bottom Sheet: Isi Saldo */}
      {isTopupSheetOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[#0B1C30]/50 backdrop-blur-[2px] flex items-end justify-center"
          onClick={closeTopupSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="topup-sheet-title"
            className="w-full max-w-[420px] bg-white rounded-t-3xl p-5 pb-8 shadow-2xl border-t border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  id="topup-sheet-title"
                  className="text-base font-extrabold text-[#0B1C30]"
                >
                  Isi Saldo Usaha
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pilih nominal cepat atau masukkan nominal sendiri
                </p>
              </div>
              <button
                type="button"
                onClick={closeTopupSheet}
                disabled={isSubmittingTopup}
                aria-label="Tutup form isi saldo"
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTopupSubmit} className="flex flex-col gap-4">
              {/* Pilihan nominal cepat */}
              <div className="grid grid-cols-2 gap-2.5">
                {QUICK_TOPUP_AMOUNTS.map((preset) => {
                  const isSelected = parsedAmount === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={isSubmittingTopup}
                      onClick={() => {
                        setAmountInput(String(preset))
                        setTopupError(null)
                      }}
                      className={`h-11 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-[#FFEDE0] border-[#FF6B00] text-[#FF6B00]'
                          : 'bg-[#F8F9FF] border-gray-200 text-[#0B1C30] hover:border-orange-200'
                      }`}
                    >
                      {formatRupiah(preset)}
                    </button>
                  )
                })}
              </div>

              {/* Input nominal bebas */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="topup-amount-input"
                  className="text-xs font-bold text-[#0B1C30]"
                >
                  Nominal Isi Saldo
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-bold text-gray-500 pointer-events-none">
                    Rp
                  </span>
                  <input
                    id="topup-amount-input"
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
                      setTopupError(null)
                    }}
                    placeholder="Masukkan nominal (min. 10.000)"
                    disabled={isSubmittingTopup}
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-[#F8F9FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 focus:border-[#FF6B00] text-sm font-bold text-[#0B1C30]"
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Minimal Rp 10.000, maksimal Rp 5.000.000
                </p>
              </div>

              {snapScriptError && !snapReady && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Skrip pembayaran Midtrans gagal dimuat. Periksa koneksi internet kamu lalu muat ulang halaman.
                  </span>
                </div>
              )}

              {topupError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{topupError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingTopup || parsedAmount <= 0}
                className="h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_6px_16px_-4px_rgba(255,107,0,0.35)] active:scale-[0.99] transition-all"
              >
                {isSubmittingTopup && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>{isSubmittingTopup ? 'Memproses...' : 'Lanjut'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
