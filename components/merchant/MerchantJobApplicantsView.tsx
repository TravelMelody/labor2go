'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle2,
  Star,
  Wallet,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Ban,
  Check,
  X,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  formatRupiah,
  formatJobScheduleWIB,
  formatTimeWIB,
  formatWhatsAppUrl,
  getFirstName,
} from '@/lib/format'
import { useNow } from '@/hooks/useNow'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

export interface ApplicantStudentInfo {
  id: string
  full_name: string | null
  phone: string | null
  verified: boolean
  university: string
  skills: string[]
  level: number
  completed_jobs: number
  avg_rating: number | null
  review_count: number
}

export interface ApplicantPaymentInfo {
  id: string
  amount: number
  commission: number
  status: 'pending' | 'held' | 'released' | 'refunded'
}

export interface ApplicantItem {
  id: string
  job_id: string
  student_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  checked_in_at: string | null
  checked_out_at: string | null
  created_at: string
  student: ApplicantStudentInfo
  payment?: ApplicantPaymentInfo | null
}

export interface MerchantJobInfo {
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
  umkm_id: string
}

interface ProfileRecord {
  id: string
  full_name: string | null
  phone: string | null
  verified: boolean
}

interface StudentProfileRecord {
  id: string
  university: string | null
  skills: string[] | null
  level: number | null
  completed_jobs: number | null
}

interface ProfileRatingRecord {
  user_id: string
  avg_rating: number | null
  review_count: number | null
}

interface ApplicationPaymentRecord {
  id: string
  amount: number
  commission: number
  status: 'pending' | 'held' | 'released' | 'refunded'
}

interface ApplicationRow {
  id: string
  job_id: string
  student_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  checked_in_at: string | null
  checked_out_at: string | null
  created_at: string
  payments?: ApplicationPaymentRecord[] | ApplicationPaymentRecord | null
}

interface MerchantJobApplicantsViewProps {
  initialJob: MerchantJobInfo
  initialApplications: ApplicantItem[]
  initialWalletBalance: number
  initialServiceFee: number
  currentUserId: string
}

export function MerchantJobApplicantsView({
  initialJob,
  initialApplications,
  initialWalletBalance,
  initialServiceFee,
  currentUserId,
}: MerchantJobApplicantsViewProps) {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [job, setJob] = useState<MerchantJobInfo>(initialJob)
  const [applications, setApplications] = useState<ApplicantItem[]>(initialApplications)
  const [walletBalance, setWalletBalance] = useState<number>(initialWalletBalance)
  const [serviceFee, setServiceFee] = useState<number>(initialServiceFee)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const currentTime = useNow(15000)

  // Modals state
  const [selectedAppForAccept, setSelectedAppForAccept] = useState<ApplicantItem | null>(null)
  const [selectedAppForReject, setSelectedAppForReject] = useState<ApplicantItem | null>(null)
  const [selectedAppForCompletion, setSelectedAppForCompletion] = useState<ApplicantItem | null>(null)
  const [selectedAppForNoShow, setSelectedAppForNoShow] = useState<ApplicantItem | null>(null)
  const [showCancelJobModal, setShowCancelJobModal] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Toast state
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

  // Refresh data function (mendukung silent refresh agar tidak ada indikator loading berkedip)
  const refreshData = async (silent = false) => {
    if (!silent) setIsRefreshing(true)
    try {
      // 1. Refresh Job
      const { data: updatedJob, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', job.id)
        .maybeSingle()

      if (jobError) {
        console.error('Error saat refresh lowongan:', jobError)
      } else if (updatedJob) {
        setJob(updatedJob as MerchantJobInfo)
      }

      // 2. Refresh Wallet
      const { data: updatedWallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', currentUserId)
        .maybeSingle()

      if (walletError) {
        console.error('Error saat refresh dompet:', walletError)
      } else if (updatedWallet) {
        setWalletBalance(Number(updatedWallet.balance || 0))
      }

      // 3. Refresh Platform Settings
      const { data: updatedSettings, error: settingsError } = await supabase
        .from('platform_settings')
        .select('int_value')
        .eq('key', 'service_fee_per_worker')
        .maybeSingle()

      if (settingsError) {
        console.error('Error saat refresh platform_settings:', settingsError)
      } else if (updatedSettings?.int_value != null) {
        setServiceFee(Number(updatedSettings.int_value))
      }

      // 4. Refresh Applications beserta Payments & Timestamps
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          id,
          job_id,
          student_id,
          status,
          checked_in_at,
          checked_out_at,
          created_at,
          payments (
            id,
            amount,
            commission,
            status
          )
        `)
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })

      if (appsError) {
        console.error('Error saat refresh applications:', appsError)
        return
      }

      if (appsData) {
        const rawApps = appsData as ApplicationRow[]
        const studentIds = Array.from(new Set(rawApps.map((a) => a.student_id)))

        let profilesMap: Record<string, ProfileRecord> = {}
        let studentProfilesMap: Record<string, StudentProfileRecord> = {}
        let ratingsMap: Record<string, ProfileRatingRecord> = {}

        if (studentIds.length > 0) {
          const [profilesRes, studentProfilesRes, ratingsRes] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, phone, verified')
              .in('id', studentIds),
            supabase
              .from('student_profiles')
              .select('id, university, skills, level, completed_jobs')
              .in('id', studentIds),
            supabase
              .from('profile_ratings')
              .select('user_id, avg_rating, review_count')
              .in('user_id', studentIds),
          ])

          if (profilesRes.error) {
            console.error('Error saat refresh profiles:', profilesRes.error)
          } else if (profilesRes.data) {
            profilesMap = (profilesRes.data as ProfileRecord[]).reduce((acc, curr) => {
              acc[curr.id] = curr
              return acc
            }, {} as Record<string, ProfileRecord>)
          }

          if (studentProfilesRes.error) {
            console.error('Error saat refresh student_profiles:', studentProfilesRes.error)
          } else if (studentProfilesRes.data) {
            studentProfilesMap = (studentProfilesRes.data as StudentProfileRecord[]).reduce((acc, curr) => {
              acc[curr.id] = curr
              return acc
            }, {} as Record<string, StudentProfileRecord>)
          }

          if (ratingsRes.error) {
            console.error('Error saat refresh profile_ratings:', ratingsRes.error)
          } else if (ratingsRes.data) {
            ratingsMap = (ratingsRes.data as ProfileRatingRecord[]).reduce((acc, curr) => {
              acc[curr.user_id] = curr
              return acc
            }, {} as Record<string, ProfileRatingRecord>)
          }
        }

        const mappedApps: ApplicantItem[] = rawApps.map((app) => {
          const prof = profilesMap[app.student_id]
          const sp = studentProfilesMap[app.student_id]
          const rat = ratingsMap[app.student_id]
          const rawPay = Array.isArray(app.payments)
            ? app.payments[0] || null
            : app.payments || null

          return {
            id: app.id,
            job_id: app.job_id,
            student_id: app.student_id,
            status: app.status,
            checked_in_at: app.checked_in_at || null,
            checked_out_at: app.checked_out_at || null,
            created_at: app.created_at,
            payment: rawPay
              ? {
                  id: rawPay.id,
                  amount: rawPay.amount,
                  commission: rawPay.commission,
                  status: rawPay.status,
                }
              : null,
            student: {
              id: app.student_id,
              full_name: prof?.full_name || 'Mahasiswa',
              phone: prof?.phone || null,
              verified: Boolean(prof?.verified),
              university: sp?.university || 'Universitas Negeri Semarang',
              skills: Array.isArray(sp?.skills) ? sp.skills : [],
              level: sp?.level ?? 1,
              completed_jobs: sp?.completed_jobs ?? 0,
              avg_rating: rat?.avg_rating != null ? Number(rat.avg_rating) : null,
              review_count: rat?.review_count ?? 0,
            },
          }
        })

        setApplications(mappedApps)
      }
    } catch (err) {
      console.error('Unexpected error during refreshData:', err)
    } finally {
      if (!silent) setIsRefreshing(false)
    }
  }

  // Sinkronisasi otomatis tiap 20 detik dan saat tab kembali fokus tanpa indikator berkedip
  useAutoRefresh(() => {
    refreshData(true)
  }, 20000)

  // Filter applications
  const acceptedApplicants = applications.filter((app) => app.status === 'accepted')
  const pendingApplicants = applications.filter((app) => app.status === 'pending')

  // Financial calculations
  const totalPerWorker = job.pay_amount + serviceFee
  const isBalanceInsufficient = walletBalance < totalPerWorker
  const isJobFilled = job.status === 'filled' || acceptedApplicants.length >= job.slots

  // Kalkulasi estimasi dana yang dikembalikan jika lowongan dibatalkan
  const heldRefundAmount = acceptedApplicants.reduce((acc, a) => {
    if (a.payment && a.payment.status === 'held') {
      return acc + a.payment.amount + a.payment.commission
    }
    // Jika data payment belum terbaca tetapi status accepted, fallback ke total per worker
    return acc + totalPerWorker
  }, 0)

  // Handle Accept Application (via RPC accept_application)
  const handleConfirmAccept = async () => {
    if (!selectedAppForAccept) return
    setIsSubmitting(true)
    setActionError(null)

    try {
      // Panggil RPC database accept_application
      const { error } = await supabase.rpc('accept_application', {
        p_application_id: selectedAppForAccept.id,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan accept_application dari database:', error.message)
        } else {
          console.error('Error Supabase rpc accept_application:', error)
        }
        // Tampilkan error.message dari database apa adanya
        setActionError(error.message)
        return
      }

      // Berhasil
      const studentName = selectedAppForAccept.student.full_name || 'Mahasiswa'
      setSelectedAppForAccept(null)
      showToast(
        `Berhasil menerima ${studentName}! Dana escrow sebesar ${formatRupiah(
          totalPerWorker
        )} telah ditahan.`,
        'success'
      )

      // Refresh data
      await refreshData()
      router.refresh()
    } catch (err: unknown) {
      console.error('Exception accept_application:', err)
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memproses lamaran.'
      setActionError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Reject Application (Update status = 'rejected')
  const handleConfirmReject = async () => {
    if (!selectedAppForReject) return
    setIsSubmitting(true)
    setActionError(null)

    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: 'rejected' })
        .eq('id', selectedAppForReject.id)

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan reject application dari database:', error.message)
        } else {
          console.error('Error Supabase update applications to rejected:', error)
        }
        setActionError(error.message)
        return
      }

      // Berhasil
      const studentName = selectedAppForReject.student.full_name || 'Pelamar'
      setSelectedAppForReject(null)
      showToast(`Lamaran dari ${studentName} telah ditolak.`, 'info')

      // Refresh data
      await refreshData()
      router.refresh()
    } catch (err: unknown) {
      console.error('Exception reject application:', err)
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menolak lamaran.'
      setActionError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Confirm Completion & Release Wages (via RPC confirm_completion)
  const handleConfirmCompletion = async () => {
    if (!selectedAppForCompletion) return
    setIsSubmitting(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('confirm_completion', {
        p_application_id: selectedAppForCompletion.id,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan confirm_completion dari database:', error.message)
        } else {
          console.error('Error Supabase rpc confirm_completion:', error)
        }
        setActionError(error.message)
        return
      }

      const studentName = selectedAppForCompletion.student.full_name || 'Mahasiswa'
      setSelectedAppForCompletion(null)
      showToast(
        `Berhasil! Upah ${formatRupiah(job.pay_amount)} telah dicairkan ke ${studentName}.`,
        'success'
      )

      await refreshData()
      router.refresh()
    } catch (err: unknown) {
      console.error('Exception confirm_completion:', err)
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat mencairkan upah.'
      setActionError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Report No Show (via RPC report_no_show)
  const handleConfirmNoShow = async () => {
    if (!selectedAppForNoShow) return
    setIsSubmitting(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('report_no_show', {
        p_application_id: selectedAppForNoShow.id,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan report_no_show dari database:', error.message)
        } else {
          console.error('Error Supabase rpc report_no_show:', error)
        }
        setActionError(error.message)
        return
      }

      const studentName = selectedAppForNoShow.student.full_name || 'Mahasiswa'
      const refundNominal = selectedAppForNoShow.payment
        ? selectedAppForNoShow.payment.amount + selectedAppForNoShow.payment.commission
        : totalPerWorker

      setSelectedAppForNoShow(null)
      showToast(
        `Mahasiswa ${studentName} telah dilaporkan tidak hadir. Dana ${formatRupiah(
          refundNominal
        )} dikembalikan ke saldo dompetmu.`,
        'info'
      )

      await refreshData()
      router.refresh()
    } catch (err: unknown) {
      console.error('Exception report_no_show:', err)
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat melaporkan tidak hadir.'
      setActionError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Cancel Job (via RPC cancel_job)
  const handleConfirmCancelJob = async () => {
    setIsSubmitting(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('cancel_job', {
        p_job_id: job.id,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan cancel_job dari database:', error.message)
        } else {
          console.error('Error Supabase rpc cancel_job:', error)
        }
        setActionError(error.message)
        return
      }

      setShowCancelJobModal(false)
      showToast(`Lowongan "${job.title}" berhasil dibatalkan.`, 'info')

      // Setelah sukses kembali ke /merchant/jobs sesuai instruksi
      router.push('/merchant/jobs')
    } catch (err: unknown) {
      console.error('Exception cancel_job:', err)
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat membatalkan lowongan.'
      setActionError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col px-4 pt-5 pb-24 text-[#0B1C30]">
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
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
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
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/merchant/jobs"
            className="w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-[#0B1C30] hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
            aria-label="Kembali ke kelola lowongan"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-[#0B1C30] tracking-tight">
              Kelola Pelamar & Pekerja
            </h1>
            <p className="text-[11px] text-gray-500">
              Lowongan: <span className="font-medium text-gray-700">{job.title}</span>
            </p>
          </div>
        </div>

        {/* Refresh indicator */}
        <button
          onClick={() => refreshData(false)}
          disabled={isRefreshing}
          className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Segarkan data"
          aria-label="Segarkan data"
        >
          <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FF6B00]' : ''}`} />
        </button>
      </div>

      {/* 1. Ringkasan Lowongan Card */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100/90 shadow-sm mb-5 relative overflow-hidden">
        {/* Status lowongan header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                job.status === 'open'
                  ? 'bg-emerald-500 animate-pulse'
                  : job.status === 'filled'
                  ? 'bg-blue-600'
                  : 'bg-gray-400'
              }`}
            />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {job.status === 'open'
                ? 'Mencari Pekerja'
                : job.status === 'filled'
                ? 'Slot Terpenuhi'
                : job.status}
            </span>
          </div>

          <div
            className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
              isJobFilled
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-orange-50 text-[#FF6B00] border border-orange-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>
              Slot Terisi: {acceptedApplicants.length}/{job.slots}
            </span>
          </div>
        </div>

        {/* Job Title */}
        <h2 className="text-lg font-extrabold text-[#0B1C30] mb-2 leading-tight">
          {job.title}
        </h2>

        {/* Jadwal WIB */}
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-4 bg-gray-50 px-3 py-2 rounded-xl">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="font-semibold text-gray-800">
            {formatJobScheduleWIB(job.start_at, job.end_at)}
          </span>
        </div>

        {/* Financial Breakdown Table */}
        <div className="bg-[#F8F9FF] rounded-2xl p-3.5 border border-blue-50 mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-600">
            <span>Upah per Pekerja</span>
            <span className="font-bold text-gray-800">{formatRupiah(job.pay_amount)}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Biaya Layanan Platform</span>
            <span className="font-semibold text-gray-700">{formatRupiah(serviceFee)}</span>
          </div>
          <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between">
            <span className="font-bold text-gray-900">Total per Pekerja</span>
            <span className="font-extrabold text-sm text-[#FF6B00]">
              {formatRupiah(totalPerWorker)}
            </span>
          </div>
        </div>

        {/* Saldo Dompet UMKM */}
        <div className="flex items-center justify-between bg-white border border-gray-200/80 rounded-2xl p-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
                Saldo Dompet Kamu
              </span>
              <span className="text-xs font-bold text-gray-900">
                {formatRupiah(walletBalance)}
              </span>
            </div>
          </div>
          <Link
            href="/merchant/wallet"
            className="text-[11px] font-bold text-[#FF6B00] hover:underline flex items-center gap-1"
          >
            <span>Dompet</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Jaminan Dana Text (Poin 5) */}
        <div className="flex items-start gap-2.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] leading-relaxed text-emerald-800 font-medium">
            Dana ditahan saat kamu menerima pekerja dan baru dicairkan ke mahasiswa setelah tugas
            dikonfirmasi selesai.
          </p>
        </div>
      </div>

      {/* 3. Daftar "Pekerja Diterima" (status accepted) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0B1C30]">Pekerja Diterima</h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
              {acceptedApplicants.length} Orang
            </span>
          </div>
          {acceptedApplicants.length > 0 && (
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Siap Bertugas
            </span>
          )}
        </div>

        {acceptedApplicants.length === 0 ? (
          <div className="bg-white rounded-2xl p-4 border border-dashed border-gray-200 text-center text-xs text-gray-400">
            Belum ada pekerja yang diterima. Pilih salah satu pelamar di bawah untuk menerima pekerja.
          </div>
        ) : (
          <div className="space-y-3">
            {acceptedApplicants.map((app) => {
              const isPaid = app.payment?.status === 'released'
              const isCheckedOut = Boolean(app.checked_out_at)
              const isCheckedIn = Boolean(app.checked_in_at)
              const canReportNoShow =
                !isCheckedIn &&
                !isPaid &&
                currentTime !== null &&
                currentTime >= new Date(job.start_at).getTime() + 30 * 60 * 1000

              const waUrl = formatWhatsAppUrl(
                app.student.phone,
                `Halo ${getFirstName(
                  app.student.full_name
                )}, saya dari pemberi kerja lowongan "${job.title}" di Labor2Go. Apakah kamu sudah siap untuk jadwal ini?`
              )

              return (
                <div
                  key={app.id}
                  className={`bg-white rounded-2xl p-4 border-2 shadow-xs relative overflow-hidden transition-all ${
                    isPaid
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : isCheckedOut
                      ? 'border-blue-300 bg-blue-50/20'
                      : isCheckedIn
                      ? 'border-emerald-400 bg-emerald-50/10'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">
                          {app.student.full_name || 'Mahasiswa'}
                        </h3>
                        {app.student.verified && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full"
                            title="Terverifikasi"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Terverifikasi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{app.student.university}</p>
                    </div>

                    {/* Status badge per pekerja */}
                    {isPaid ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-lg border border-emerald-300 flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Selesai - Dibayar</span>
                      </span>
                    ) : isCheckedOut ? (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Sudah Check-out</span>
                      </span>
                    ) : isCheckedIn ? (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Sedang bekerja</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-lg border border-amber-200">
                        Belum hadir
                      </span>
                    )}
                  </div>

                  {/* Level & Rating stats */}
                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-3 pt-1">
                    <span className="px-2 py-0.5 bg-gray-100 rounded-md font-semibold text-gray-700 text-[11px]">
                      Level {app.student.level}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-gray-800">
                        {app.student.avg_rating ? app.student.avg_rating.toFixed(1) : 'Baru'}
                      </span>
                      <span className="text-gray-400">({app.student.completed_jobs} tugas)</span>
                    </div>
                  </div>

                  {/* Info Box Detail Kehadiran / Kerja */}
                  {isPaid ? (
                    <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-2.5 mb-3 text-xs text-emerald-950 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Tugas selesai & upah telah dicairkan</span>
                      </div>
                      {app.checked_in_at && app.checked_out_at && (
                        <span className="text-[10px] text-emerald-700 font-medium">
                          {formatTimeWIB(app.checked_in_at)} - {formatTimeWIB(app.checked_out_at)} WIB
                        </span>
                      )}
                    </div>
                  ) : isCheckedOut && app.checked_out_at ? (
                    <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-2.5 mb-3 text-xs text-blue-900 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Pekerja sudah check-out</span>
                        <span className="text-[11px] text-blue-700">
                          {formatTimeWIB(app.checked_out_at, { includeSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-700 leading-snug">
                        Silakan periksa hasil kerja sebelum melakukan konfirmasi pencairan upah.
                      </p>
                    </div>
                  ) : isCheckedIn && app.checked_in_at ? (
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 mb-3 text-xs text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold">Sedang bekerja</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-800">
                        Check-in: {formatTimeWIB(app.checked_in_at, { includeSuffix: true })}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 mb-3 text-xs text-gray-600 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">Kehadiran:</span>
                      </div>
                      <span className="font-bold text-amber-600">Belum hadir</span>
                    </div>
                  )}

                  {/* Tombol Utama: Konfirmasi Selesai & Cairkan Upah (Kondisi sudah check-out & belum dibayar) */}
                  {isCheckedOut && !isPaid && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null)
                          setSelectedAppForCompletion(app)
                        }}
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] active:scale-[0.98] text-white text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Konfirmasi Selesai & Cairkan Upah</span>
                      </button>
                    </div>
                  )}

                  {/* Tombol: Lapor Tidak Hadir (Kondisi belum check-in & >= start_at + 30 menit) */}
                  {canReportNoShow && !isCheckedIn && !isPaid && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null)
                          setSelectedAppForNoShow(app)
                        }}
                        disabled={isSubmitting}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-[0.98] text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Lapor Tidak Hadir</span>
                      </button>
                    </div>
                  )}

                  {/* Kontak WhatsApp */}
                  <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">
                        Nomor WhatsApp
                      </span>
                      <span className="font-bold text-gray-800">
                        {app.student.phone || 'Nomor tidak tersedia'}
                      </span>
                    </div>

                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>Hubungi via WA</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">WA belum diatur</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Daftar "Pelamar" (status pending) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0B1C30]">Daftar Pelamar</h2>
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] text-[11px] font-bold">
              {pendingApplicants.length} Pelamar
            </span>
          </div>
          {isJobFilled && (
            <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full">
              Slot Penuh
            </span>
          )}
        </div>

        {pendingApplicants.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 mb-1">Belum Ada Pelamar Baru</h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              {isJobFilled
                ? 'Semua slot lowongan ini sudah terisi oleh pekerja yang kamu terima.'
                : 'Lowongan kamu sedang ditayangkan kepada mahasiswa sekitar. Pelamar yang tertarik akan langsung muncul di sini.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApplicants.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-2xl p-4 border border-gray-100/90 shadow-sm transition-all hover:border-gray-200"
              >
                {/* Header Card Pelamar: Nama, Kampus, Badge Verifikasi */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-[#0B1C30] truncate">
                        {app.student.full_name || 'Mahasiswa'}
                      </h3>

                      {/* Badge Verifikasi dari profiles.verified */}
                      {app.student.verified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Terverifikasi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                          Belum diverifikasi
                        </span>
                      )}
                    </div>

                    {/* Kampus */}
                    <p className="text-xs text-gray-500 truncate mt-0.5 font-medium">
                      {app.student.university}
                    </p>
                  </div>

                  {/* Badge Level */}
                  <span className="px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-bold flex-shrink-0">
                    Level {app.student.level}
                  </span>
                </div>

                {/* Rating & Pekerjaan Selesai */}
                <div className="flex items-center gap-3 text-xs text-gray-600 mb-3 pt-1">
                  <div className="flex items-center gap-1 font-semibold text-gray-800">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>
                      {app.student.avg_rating ? app.student.avg_rating.toFixed(1) : 'Baru'}
                    </span>
                  </div>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-500">
                    {app.student.completed_jobs} pekerjaan selesai
                  </span>
                </div>

                {/* Skills (Chips) */}
                {app.student.skills && app.student.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {app.student.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Buttons: Terima (Utama), Tolak (Sekunder), Chat (Nonaktif) */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  {/* Chat button nonaktif */}
                  <button
                    disabled
                    aria-disabled="true"
                    title="Chat hanya aktif setelah pekerja diterima"
                    className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center cursor-not-allowed opacity-60 flex-shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>

                  {/* Tolak (Sekunder) */}
                  <button
                    onClick={() => {
                      setActionError(null)
                      setSelectedAppForReject(app)
                    }}
                    disabled={isSubmitting}
                    className="px-3.5 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tolak</span>
                  </button>

                  {/* Terima Pekerja Ini (Utama) */}
                  <button
                    onClick={() => {
                      setActionError(null)
                      setSelectedAppForAccept(app)
                    }}
                    disabled={isSubmitting}
                    className="flex-1 h-10 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] active:scale-95 text-white text-xs font-bold transition-all shadow-sm shadow-orange-500/25 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Terima Pekerja Ini</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Tombol "Batalkan Lowongan" (aktif untuk status open atau filled) */}
      {(job.status === 'open' || job.status === 'filled') && (
        <div className="pt-2 pb-6 flex flex-col items-center">
          <button
            type="button"
            onClick={() => {
              setActionError(null)
              setShowCancelJobModal(true)
            }}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-2xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <Ban className="w-4 h-4" />
            <span>Batalkan Lowongan</span>
          </button>
        </div>
      )}

      {/* MODAL 1: Konfirmasi Terima Pekerja */}
      {selectedAppForAccept && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-[390px] bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-5 duration-200">
            {/* Modal Title */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6B00] flex items-center justify-center font-bold">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <h3 className="text-base font-extrabold text-[#0B1C30]">
                  Terima Pekerja Mahasiswa
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppForAccept(null)}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Info */}
            <div className="bg-gray-50 rounded-2xl p-3.5 mb-3.5 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
                Kandidat Pekerja
              </span>
              <p className="text-sm font-bold text-gray-900">
                {selectedAppForAccept.student.full_name || 'Mahasiswa'}
              </p>
              <p className="text-xs text-gray-500">{selectedAppForAccept.student.university}</p>
            </div>

            {/* Escrow Details */}
            <div className="space-y-2 mb-3.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Upah Mahasiswa</span>
                <span className="font-semibold">{formatRupiah(job.pay_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Biaya Layanan Platform</span>
                <span className="font-semibold">{formatRupiah(serviceFee)}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-gray-900">
                <span>Total Dana Ditahan (Escrow)</span>
                <span className="text-[#FF6B00] font-extrabold">{formatRupiah(totalPerWorker)}</span>
              </div>
            </div>

            {/* Rincian dana ditahan statement */}
            <div className="bg-orange-50/70 border border-orange-200/60 rounded-xl p-3 text-xs text-orange-950 mb-3.5">
              <p className="leading-relaxed font-medium">
                <span className="font-bold text-[#FF6B00]">{formatRupiah(totalPerWorker)}</span> (upah +
                biaya layanan) akan ditahan dari saldomu saat menerima pekerja ini.
              </p>
            </div>

            {/* Status Saldo Saat Ini */}
            <div className="flex items-center justify-between text-xs bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-200/60 mb-3.5">
              <span className="text-gray-600 font-medium">Saldo Dompet Saat Ini:</span>
              <span className="font-bold text-gray-900">{formatRupiah(walletBalance)}</span>
            </div>

            {/* Peringatan jika Saldo < Total */}
            {isBalanceInsufficient && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mb-3.5 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Saldo tidak cukup</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-snug">
                  Saldo kamu kurang{' '}
                  <span className="font-bold">{formatRupiah(totalPerWorker - walletBalance)}</span>{' '}
                  untuk melakukan pembayaran penahanan escrow ini.
                </p>
                <div className="pt-1">
                  <Link
                    href="/merchant/wallet"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF6B00] underline"
                  >
                    <span>Isi saldo (segera hadir)</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* Error Message dari Database (apa adanya) */}
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 mb-3.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{actionError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setSelectedAppForAccept(null)}
                disabled={isSubmitting}
                className="w-1/3 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmAccept}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-2xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs shadow-md shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Escrow...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Konfirmasi & Terima</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Konfirmasi Tolak Pelamar */}
      {selectedAppForReject && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-[380px] bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-5 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 stroke-[2.5]" />
            </div>

            <h3 className="text-base font-extrabold text-[#0B1C30] text-center mb-1">
              Tolak Pelamar Ini?
            </h3>
            <p className="text-xs text-gray-500 text-center leading-relaxed mb-4">
              Apakah kamu yakin ingin menolak lamaran dari{' '}
              <span className="font-bold text-gray-900">
                {selectedAppForReject.student.full_name || 'Mahasiswa'}
              </span>
              ? Pelamar ini tidak akan diterima untuk tugas ini.
            </p>

            {/* Error Message jika ada */}
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 mb-3.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{actionError}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedAppForReject(null)}
                disabled={isSubmitting}
                className="w-1/2 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isSubmitting}
                className="w-1/2 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menolak...</span>
                  </>
                ) : (
                  <span>Ya, Tolak</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Konfirmasi Selesai & Cairkan Upah */}
      {selectedAppForCompletion && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-[390px] bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6B00] flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-extrabold text-[#0B1C30]">
                  Konfirmasi Selesai & Cairkan
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppForCompletion(null)}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Info */}
            <div className="bg-gray-50 rounded-2xl p-3.5 mb-3.5 border border-gray-100 text-xs">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
                Pekerja
              </span>
              <p className="text-sm font-bold text-gray-900">
                {selectedAppForCompletion.student.full_name || 'Mahasiswa'}
              </p>
              <p className="text-gray-500 mt-0.5">{selectedAppForCompletion.student.university}</p>
            </div>

            {/* Info Dialog Sesuai Persyaratan */}
            <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-4 text-xs text-orange-950 mb-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#FF6B00]">
                <CheckCircle2 className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
                <span>Pencairan Upah Mahasiswa</span>
              </div>
              <p className="leading-relaxed">
                Upah sebesar{' '}
                <strong className="text-[#FF6B00] font-extrabold text-sm">
                  {formatRupiah(job.pay_amount)}
                </strong>{' '}
                akan dicairkan ke mahasiswa.
              </p>
              <p className="text-[11px] text-orange-800 leading-snug">
                Pastikan seluruh pekerjaan telah selesai diperiksa dengan memuaskan sebelum melakukan konfirmasi pencairan ini.
              </p>
            </div>

            {/* Error Message jika ada */}
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 mb-3.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{actionError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setSelectedAppForCompletion(null)}
                disabled={isSubmitting}
                className="w-1/3 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmCompletion}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-2xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold text-xs shadow-md shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mencairkan Upah...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi & Cairkan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Konfirmasi Lapor Tidak Hadir */}
      {selectedAppForNoShow && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-[390px] bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-extrabold text-[#0B1C30]">
                  Lapor Tidak Hadir
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppForNoShow(null)}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Info */}
            <div className="bg-gray-50 rounded-2xl p-3.5 mb-3.5 border border-gray-100 text-xs">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
                Pekerja
              </span>
              <p className="text-sm font-bold text-gray-900">
                {selectedAppForNoShow.student.full_name || 'Mahasiswa'}
              </p>
              <p className="text-gray-500 mt-0.5">{selectedAppForNoShow.student.university}</p>
            </div>

            {/* Info Dialog Sesuai Persyaratan */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-950 mb-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Konfirmasi Laporan No-Show</span>
              </div>
              <p className="leading-relaxed">
                Dana{' '}
                <strong className="text-rose-900 font-extrabold text-sm">
                  {formatRupiah(
                    selectedAppForNoShow.payment
                      ? selectedAppForNoShow.payment.amount +
                          selectedAppForNoShow.payment.commission
                      : totalPerWorker
                  )}
                </strong>{' '}
                dikembalikan ke saldomu dan mahasiswa mendapat catatan.
              </p>
              <p className="text-[11px] text-rose-700 leading-snug">
                Tindakan ini akan membatalkan status lamaran pekerja ini dan menambahkan riwayat ketidakhadiran pada profil mahasiswa.
              </p>
            </div>

            {/* Error Message jika ada */}
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 mb-3.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{actionError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setSelectedAppForNoShow(null)}
                disabled={isSubmitting}
                className="w-1/3 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmNoShow}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Laporan...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>Konfirmasi Tidak Hadir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Konfirmasi Batalkan Lowongan */}
      {showCancelJobModal && (
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
                onClick={() => setShowCancelJobModal(false)}
                disabled={isSubmitting}
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
              <p className="text-sm font-bold text-gray-900">{job.title}</p>
              <p className="text-gray-500 mt-0.5">
                {formatJobScheduleWIB(job.start_at, job.end_at)}
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
                  Belum ada pekerja yang diterima untuk lowongan ini, sehingga tidak ada potongan saldo yang ditahan ({formatRupiah(0)} dikembalikan).
                </p>
              )}
              <p className="text-[11px] text-amber-800 leading-snug">
                Pekerja yang telah diterima akan dibatalkan, dan pelamar lainnya akan otomatis ditolak.
              </p>
            </div>

            {/* Error Message jika ada */}
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 mb-3.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{actionError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowCancelJobModal(false)}
                disabled={isSubmitting}
                className="w-1/3 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs active:scale-95 transition-all"
              >
                Kembali
              </button>
              <button
                onClick={handleConfirmCancelJob}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membatalkan Lowongan...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Ya, Batalkan Lowongan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
