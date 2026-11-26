'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Radio,
  Loader2,
  PlusCircle,
  AlertCircle,
  AlertTriangle,
  Ban,
  X,
  Check,
  ChevronRight,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah, formatJobScheduleWIB, getFirstName } from '@/lib/format'
import { SERVICE_FEE_PER_WORKER } from '@/lib/pricing'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

interface PaymentItem {
  id: string
  amount: number
  commission: number
  status: 'pending' | 'held' | 'released' | 'refunded'
}

interface ApplicationItem {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  student_id: string
  payments?: PaymentItem[] | PaymentItem | null
  student?: {
    id?: string
    full_name?: string | null
  } | null
}

interface RawApplicationRow {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  student_id: string
  payments?: PaymentItem[] | PaymentItem | null
}

interface RawJobRow {
  id: string
  title: string
  description: string | null
  location_name: string | null
  start_at: string
  end_at: string
  pay_amount: number
  slots: number
  status: 'open' | 'filled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  applications?: RawApplicationRow[] | null
}

interface JobItem {
  id: string
  title: string
  description: string | null
  location_name: string | null
  start_at: string
  end_at: string
  pay_amount: number
  slots: number
  status: 'open' | 'filled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  applications?: ApplicationItem[]
}

export default function MerchantJobsManagePage() {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [serviceFee, setServiceFee] = useState<number>(SERVICE_FEE_PER_WORKER)

  // Cancel Modal State
  const [selectedJobForCancel, setSelectedJobForCancel] = useState<JobItem | null>(null)
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)
  const [cancelActionError, setCancelActionError] = useState<string | null>(null)

  // Toast State
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message })
    setTimeout(() => {
      setToast(null)
    }, 5000)
  }

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      // 1. Verifikasi User & Proteksi Role UMKM
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login?redirectTo=/merchant/jobs')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const role = profile?.role || user.user_metadata?.role
      if (role !== 'umkm') {
        router.replace('/student')
        return
      }

      // 2. Baca biaya layanan dari platform_settings (key: service_fee_per_worker)
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('int_value')
        .eq('key', 'service_fee_per_worker')
        .maybeSingle()

      if (settingsData?.int_value != null) {
        setServiceFee(Number(settingsData.int_value))
      }

      // 3. Ambil data jobs milik user beserta applications dan payments
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(
          `id,
           title,
           description,
           location_name,
           start_at,
           end_at,
           pay_amount,
           slots,
           status,
           created_at,
           applications (
             id,
             status,
             student_id,
             payments (
               id,
               amount,
               commission,
               status
             )
           )`
        )
        .eq('umkm_id', user.id)
        .order('created_at', { ascending: false })

      if (jobsError) {
        console.error('Error saat membaca jobs merchant:', jobsError)
      } else if (jobsData) {
        const rawJobs = jobsData as RawJobRow[]
        // Kumpulkan student_id dari lamaran berstatus accepted untuk mengambil nama mahasiswa
        const studentIds = new Set<string>()
        rawJobs.forEach((j) => {
          if (Array.isArray(j.applications)) {
            j.applications.forEach((a) => {
              if (a.status === 'accepted' && a.student_id) {
                studentIds.add(a.student_id)
              }
            })
          }
        })

        let studentProfileMap: Record<string, string> = {}
        if (studentIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', Array.from(studentIds))

          if (profilesData) {
            studentProfileMap = (profilesData as Array<{ id: string; full_name: string | null }>).reduce(
              (acc, curr) => {
                acc[curr.id] = curr.full_name || 'Mahasiswa'
                return acc
              },
              {} as Record<string, string>
            )
          }
        }

        // Pasangkan data student ke applications
        const mappedJobs: JobItem[] = rawJobs.map((j) => {
          const apps: ApplicationItem[] = (j.applications || []).map(
            (app) => ({
              id: app.id,
              status: app.status,
              student_id: app.student_id,
              payments: app.payments,
              student: {
                id: app.student_id,
                full_name: studentProfileMap[app.student_id] || null,
              },
            })
          )

          return {
            id: j.id,
            title: j.title,
            description: j.description,
            location_name: j.location_name,
            start_at: j.start_at,
            end_at: j.end_at,
            pay_amount: j.pay_amount,
            slots: j.slots,
            status: j.status,
            created_at: j.created_at,
            applications: apps,
          }
        })

        setJobs(mappedJobs)
      }
    } catch (err) {
      console.error('Error saat load merchant jobs:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [loadData])

  // Sinkronisasi otomatis tiap 20 detik & saat tab kembali fokus tanpa indikator loading berkedip
  useAutoRefresh(() => {
    loadData(true)
  }, 20000)

  // Handle pembatalan lowongan via RPC cancel_job
  const handleConfirmCancelJob = async () => {
    if (!selectedJobForCancel || isSubmittingCancel) return
    setIsSubmittingCancel(true)
    setCancelActionError(null)

    try {
      const { error } = await supabase.rpc('cancel_job', {
        p_job_id: selectedJobForCancel.id,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan cancel_job dari database:', error.message)
        } else {
          console.error('Error saat cancel_job:', error)
        }
        setCancelActionError(error.message)
        return
      }

      const cancelledTitle = selectedJobForCancel.title
      setSelectedJobForCancel(null)
      showToast(`Lowongan "${cancelledTitle}" berhasil dibatalkan.`, 'info')

      // Refresh data lowongan
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      console.error('Cancel job exception:', err)
      setCancelActionError(msg)
    } finally {
      setIsSubmittingCancel(false)
    }
  }

  // Filter Jobs:
  // Aktif = status 'open', 'filled', 'in_progress'
  // Riwayat = status 'completed', 'cancelled'
  const activeJobs = jobs.filter(
    (j) =>
      j.status === 'open' || j.status === 'filled' || j.status === 'in_progress'
  )
  const historyJobs = jobs.filter(
    (j) => j.status === 'completed' || j.status === 'cancelled'
  )

  const currentList = activeTab === 'active' ? activeJobs : historyJobs

  if (loading) {
    return (
      <div className="flex-1 flex flex-col w-full pb-24 bg-[#F8F9FF] animate-pulse">
        <div className="h-14 px-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div className="w-32 h-5 rounded bg-gray-200" />
          <div className="w-24 h-5 rounded bg-gray-200" />
        </div>
        <div className="bg-white px-4 py-2.5 border-b border-gray-100 mb-3">
          <div className="h-10 rounded-full bg-gray-100" />
        </div>
        <div className="px-4 flex flex-col gap-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-white border border-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col w-full pb-24 bg-[#F8F9FF]">
      {/* Toast Notification */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[400px] p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-800 text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <Check className="w-5 h-5 flex-shrink-0" />}
            <span className="leading-snug">{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-full hover:bg-white/20 active:scale-95 transition-all"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between">
          <h1 className="text-base font-bold text-[#0B1C30] tracking-tight">
            Kelola Lowongan
          </h1>
          <Link
            href="/merchant/post"
            className="text-xs font-bold text-[#FF6B00] hover:text-[#E05E00] flex items-center gap-1 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Pasang Baru</span>
          </Link>
        </div>
      </header>

      {/* Sticky Pill Tab Switcher Card */}
      <section className="sticky top-14 z-30 w-full bg-white px-4 py-2.5 border-b border-gray-100 shadow-xs mb-3">
        <div
          className="bg-[#EFF4FF] p-1 rounded-full flex items-center justify-between gap-1"
          role="tablist"
        >
          {/* Tab Aktif */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'active'}
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
              activeTab === 'active'
                ? 'bg-[#0B1C30] text-white shadow-sm'
                : 'bg-transparent text-slate-500 hover:text-[#0B1C30]'
            }`}
          >
            <span>Aktif</span>
            <span
              className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                activeTab === 'active'
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activeJobs.length}
            </span>
          </button>

          {/* Tab Riwayat */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
              activeTab === 'history'
                ? 'bg-[#0B1C30] text-white shadow-sm'
                : 'bg-transparent text-slate-500 hover:text-[#0B1C30]'
            }`}
          >
            <span>Riwayat</span>
            <span
              className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                activeTab === 'history'
                  ? 'bg-[#0B1C30] text-white ring-1 ring-white/20'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {historyJobs.length}
            </span>
          </button>
        </div>
      </section>

      {/* Main List Container */}
      <main className="px-4 flex flex-col gap-3.5">
        {currentList.length === 0 ? (
          /* Empty State */
          <div className="p-8 rounded-3xl bg-white border border-gray-100 shadow-xs text-center flex flex-col items-center justify-center my-6">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF4FF] text-[#0B1C30] flex items-center justify-center mb-3">
              {activeTab === 'active' ? (
                <Briefcase className="w-7 h-7 text-[#FF6B00]" />
              ) : (
                <Clock className="w-7 h-7 text-slate-400" />
              )}
            </div>

            <h3 className="text-sm font-bold text-[#0B1C30] mb-1">
              {activeTab === 'active'
                ? 'Belum ada lowongan aktif'
                : 'Belum ada riwayat lowongan'}
            </h3>

            <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-5">
              {activeTab === 'active'
                ? 'Pasang lowongan bantuan dadakan pertama Anda untuk mendapatkan tenaga kerja dari mahasiswa terdekat.'
                : 'Lowongan yang telah selesai atau dibatalkan akan otomatis tersimpan rapi di sini.'}
            </p>

            {activeTab === 'active' ? (
              <Link
                href="/merchant/post"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E05E00] shadow-md shadow-orange-500/20 active:scale-95 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Pasang Lowongan Sekarang</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 active:scale-95 transition-all"
              >
                <span>Lihat Lowongan Aktif</span>
              </button>
            )}
          </div>
        ) : (
          /* List Kartu Lowongan */
          currentList.map((job) => {
            const apps = job.applications || []
            const pendingApps = apps.filter((a) => a.status === 'pending')
            const acceptedApps = apps.filter((a) => a.status === 'accepted')

            const pendingCount = pendingApps.length
            const acceptedCount = acceptedApps.length

            // Total dana alokasi: (pay_amount + biaya layanan) x slots
            const totalEstimasi = (job.pay_amount + serviceFee) * job.slots

            // Accepted worker names
            const acceptedWorkerNames = acceptedApps
              .map((a) => getFirstName(a.student?.full_name))
              .filter(Boolean)

            return (
              <article
                key={job.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 flex flex-col gap-3 relative overflow-hidden transition-all hover:border-gray-200"
              >
                {/* Accent border kiri jika sedang berjalan */}
                {job.status === 'in_progress' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                )}

                {/* Top Row: Judul & Badge Status */}
                <div
                  className={`flex items-start justify-between gap-2 ${
                    job.status === 'in_progress' ? 'pl-1.5' : ''
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <h2 className="text-base font-bold text-[#0B1C30] truncate">
                      {job.title}
                    </h2>
                    {job.location_name && (
                      <span className="text-[11px] text-gray-500 truncate">
                        {job.location_name}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  {job.status === 'open' && (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-orange-50 text-[#FF6B00] border border-orange-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                      <Radio className="w-3.5 h-3.5 animate-pulse text-[#FF6B00]" />
                      <span>Mencari Pekerja</span>
                    </span>
                  )}

                  {job.status === 'filled' && (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Terisi</span>
                    </span>
                  )}

                  {job.status === 'in_progress' && (
                    <span className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Sedang Berjalan</span>
                    </span>
                  )}

                  {job.status === 'completed' && (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Selesai</span>
                    </span>
                  )}

                  {job.status === 'cancelled' && (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>Dibatalkan</span>
                    </span>
                  )}
                </div>

                {/* Middle Row: Informasi status spesifik */}
                {/* 1. Kondisi status = 'open' */}
                {job.status === 'open' && (
                  <div className="bg-[#EFF4FF]/60 rounded-xl p-2.5 flex items-center justify-between text-xs border border-blue-50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#0B1C30]">
                          {pendingCount > 0
                            ? `${pendingCount} pelamar menunggu review`
                            : 'Belum ada pelamar'}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Slot terisi {acceptedCount}/{job.slots}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Kondisi status = 'filled' */}
                {job.status === 'filled' && (
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-blue-950">
                          Pekerja lengkap, menunggu hari H
                        </span>
                        <span className="text-[11px] text-blue-700">
                          Slot terisi {acceptedCount}/{job.slots}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Kondisi status = 'in_progress' */}
                {job.status === 'in_progress' && (
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 flex items-center justify-between text-xs ml-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white text-emerald-700 flex items-center justify-center shrink-0 shadow-xs border border-emerald-200">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[#0B1C30] truncate">
                          {acceptedWorkerNames.length > 0
                            ? `Dikerjakan oleh ${acceptedWorkerNames.join(', ')}`
                            : 'Sedang dikerjakan oleh mahasiswa terpilih'}
                        </span>
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Tugas sedang berjalan aktif
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Kondisi status = 'completed' di Riwayat */}
                {job.status === 'completed' && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-white text-gray-600 flex items-center justify-center shrink-0 shadow-xs">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-gray-700 truncate">
                        {acceptedWorkerNames.length > 0
                          ? `Dikerjakan oleh ${acceptedWorkerNames.join(', ')}`
                          : 'Tugas telah selesai'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Jadwal Pekerjaan WIB */}
                <div
                  className={`flex items-center gap-1.5 text-xs text-gray-600 ${
                    job.status === 'in_progress' ? 'pl-1.5' : ''
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                  <span className="font-medium">
                    {formatJobScheduleWIB(job.start_at, job.end_at)}
                  </span>
                </div>

                {/* Card Footer: Alokasi Dana & Tombol Aksi */}
                <div
                  className={`pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 ${
                    job.status === 'in_progress' ? 'pl-1.5' : ''
                  }`}
                >
                  {/* Bagian Total Dana */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-medium">
                      {job.status === 'completed'
                        ? 'Telah Dicairkan'
                        : job.status === 'cancelled'
                        ? 'Dana Dikembalikan'
                        : 'Alokasi Dana'}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        job.status === 'completed'
                          ? 'text-gray-500 line-through'
                          : job.status === 'cancelled'
                          ? 'text-gray-400'
                          : 'text-[#0B1C30]'
                      }`}
                    >
                      Total: {formatRupiah(totalEstimasi)}
                    </span>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-2">
                    {/* Tombol Batalkan (Hanya untuk aktif status open / filled) */}
                    {activeTab === 'active' &&
                      (job.status === 'open' || job.status === 'filled') && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelActionError(null)
                            setSelectedJobForCancel(job)
                          }}
                          disabled={isSubmittingCancel}
                          className="px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Batalkan</span>
                        </button>
                      )}

                    {/* Tombol Kelola / Lihat Pelamar */}
                    <Link
                      href={`/merchant/jobs/${job.id}`}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E05E00] shadow-sm shadow-orange-500/20 active:scale-95 transition-all"
                    >
                      <span>
                        {activeTab === 'active'
                          ? 'Kelola Pelamar'
                          : 'Lihat Detail'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </main>

      {/* Modal Konfirmasi Batalkan Lowongan dari Kartu Daftar */}
      {selectedJobForCancel &&
        (() => {
          const acceptedApps =
            selectedJobForCancel.applications?.filter(
              (a) => a.status === 'accepted'
            ) || []
          const heldRefundAmount = acceptedApps.reduce((acc, app) => {
            const pList = Array.isArray(app.payments)
              ? app.payments
              : app.payments
              ? [app.payments]
              : []
            const heldPay = pList.find((p) => p.status === 'held')
            if (heldPay) {
              return acc + heldPay.amount + heldPay.commission
            }
            return acc + selectedJobForCancel.pay_amount + serviceFee
          }, 0)

          return (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
            >
              <div className="w-full max-w-[390px] bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-5 duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                      <Ban className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <h3 className="text-base font-extrabold text-[#0B1C30]">
                      Batalkan Lowongan
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedJobForCancel(null)}
                    disabled={isSubmittingCancel}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Lowongan Info */}
                <div className="bg-gray-50 rounded-2xl p-3.5 mb-3.5 border border-gray-100 text-xs">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
                    Lowongan yang Dibatalkan
                  </span>
                  <p className="text-sm font-bold text-gray-900">
                    {selectedJobForCancel.title}
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    {formatJobScheduleWIB(
                      selectedJobForCancel.start_at,
                      selectedJobForCancel.end_at
                    )}
                  </p>
                </div>

                {/* Informasi Pengembalian Dana */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 mb-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Pengembalian Dana Pembatalan</span>
                  </div>
                  {heldRefundAmount > 0 ? (
                    <p className="leading-relaxed">
                      Dana penahanan escrow sebesar{' '}
                      <strong className="text-amber-900 font-extrabold text-sm">
                        {formatRupiah(heldRefundAmount)}
                      </strong>{' '}
                      akan dikembalikan sepenuhnya ke saldo dompetmu.
                    </p>
                  ) : (
                    <p className="leading-relaxed">
                      Belum ada pekerja yang diterima untuk lowongan ini, sehingga
                      tidak ada potongan saldo yang ditahan ({formatRupiah(0)}{' '}
                      dikembalikan).
                    </p>
                  )}
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Pekerja yang telah diterima akan dibatalkan, dan pelamar
                    lainnya akan otomatis ditolak.
                  </p>
                </div>

                {/* Error Message jika ada */}
                {cancelActionError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 mb-3.5 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">
                      {cancelActionError}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setSelectedJobForCancel(null)}
                    disabled={isSubmittingCancel}
                    className="w-1/3 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs active:scale-95 transition-all"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={handleConfirmCancelJob}
                    disabled={isSubmittingCancel}
                    className="flex-1 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingCancel ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Membatalkan...</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4" />
                        <span>Ya, Batalkan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
    </div>
  )
}
