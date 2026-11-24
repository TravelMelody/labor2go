'use client'

import React, { useState, useEffect, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Briefcase,
  Store,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Timer,
  Zap,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah, formatJobScheduleWIB, formatDurationHours } from '@/lib/format'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

export interface ActivityJob {
  id: string
  title: string
  start_at: string
  end_at: string
  pay_amount: number
  location_name: string | null
  umkm_id: string
  status: string
}

export interface ActivityPayment {
  id: string
  amount: number
  status: 'pending' | 'held' | 'released' | 'refunded'
  created_at: string
}

export interface ActivityApplication {
  id: string
  job_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  checked_in_at: string | null
  checked_out_at: string | null
  created_at: string
  job: ActivityJob
  payment: ActivityPayment | null
  business_name: string
  business_type?: string | null
}

interface StudentActivityViewProps {
  initialApplications: ActivityApplication[]
  initialServerTime: string
}

function formatWibDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatDurationTimer(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function StudentActivityView({
  initialApplications,
  initialServerTime,
}: StudentActivityViewProps) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [applications, setApplications] = useState<ActivityApplication[]>(initialApplications)

  // Sinkronisasi data saat Server Component selesai memuat data baru lewat router.refresh()
  useEffect(() => {
    setApplications(initialApplications)
  }, [initialApplications])

  // Auto-refresh silent lewat router.refresh() yang dibungkus startTransition agar tidak memicu fallback skeleton
  useAutoRefresh(() => {
    startTransition(() => {
      router.refresh()
    })
  }, 20000)
  const serverSkewRef = React.useRef<number>(0)
  const [currentNow, setCurrentNow] = useState<number>(() => {
    const sTime = new Date(initialServerTime).getTime()
    return isNaN(sTime) ? 0 : sTime
  })
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [cancelModalApp, setCancelModalApp] = useState<ActivityApplication | null>(null)

  // Kalibrasi waktu server dan jalankan timer detikan
  useEffect(() => {
    let isMounted = true

    async function syncServerTime() {
      try {
        const clientReqTime = Date.now()
        const res = await fetch('/api/server-time', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const clientResTime = Date.now()
        const roundTrip = clientResTime - clientReqTime
        const serverTime = new Date(data.server_time).getTime()
        if (!isNaN(serverTime) && isMounted) {
          const estimatedSkew = serverTime + roundTrip / 2 - clientResTime
          serverSkewRef.current = estimatedSkew
          setCurrentNow(Date.now() + estimatedSkew)
        }
      } catch {
        // Fallback
      }
    }

    syncServerTime()

    const timer = setInterval(() => {
      setCurrentNow(Date.now() + serverSkewRef.current)
    }, 1000)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [initialServerTime])

  // Auto-dismiss toast setelah 4 detik
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      setToast(null)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // Hitung jumlah tugas selesai & perolehan upah nyata minggu ini (dimulai Senin 00:00 WIB)
  const { completedThisWeekCount, completedThisWeekEarnings } = useMemo(() => {
    const now = new Date(currentNow)
    // Hitung awal hari Senin minggu ini dalam WIB
    const utc = now.getTime() + now.getTimezoneOffset() * 60000
    const wibDate = new Date(utc + 7 * 3600000)
    const day = wibDate.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    wibDate.setDate(wibDate.getDate() - diffToMonday)
    wibDate.setHours(0, 0, 0, 0)
    const startOfWeekUtc = wibDate.getTime() - 7 * 3600000

    let count = 0
    let totalEarnings = 0

    applications.forEach((app) => {
      if (app.payment?.status === 'released') {
        const completionTime = new Date(app.checked_out_at || app.payment.created_at || app.created_at).getTime()
        if (completionTime >= startOfWeekUtc) {
          count += 1
          totalEarnings += Number(app.payment.amount || app.job.pay_amount || 0)
        }
      }
    })

    return {
      completedThisWeekCount: count,
      completedThisWeekEarnings: totalEarnings,
    }
  }, [applications, currentNow])

  // Klasifikasi bagian data
  // 1. "Menunggu Respon": lamaran berstatus pending
  const pendingApplications = useMemo(() => {
    return applications.filter((app) => app.status === 'pending')
  }, [applications])

  // 2. "Sedang Berjalan / Akan Datang": status accepted dan belum ada payments.status 'released'
  const activeApplications = useMemo(() => {
    return applications.filter(
      (app) => app.status === 'accepted' && app.payment?.status !== 'released'
    )
  }, [applications])

  // 3. "Riwayat Selesai": payments.status = 'released' (rejected/withdrawn tidak masuk)
  const completedApplications = useMemo(() => {
    return applications.filter((app) => app.payment?.status === 'released')
  }, [applications])

  // Aksi Check-in
  const handleCheckIn = async (appId: string) => {
    try {
      setProcessingId(appId)
      const { error } = await supabase.rpc('check_in', {
        p_application_id: appId,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan check-in dari database:', error.message)
        } else {
          console.error('Error tak terduga saat check-in:', error)
        }
        setToast({ message: error.message || 'Gagal melakukan check-in', type: 'error' })
        return
      }

      setToast({ message: 'Berhasil check-in! Selamat bekerja.', type: 'success' })
      // Update state lokal optimistik
      const nowIso = new Date(currentNow).toISOString()
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, checked_in_at: nowIso } : a))
      )
      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      console.error('Check-in exception:', err)
      setToast({ message: msg, type: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  // Aksi Check-out
  const handleCheckOut = async (appId: string) => {
    try {
      setProcessingId(appId)
      const { error } = await supabase.rpc('check_out', {
        p_application_id: appId,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan check-out dari database:', error.message)
        } else {
          console.error('Error tak terduga saat check-out:', error)
        }
        setToast({ message: error.message || 'Gagal melakukan check-out', type: 'error' })
        return
      }

      setToast({
        message: 'Berhasil check-out! Menunggu konfirmasi merchant untuk pencairan upah.',
        type: 'success',
      })
      // Update state lokal optimistik
      const nowIso = new Date(currentNow).toISOString()
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, checked_out_at: nowIso } : a))
      )
      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      console.error('Check-out exception:', err)
      setToast({ message: msg, type: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  // Aksi Batalkan Lamaran (pending -> withdrawn)
  const handleConfirmWithdraw = async () => {
    if (!cancelModalApp) return
    const appId = cancelModalApp.id
    try {
      setProcessingId(appId)
      const { error } = await supabase
        .from('applications')
        .update({ status: 'withdrawn' })
        .eq('id', appId)

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan pembatalan lamaran:', error.message)
        } else {
          console.error('Gagal membatalkan lamaran:', error)
        }
        setToast({ message: error.message || 'Gagal membatalkan lamaran', type: 'error' })
        return
      }

      setToast({ message: 'Lamaran berhasil dibatalkan', type: 'info' })
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'withdrawn' } : a))
      )
      setCancelModalApp(null)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      console.error('Withdraw exception:', err)
      setToast({ message: msg, type: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F8F9FF] min-h-screen">
      {/* Top Floating Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[390px] animate-in fade-in slide-in-from-top duration-200">
          <div
            className={`flex items-start gap-2.5 p-3.5 rounded-2xl shadow-lg border text-xs font-semibold backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                : toast.type === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-900'
                : 'bg-blue-50/95 border-blue-200 text-blue-900'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-0.5 hover:opacity-70 text-gray-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#F8F9FF]/95 backdrop-blur-md px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/student"
            aria-label="Kembali ke Beranda"
            className="w-9 h-9 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-[#0B1C30] tracking-tight">
              Tugas Aktif & Riwayat
            </h1>
            <p className="text-[11px] text-gray-500">Pantau shift dan penerimaan upah</p>
          </div>
        </div>
        <Link
          href="/student/explore"
          className="text-xs font-bold text-[#FF6B00] hover:text-[#e05e00] flex items-center gap-0.5"
        >
          <span>Eksplor</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 pt-4 pb-12 flex flex-col gap-5">
        {/* Ringkasan Bento Banner: Performa Minggu Ini (Data Nyata) */}
        <section className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center shrink-0 shadow-inner">
              <Zap className="w-5 h-5 fill-[#FF6B00]" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Performa Minggu Ini
              </p>
              <h2 className="text-sm font-extrabold text-[#0B1C30]">
                {completedThisWeekCount} Tugas Selesai
              </h2>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
              Upah Minggu Ini
            </span>
            <p className="text-sm font-extrabold text-emerald-700 mt-0.5">
              {formatRupiah(completedThisWeekEarnings)}
            </p>
          </div>
        </section>

        {/* ======================================================== */}
        {/* BAGIAN 1: SEDANG BERJALAN / AKAN DATANG */}
        {/* ======================================================== */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#0B1C30]">Sedang Berjalan / Akan Datang</h2>
              <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
            </div>
            <span className="text-xs font-bold text-gray-400">
              {activeApplications.length} Pekerjaan
            </span>
          </div>

          {activeApplications.length === 0 ? (
            <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-xs text-center flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mb-2.5">
                <Briefcase className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h3 className="text-xs font-bold text-[#0B1C30] mb-1">
                Tidak Ada Tugas yang Sedang Berjalan
              </h3>
              <p className="text-[11px] text-gray-500 max-w-xs leading-relaxed mb-3">
                Lamaran kamu yang telah diterima merchant akan otomatis muncul di sini untuk proses check-in.
              </p>
              <Link
                href="/student/explore"
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#FF6B00] text-white text-xs font-bold shadow-sm active:scale-95 transition-transform"
              >
                <span>Cari Lowongan</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {activeApplications.map((app) => {
                const startTime = new Date(app.job.start_at).getTime()
                const checkInAllowedTime = startTime - 30 * 60 * 1000 // 30 menit sebelum mulai
                const isCheckInOpen = currentNow >= checkInAllowedTime
                const isWorking = Boolean(app.checked_in_at && !app.checked_out_at)
                const isCheckedOut = Boolean(app.checked_out_at)
                const isProcessing = processingId === app.id

                // Hitung durasi lama bekerja secara real-time dari checked_in_at
                let activeDurationSeconds = 0
                if (isWorking && app.checked_in_at) {
                  const checkInTime = new Date(app.checked_in_at).getTime()
                  activeDurationSeconds = Math.max(0, Math.floor((currentNow - checkInTime) / 1000))
                }

                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 relative overflow-hidden flex flex-col"
                  >
                    {/* Top Active Glow Accent */}
                    {isWorking && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500 animate-pulse" />
                    )}

                    {/* Header Kartu: Status Indikator + Timer */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {isWorking ? (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                          </span>
                        ) : isCheckedOut ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                        )}
                        <span
                          className={`text-xs font-bold ${
                            isWorking
                              ? 'text-emerald-700'
                              : isCheckedOut
                              ? 'text-blue-700'
                              : 'text-[#FF6B00]'
                          }`}
                        >
                          {isWorking
                            ? 'Sedang Bekerja'
                            : isCheckedOut
                            ? 'Selesai Bertugas'
                            : isCheckInOpen
                            ? 'Siap Check-in'
                            : 'Akan Datang'}
                        </span>
                      </div>

                      {/* Pill Timer / Status Kanan */}
                      {isWorking ? (
                        <div className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          <span>Shift Aktif • {formatDurationTimer(activeDurationSeconds)}</span>
                        </div>
                      ) : isCheckedOut ? (
                        <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                          Menunggu Konfirmasi
                        </span>
                      ) : (
                        <span className="bg-orange-50 text-[#FF6B00] text-[11px] font-bold px-2.5 py-1 rounded-full">
                          Diterima
                        </span>
                      )}
                    </div>

                    {/* Judul & Nama Usaha */}
                    <Link
                      href={`/jobs/${app.job.id}`}
                      className="group flex flex-col mb-2.5"
                    >
                      <h3 className="text-sm font-bold text-[#0B1C30] group-hover:text-[#FF6B00] transition-colors line-clamp-1">
                        {app.job.title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 text-gray-500">
                        <Store className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                        <span className="text-xs font-medium truncate">{app.business_name}</span>
                        {app.job.location_name && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-gray-400 truncate max-w-[120px]">
                              {app.job.location_name}
                            </span>
                          </>
                        )}
                      </div>
                    </Link>

                    {/* Jadwal dan Upah Box */}
                    <div className="bg-gray-50/80 rounded-xl p-2.5 flex items-center justify-between text-xs mb-3 border border-gray-100/60">
                      <div className="flex items-center gap-1.5 text-gray-600 truncate pr-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          {formatJobScheduleWIB(app.job.start_at, app.job.end_at)} (
                          {formatDurationHours(app.job.start_at, app.job.end_at)})
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-[#0B1C30]">
                          {formatRupiah(app.job.pay_amount)}
                        </span>
                      </div>
                    </div>

                    {/* Tombol Aksi Sesuai Kondisi */}
                    <div>
                      {!app.checked_in_at ? (
                        !isCheckInOpen ? (
                          /* Kondisi 1: Belum check-in dan sebelum (start_at - 30 menit) -> Nonaktif */
                          <button
                            type="button"
                            disabled
                            className="w-full h-11 rounded-full bg-gray-100 text-gray-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed border border-gray-200/60"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Check-in dibuka 30 menit sebelum mulai</span>
                          </button>
                        ) : (
                          /* Kondisi 2: Bisa check-in -> Tombol Aktif Check-in Sekarang */
                          <button
                            type="button"
                            onClick={() => handleCheckIn(app.id)}
                            disabled={isProcessing}
                            className="w-full h-11 rounded-full bg-[#FF6B00] hover:bg-[#e05e00] text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Memproses Check-in...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 fill-white" />
                                <span>Check-in Sekarang</span>
                              </>
                            )}
                          </button>
                        )
                      ) : !app.checked_out_at ? (
                        /* Kondisi 3: Sudah check-in, belum check-out -> Selesai & Check-out */
                        <button
                          type="button"
                          onClick={() => handleCheckOut(app.id)}
                          disabled={isProcessing}
                          className="w-full h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Memproses Check-out...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Selesai &amp; Check-out</span>
                            </>
                          )}
                        </button>
                      ) : (
                        /* Kondisi 4: Sudah check-out -> Menunggu konfirmasi merchant (nonaktif) */
                        <button
                          type="button"
                          disabled
                          className="w-full h-11 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Menunggu konfirmasi merchant</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* BAGIAN 2: MENUNGGU RESPON (Lamaran Pending) */}
        {/* ======================================================== */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#0B1C30]">Menunggu Respon</h2>
              <span className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                {pendingApplications.length}
              </span>
            </div>
            <span className="text-xs text-gray-400">Belum diputuskan</span>
          </div>

          {pendingApplications.length === 0 ? (
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-xs text-center text-xs text-gray-500 py-6">
              Tidak ada lamaran yang sedang menunggu respon merchant.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingApplications.map((app) => (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl p-3.5 shadow-xs border border-gray-100 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <Link
                        href={`/jobs/${app.job.id}`}
                        className="text-xs font-bold text-[#0B1C30] hover:text-[#FF6B00] transition-colors truncate"
                      >
                        {app.job.title}
                      </Link>
                      <span className="text-[11px] text-gray-500 truncate mt-0.5">
                        {app.business_name}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1C30] shrink-0">
                      {formatRupiah(app.job.pay_amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">
                        {formatJobScheduleWIB(app.job.start_at, app.job.end_at)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCancelModalApp(app)}
                      disabled={processingId === app.id}
                      className="text-red-600 hover:text-red-700 font-bold underline active:opacity-75 disabled:opacity-50 shrink-0"
                    >
                      Batalkan lamaran
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* BAGIAN 3: RIWAYAT SELESAI (payments.status === 'released') */}
        {/* ======================================================== */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#0B1C30]">Riwayat Selesai</h2>
              <span className="text-[11px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {completedApplications.length} Tugas
              </span>
            </div>
          </div>

          {completedApplications.length === 0 ? (
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-xs text-center text-xs text-gray-500 py-6">
              Belum ada riwayat pekerjaan yang selesai dan dicairkan.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {completedApplications.map((app) => {
                const completionDate = app.checked_out_at || app.payment?.created_at || app.created_at
                const dateText = formatWibDate(completionDate)
                const durationText = formatDurationHours(app.job.start_at, app.job.end_at)
                const paidAmount = app.payment?.amount || app.job.pay_amount

                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl p-3.5 shadow-xs border border-gray-100 flex items-center justify-between gap-3 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#0B1C30] truncate">
                          {app.job.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 truncate">{app.business_name}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{dateText}</span>
                          <span>•</span>
                          <span>{durationText}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-1">
                      <p className="text-xs font-extrabold text-emerald-700">
                        + {formatRupiah(paidAmount)}
                      </p>
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-1">
                        Selesai
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Community Delight Note / Jaminan Saldo */}
        <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#0B1C30]">Saldo Terkumpul Langsung Masuk</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Upah disalurkan langsung ke dompet Anda saat merchant mengonfirmasi penyelesaian tugas.
            </p>
          </div>
        </div>
      </main>

      {/* Modal Konfirmasi Pembatalan Lamaran */}
      {cancelModalApp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-gray-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B1C30]">Batalkan Lamaran?</h3>
              <button
                type="button"
                onClick={() => setCancelModalApp(null)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Apakah Anda yakin ingin membatalkan lamaran untuk pekerjaan{' '}
              <strong className="text-[#0B1C30] font-bold">{cancelModalApp.job.title}</strong> di{' '}
              <strong className="text-[#0B1C30] font-bold">{cancelModalApp.business_name}</strong>?
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCancelModalApp(null)}
                className="flex-1 h-10 rounded-full border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 active:scale-95 transition-all"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdraw}
                disabled={processingId === cancelModalApp.id}
                className="flex-1 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {processingId === cancelModalApp.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Ya, Batalkan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
