'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Store,
  ShieldCheck,
  Clock,
  Briefcase,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Lock,
  Banknote,
  TrendingUp,
  Wallet,
  AlertTriangle,
  MessageSquare,
  Star,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/format'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

interface AdminStats {
  students: number
  merchants: number
  pending_verification: number
  verified_users: number
  jobs_open: number
  jobs_in_progress: number
  jobs_completed: number
  jobs_cancelled: number
  escrow_held: number
  paid_to_workers: number
  platform_revenue: number
  pending_withdrawals: number
  pending_withdrawal_amount: number
  no_shows: number
  reviews: number
  avg_rating: number | null
}

function toNumber(val: unknown): number {
  const num = Number(val ?? 0)
  return Number.isFinite(num) ? num : 0
}

export function AdminOverviewView() {
  const supabase = useMemo(() => createClient(), [])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchStats = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true)
        }
        setErrorMsg(null)

        const { data, error } = await supabase.rpc('admin_stats')

        if (error) {
          if (error.code === 'P0001') {
            console.warn('Peringatan saat memuat statistik admin:', error.message)
          } else {
            console.error('Gagal memuat statistik admin:', error)
          }
          setErrorMsg(error.message || 'Gagal memuat ringkasan statistik.')
          return
        }

        if (data && typeof data === 'object') {
          const raw = data as Record<string, unknown>
          setStats({
            students: toNumber(raw.students),
            merchants: toNumber(raw.merchants),
            pending_verification: toNumber(raw.pending_verification),
            verified_users: toNumber(raw.verified_users),
            jobs_open: toNumber(raw.jobs_open),
            jobs_in_progress: toNumber(raw.jobs_in_progress),
            jobs_completed: toNumber(raw.jobs_completed),
            jobs_cancelled: toNumber(raw.jobs_cancelled),
            escrow_held: toNumber(raw.escrow_held),
            paid_to_workers: toNumber(raw.paid_to_workers),
            platform_revenue: toNumber(raw.platform_revenue),
            pending_withdrawals: toNumber(raw.pending_withdrawals),
            pending_withdrawal_amount: toNumber(raw.pending_withdrawal_amount),
            no_shows: toNumber(raw.no_shows),
            reviews: toNumber(raw.reviews),
            avg_rating:
              raw.avg_rating !== null && raw.avg_rating !== undefined
                ? toNumber(raw.avg_rating)
                : null,
          })
        }
      } catch (err) {
        console.error('Kesalahan tak terduga saat memuat ringkasan admin:', err)
        setErrorMsg('Terjadi kesalahan tak terduga saat memuat data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [supabase]
  )

  useEffect(() => {
    let active = true
    const run = async () => {
      const { data, error } = await supabase.rpc('admin_stats')
      if (!active) return

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan saat memuat statistik admin:', error.message)
        } else {
          console.error('Gagal memuat statistik admin:', error)
        }
        setErrorMsg(error.message || 'Gagal memuat ringkasan statistik.')
        setLoading(false)
        return
      }

      if (data && typeof data === 'object') {
        const raw = data as Record<string, unknown>
        setStats({
          students: toNumber(raw.students),
          merchants: toNumber(raw.merchants),
          pending_verification: toNumber(raw.pending_verification),
          verified_users: toNumber(raw.verified_users),
          jobs_open: toNumber(raw.jobs_open),
          jobs_in_progress: toNumber(raw.jobs_in_progress),
          jobs_completed: toNumber(raw.jobs_completed),
          jobs_cancelled: toNumber(raw.jobs_cancelled),
          escrow_held: toNumber(raw.escrow_held),
          paid_to_workers: toNumber(raw.paid_to_workers),
          platform_revenue: toNumber(raw.platform_revenue),
          pending_withdrawals: toNumber(raw.pending_withdrawals),
          pending_withdrawal_amount: toNumber(raw.pending_withdrawal_amount),
          no_shows: toNumber(raw.no_shows),
          reviews: toNumber(raw.reviews),
          avg_rating:
            raw.avg_rating !== null && raw.avg_rating !== undefined
              ? toNumber(raw.avg_rating)
              : null,
        })
      }
      setErrorMsg(null)
      setLoading(false)
    }

    void run().catch((err) => {
      if (!active) return
      console.error('Kesalahan tak terduga saat memuat ringkasan admin:', err)
      setErrorMsg('Terjadi kesalahan tak terduga saat memuat data.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [supabase])

  useAutoRefresh(() => {
    fetchStats(true)
  }, 20000)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight">
            Ringkasan Platform
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Pantau pengguna, lowongan aktif, arus dana escrow, dan metrik operasional.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchStats(true)}
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

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !stats ? (
        <div className="flex flex-col gap-6 animate-pulse">
          {[1, 2, 3, 4].map((group) => (
            <div key={group} className="flex flex-col gap-3">
              <div className="w-32 h-4 rounded bg-gray-200" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[1, 2, 3, 4].map((card) => (
                  <div
                    key={card}
                    className="h-28 rounded-2xl bg-white border border-gray-100"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 1. Kelompok Pengguna */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#0B1C30] uppercase tracking-wider">
              Pengguna
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StatCard
                label="Mahasiswa"
                value={(stats?.students ?? 0).toLocaleString('id-ID')}
                icon={<Users className="w-4.5 h-4.5 text-[#FF6B00]" />}
                iconBg="bg-[#FFEDE0]"
              />
              <StatCard
                label="Merchant"
                value={(stats?.merchants ?? 0).toLocaleString('id-ID')}
                icon={<Store className="w-4.5 h-4.5 text-[#0B1C30]" />}
                iconBg="bg-[#E5EEFF]"
              />
              <StatCard
                label="Terverifikasi"
                value={(stats?.verified_users ?? 0).toLocaleString('id-ID')}
                icon={<ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />}
                iconBg="bg-emerald-50"
              />
              <Link
                href="/admin/verifikasi"
                className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between gap-3 transition-all hover:shadow-sm group ${
                  (stats?.pending_verification ?? 0) > 0
                    ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
                    : 'bg-white border-gray-100 hover:border-[#FF6B00]/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-600">
                    Menunggu Verifikasi
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock className="w-4.5 h-4.5 text-amber-700" />
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span className="text-2xl font-extrabold text-[#0B1C30]">
                    {(stats?.pending_verification ?? 0).toLocaleString('id-ID')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF6B00] group-hover:translate-x-0.5 transition-transform">
                    <span>Tinjau</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            </div>
          </section>

          {/* 2. Kelompok Lowongan */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#0B1C30] uppercase tracking-wider">
              Lowongan
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StatCard
                label="Terbuka"
                value={(stats?.jobs_open ?? 0).toLocaleString('id-ID')}
                icon={<Briefcase className="w-4.5 h-4.5 text-emerald-600" />}
                iconBg="bg-emerald-50"
              />
              <StatCard
                label="Berjalan"
                value={(stats?.jobs_in_progress ?? 0).toLocaleString('id-ID')}
                icon={<PlayCircle className="w-4.5 h-4.5 text-blue-600" />}
                iconBg="bg-blue-50"
              />
              <StatCard
                label="Selesai"
                value={(stats?.jobs_completed ?? 0).toLocaleString('id-ID')}
                icon={<CheckCircle2 className="w-4.5 h-4.5 text-gray-700" />}
                iconBg="bg-gray-100"
              />
              <StatCard
                label="Dibatalkan"
                value={(stats?.jobs_cancelled ?? 0).toLocaleString('id-ID')}
                icon={<XCircle className="w-4.5 h-4.5 text-red-600" />}
                iconBg="bg-red-50"
              />
            </div>
          </section>

          {/* 3. Kelompok Uang */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#0B1C30] uppercase tracking-wider">
              Uang
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StatCard
                label="Dana Ditahan (Escrow)"
                value={formatRupiah(stats?.escrow_held)}
                icon={<Lock className="w-4.5 h-4.5 text-blue-600" />}
                iconBg="bg-blue-50"
              />
              <StatCard
                label="Total Dibayar ke Mahasiswa"
                value={formatRupiah(stats?.paid_to_workers)}
                icon={<Banknote className="w-4.5 h-4.5 text-emerald-600" />}
                iconBg="bg-emerald-50"
              />
              <StatCard
                label="Pendapatan Platform"
                subtitle="Dari biaya layanan"
                value={formatRupiah(stats?.platform_revenue)}
                icon={<TrendingUp className="w-4.5 h-4.5 text-[#FF6B00]" />}
                iconBg="bg-[#FFEDE0]"
              />
              <Link
                href="/admin/penarikan"
                className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between gap-3 transition-all hover:shadow-sm group ${
                  (stats?.pending_withdrawals ?? 0) > 0
                    ? 'bg-orange-50/70 border-orange-200 hover:border-orange-300'
                    : 'bg-white border-gray-100 hover:border-[#FF6B00]/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-600">
                    Penarikan Menunggu
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-[#FFEDE0] flex items-center justify-center shrink-0">
                    <Wallet className="w-4.5 h-4.5 text-[#FF6B00]" />
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold text-[#0B1C30] leading-none">
                      {(stats?.pending_withdrawals ?? 0).toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs font-bold text-[#FF6B00] mt-1 truncate">
                      {formatRupiah(stats?.pending_withdrawal_amount)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF6B00] shrink-0 group-hover:translate-x-0.5 transition-transform">
                    <span>Proses</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            </div>
          </section>

          {/* 4. Kelompok Lainnya */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#0B1C30] uppercase tracking-wider">
              Lainnya
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <StatCard
                label="Tidak Hadir"
                value={(stats?.no_shows ?? 0).toLocaleString('id-ID')}
                icon={<AlertTriangle className="w-4.5 h-4.5 text-red-600" />}
                iconBg="bg-red-50"
              />
              <StatCard
                label="Jumlah Ulasan"
                value={(stats?.reviews ?? 0).toLocaleString('id-ID')}
                icon={<MessageSquare className="w-4.5 h-4.5 text-[#0B1C30]" />}
                iconBg="bg-[#E5EEFF]"
              />
              <StatCard
                label="Rata-rata Rating"
                value={
                  stats?.avg_rating !== null && stats?.avg_rating !== undefined
                    ? `${stats.avg_rating.toFixed(2)} / 5`
                    : '-'
                }
                icon={<Star className="w-4.5 h-4.5 text-amber-500 fill-amber-400" />}
                iconBg="bg-amber-50"
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  subtitle,
  value,
  icon,
  iconBg,
}: {
  label: string
  subtitle?: string
  value: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-600 leading-snug">
            {label}
          </p>
          {subtitle && (
            <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div
          className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
        >
          {icon}
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] truncate">
        {value}
      </p>
    </div>
  )
}
