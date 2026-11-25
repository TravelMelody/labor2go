'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Wallet,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Info,
  RefreshCw,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatFullDateTimeWIB, formatRupiah } from '@/lib/format'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

type WithdrawalStatus = 'pending' | 'processed' | 'rejected'

interface ProfileSnippet {
  full_name: string | null
  phone: string | null
}

interface RawWithdrawalRow {
  id: string
  user_id: string
  amount: number | string
  destination_type: string
  destination_account: string
  status: WithdrawalStatus
  created_at: string
  processed_at: string | null
  profiles: ProfileSnippet | ProfileSnippet[] | null
}

interface WithdrawalItem {
  id: string
  user_id: string
  amount: number
  destination_type: string
  destination_account: string
  status: WithdrawalStatus
  created_at: string
  processed_at: string | null
  student_name: string
  student_phone: string | null
}

function pickOne<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return val[0] ?? null
  return val ?? null
}

function formatDestinationType(type: string): string {
  switch (type.toLowerCase()) {
    case 'gopay':
      return 'GoPay'
    case 'dana':
      return 'DANA'
    case 'ovo':
      return 'OVO'
    case 'shopeepay':
      return 'ShopeePay'
    case 'bank':
      return 'Bank'
    default:
      return type.toUpperCase()
  }
}

const TABS: { key: WithdrawalStatus; label: string }[] = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'processed', label: 'Diproses' },
  { key: 'rejected', label: 'Ditolak' },
]

export function AdminWithdrawalsView() {
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<WithdrawalStatus>('pending')
  const [items, setItems] = useState<WithdrawalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [confirmState, setConfirmState] = useState<{
    item: WithdrawalItem
    approve: boolean
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlightRef = useRef(false)

  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const queryWithdrawals = useCallback(
    async (tab: WithdrawalStatus) => {
      const { data, error } = await supabase
        .from('withdrawals')
        .select(
          'id, user_id, amount, destination_type, destination_account, status, created_at, processed_at, profiles(full_name, phone)'
        )
        .eq('status', tab)
        .order('created_at', { ascending: tab === 'pending' })

      if (error) {
        return { data: null, error }
      }

      const rows = (data ?? []) as unknown as RawWithdrawalRow[]
      const mapped: WithdrawalItem[] = rows.map((row) => {
        const prof = pickOne(row.profiles)
        return {
          id: row.id,
          user_id: row.user_id,
          amount: Number(row.amount ?? 0),
          destination_type: row.destination_type,
          destination_account: row.destination_account,
          status: row.status,
          created_at: row.created_at,
          processed_at: row.processed_at,
          student_name: prof?.full_name?.trim() || 'Mahasiswa',
          student_phone: prof?.phone ?? null,
        }
      })

      return { data: mapped, error: null }
    },
    [supabase]
  )

  const fetchWithdrawals = useCallback(
    async (tab: WithdrawalStatus, silent = false) => {
      try {
        if (!silent) {
          setLoading(true)
        } else {
          setRefreshing(true)
        }
        setFetchError(null)

        const { data, error } = await queryWithdrawals(tab)

        if (error) {
          if (error.code === 'P0001') {
            console.warn('Peringatan saat memuat penarikan:', error.message)
          } else {
            console.error('Gagal memuat daftar penarikan:', error)
          }
          setFetchError(error.message || 'Gagal memuat data penarikan.')
          return
        }

        if (data) {
          setItems(data)
        }
      } catch (err) {
        console.error('Kesalahan tak terduga saat memuat penarikan:', err)
        setFetchError('Terjadi kesalahan tak terduga saat memuat data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [queryWithdrawals]
  )

  useEffect(() => {
    let active = true
    const run = async () => {
      const { data, error } = await queryWithdrawals(activeTab)
      if (!active) return

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan saat memuat penarikan:', error.message)
        } else {
          console.error('Gagal memuat daftar penarikan:', error)
        }
        setFetchError(error.message || 'Gagal memuat data penarikan.')
        setLoading(false)
        return
      }

      setFetchError(null)
      setItems(data ?? [])
      setLoading(false)
    }

    void run().catch((err) => {
      if (!active) return
      console.error('Kesalahan tak terduga saat memuat penarikan:', err)
      setFetchError('Terjadi kesalahan tak terduga saat memuat data.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [activeTab, queryWithdrawals])

  useAutoRefresh(() => {
    if (activeTab === 'pending') {
      fetchWithdrawals('pending', true)
    }
  }, 20000)

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev))
      }, 2000)
    } catch {
      setToast({
        type: 'error',
        message: 'Gagal menyalin nomor tujuan ke clipboard.',
      })
    }
  }

  const handleConfirmResolve = async () => {
    if (!confirmState || inFlightRef.current) return
    inFlightRef.current = true
    setSubmitting(true)
    setActionError(null)

    const { item, approve } = confirmState

    try {
      const { error } = await supabase.rpc('resolve_withdrawal', {
        p_withdrawal_id: item.id,
        p_approve: approve,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Validasi penarikan:', error.message)
        } else {
          console.error('Gagal memproses penarikan:', error)
        }
        setActionError(error.message || 'Gagal memproses permintaan penarikan.')
        return
      }

      setItems((prev) => prev.filter((row) => row.id !== item.id))
      setConfirmState(null)
      setToast({
        type: 'success',
        message: approve
          ? `Penarikan ${formatRupiah(item.amount)} untuk ${item.student_name} ditandai sudah ditransfer.`
          : `Penarikan ${formatRupiah(item.amount)} ditolak dan saldo dikembalikan ke ${item.student_name}.`,
      })
    } catch (err) {
      console.error('Kesalahan tak terduga saat memproses penarikan:', err)
      setActionError('Terjadi kesalahan sistem saat memproses penarikan.')
    } finally {
      inFlightRef.current = false
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: WithdrawalStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Menunggu
          </span>
        )
      case 'processed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Diproses
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            Ditolak
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm p-3.5 rounded-2xl border shadow-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <p className="text-xs font-semibold flex-1 leading-relaxed">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight">
            Permintaan Penarikan Dana
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Proses pencairan saldo mahasiswa atau tolak untuk mengembalikan saldo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchWithdrawals(activeTab, true)}
          disabled={loading || refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#0B1C30] hover:bg-gray-50 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#FF6B00] ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Catatan Simulasi Transfer Manual */}
      <div className="px-4 py-3 rounded-2xl bg-[#EFF4FF] border border-blue-100 text-xs text-[#0B1C30] flex items-center gap-2.5">
        <Info className="w-4 h-4 text-[#FF6B00] shrink-0" />
        <span className="font-medium">
          Transfer dilakukan manual di luar aplikasi (simulasi)
        </span>
      </div>

      {/* Tabs */}
      <div className="inline-flex p-1 bg-white rounded-2xl border border-gray-100 shadow-xs self-start">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (tab.key !== activeTab) {
                  setLoading(true)
                  setActiveTab(tab.key)
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'text-gray-600 hover:text-[#0B1C30]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Table / Empty / Loading */}
      {loading ? (
        <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-gray-100 shadow-xs text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-3">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B1C30]">
            Tidak ada penarikan pada tab {TABS.find((t) => t.key === activeTab)?.label}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Permintaan penarikan mahasiswa dengan status ini akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8F9FF]/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Waktu WIB</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Mahasiswa</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Jumlah</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Tujuan</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                  {activeTab === 'pending' && (
                    <th className="py-3.5 px-4 whitespace-nowrap text-right">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F8F9FF]/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-600">
                      {formatFullDateTimeWIB(item.created_at)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-bold text-[#0B1C30]">
                        {item.student_name}
                      </p>
                      {item.student_phone && (
                        <p className="text-[11px] text-gray-500">
                          {item.student_phone}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-extrabold text-[#0B1C30]">
                      {formatRupiah(item.amount)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#E5EEFF] text-[#0B1C30] text-[11px] font-bold">
                          {formatDestinationType(item.destination_type)}
                        </span>
                        <span className="font-mono text-xs font-semibold text-gray-700">
                          {item.destination_account}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(item.id, item.destination_account)
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition-colors cursor-pointer"
                          title="Salin nomor tujuan"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(item.status)}
                        {item.processed_at && item.status !== 'pending' && (
                          <span className="text-[10px] text-gray-400">
                            {formatFullDateTimeWIB(item.processed_at)}
                          </span>
                        )}
                      </div>
                    </td>
                    {activeTab === 'pending' && (
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null)
                              setConfirmState({ item, approve: true })
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            Tandai Sudah Ditransfer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null)
                              setConfirmState({ item, approve: false })
                            }}
                            className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Transfer / Tolak */}
      {confirmState && (
        <div
          onClick={() => !submitting && setConfirmState(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmState.approve
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {confirmState.approve ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B1C30]">
                  {confirmState.approve
                    ? 'Tandai Sudah Ditransfer?'
                    : 'Tolak Penarikan Dana?'}
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {confirmState.approve
                    ? 'Pastikan kamu sudah mentransfer manual sebelum melanjutkan.'
                    : 'Saldo akan dikembalikan ke mahasiswa.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F9FF] border border-gray-100 text-xs flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Mahasiswa</span>
                <span className="font-bold text-[#0B1C30]">
                  {confirmState.item.student_name}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Nominal</span>
                <span className="font-extrabold text-[#FF6B00]">
                  {formatRupiah(confirmState.item.amount)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Tujuan</span>
                <span className="font-semibold text-[#0B1C30]">
                  {formatDestinationType(confirmState.item.destination_type)} •{' '}
                  {confirmState.item.destination_account}
                </span>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmState(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmResolve}
                className={`px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer ${
                  confirmState.approve
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {confirmState.approve
                    ? 'Ya, Sudah Ditransfer'
                    : 'Ya, Tolak & Kembalikan'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
