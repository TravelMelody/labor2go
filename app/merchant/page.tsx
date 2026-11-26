'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Wallet,
  Plus,
  Lock,
  Briefcase,
  PlusCircle,
  Users,
  CheckCircle,
  CheckCircle2,
  Clock,
  Radio,
  ChevronRight,
  History,
  Trash2,
  ArrowRight,
  Star,
  UserCheck,
  Loader2,
  X,
  AlertTriangle,
  Store,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  formatRupiah,
  formatJobScheduleWIB,
  formatTimeWIB,
  getFirstName,
} from '@/lib/format'
import { VerificationBanner } from '@/components/shared/VerificationBanner'
import { NotificationBell } from '@/components/shared/NotificationBell'
import {
  normalizeVerificationStatus,
  type VerificationStatus,
} from '@/lib/verification'
import {
  VerificationStatusBadge,
  getInitials,
  logSupabaseError,
} from '@/components/account/AccountShared'

interface ActiveApplicationItem {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  student_id: string
  checked_in_at: string | null
  checked_out_at: string | null
  studentName?: string
}

interface ActiveJobSummary {
  id: string
  title: string
  start_at: string
  end_at: string
  pay_amount: number
  slots: number
  status: 'open' | 'filled' | 'in_progress'
  created_at: string
  applications: ActiveApplicationItem[]
}

interface JobTemplateItem {
  id: string
  title: string
  description: string | null
  duration_hours: number
  pay_amount: number
  slots: number
  created_at: string
}

function formatTemplateDuration(hours: number): string {
  const num = Number(hours)
  if (Number.isNaN(num) || num <= 0) return '2 Jam'
  return `${num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)} Jam`
}

function getOwnerFirstName(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return 'Mitra'
  const first = fullName.trim().split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export default function MerchantDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>('pending')
  const [verificationNote, setVerificationNote] = useState<string | null>(null)

  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [heldAmount, setHeldAmount] = useState<number>(0)
  const [latestActiveJob, setLatestActiveJob] =
    useState<ActiveJobSummary | null>(null)
  const [templates, setTemplates] = useState<JobTemplateItem[]>([])

  const [completedJobsCount, setCompletedJobsCount] = useState<number>(0)
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState<number>(0)
  const [paidWorkersCount, setPaidWorkersCount] = useState<number>(0)

  // Delete template confirmation dialog state
  const [templateToDelete, setTemplateToDelete] =
    useState<JobTemplateItem | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState(false)
  const [deleteTemplateError, setDeleteTemplateError] = useState<string | null>(
    null
  )

  // Success toast state (?posted=true)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (!showToast) return
    const timer = setTimeout(() => setShowToast(false), 6000)
    return () => clearTimeout(timer)
  }, [showToast])

  const loadDashboard = useCallback(
    async (silent = false) => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          if (urlParams.get('posted') === 'true') {
            setShowToast(true)
            window.history.replaceState({}, '', window.location.pathname)
          }
        }

        if (userError || !user) {
          router.replace('/login?redirectTo=/merchant')
          return
        }

        setUserId(user.id)

        const [
          profileRes,
          umkmRes,
          walletRes,
          heldPaymentsRes,
          activeJobRes,
          templatesRes,
          completedJobsRes,
          ratingRes,
          releasedPaymentsRes,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, verified, verification_status, verification_note')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('umkm_profiles')
            .select('business_name, photo_url')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('payments')
            .select('amount, commission')
            .eq('status', 'held'),
          supabase
            .from('jobs')
            .select(
              `id,
               title,
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
                 checked_in_at,
                 checked_out_at
               )`
            )
            .eq('umkm_id', user.id)
            .in('status', ['open', 'filled', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('job_templates')
            .select(
              'id, title, description, duration_hours, pay_amount, slots, created_at'
            )
            .eq('umkm_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('umkm_id', user.id)
            .eq('status', 'completed'),
          supabase
            .from('profile_ratings')
            .select('avg_rating, review_count')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('payments')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'released'),
        ])

        if (profileRes.error) {
          logSupabaseError('MerchantDashboard.profiles', profileRes.error)
        }
        if (umkmRes.error) {
          logSupabaseError('MerchantDashboard.umkm_profiles', umkmRes.error)
        }
        if (walletRes.error) {
          logSupabaseError('MerchantDashboard.wallets', walletRes.error)
        }
        if (heldPaymentsRes.error) {
          logSupabaseError('MerchantDashboard.heldPayments', heldPaymentsRes.error)
        }
        if (activeJobRes.error) {
          logSupabaseError('MerchantDashboard.activeJob', activeJobRes.error)
        }
        if (templatesRes.error) {
          logSupabaseError('MerchantDashboard.jobTemplates', templatesRes.error)
        }
        if (completedJobsRes.error) {
          logSupabaseError(
            'MerchantDashboard.completedJobs',
            completedJobsRes.error
          )
        }
        if (ratingRes.error) {
          logSupabaseError('MerchantDashboard.profileRatings', ratingRes.error)
        }
        if (releasedPaymentsRes.error) {
          logSupabaseError(
            'MerchantDashboard.releasedPayments',
            releasedPaymentsRes.error
          )
        }

        const resolvedFullName =
          profileRes.data?.full_name ||
          (typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : null)
        setOwnerName(resolvedFullName)
        setVerificationStatus(
          normalizeVerificationStatus(
            profileRes.data?.verification_status,
            profileRes.data?.verified
          )
        )
        setVerificationNote(profileRes.data?.verification_note ?? null)

        setBusinessName(umkmRes.data?.business_name ?? null)
        setPhotoUrl(umkmRes.data?.photo_url ?? null)

        setWalletBalance(Number(walletRes.data?.balance ?? 0))

        const totalHeld = (
          (heldPaymentsRes.data ?? []) as Array<{
            amount: number | string | null
            commission: number | string | null
          }>
        ).reduce<number>(
          (sum, row) =>
            sum + Number(row.amount ?? 0) + Number(row.commission ?? 0),
          0
        )
        setHeldAmount(totalHeld)

        // Proses lowongan aktif terbaru dan nama pekerja jika ada
        if (activeJobRes.data) {
          const rawJob = activeJobRes.data as {
            id: string
            title: string
            start_at: string
            end_at: string
            pay_amount: number
            slots: number
            status: 'open' | 'filled' | 'in_progress'
            created_at: string
            applications?: ActiveApplicationItem[] | null
          }
          const rawApps = Array.isArray(rawJob.applications)
            ? rawJob.applications
            : []

          const acceptedStudentIds = Array.from(
            new Set(
              rawApps
                .filter((a) => a.status === 'accepted' && a.student_id)
                .map((a) => a.student_id)
            )
          )

          let nameMap: Record<string, string> = {}
          if (acceptedStudentIds.length > 0) {
            const { data: studentProfiles, error: studentProfErr } =
              await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', acceptedStudentIds)

            if (studentProfErr) {
              logSupabaseError(
                'MerchantDashboard.acceptedStudentProfiles',
                studentProfErr
              )
            } else if (studentProfiles) {
              nameMap = (
                studentProfiles as Array<{
                  id: string
                  full_name: string | null
                }>
              ).reduce<Record<string, string>>((acc, row) => {
                acc[row.id] = getFirstName(row.full_name)
                return acc
              }, {})
            }
          }

          setLatestActiveJob({
            id: rawJob.id,
            title: rawJob.title,
            start_at: rawJob.start_at,
            end_at: rawJob.end_at,
            pay_amount: Number(rawJob.pay_amount),
            slots: Number(rawJob.slots),
            status: rawJob.status,
            created_at: rawJob.created_at,
            applications: rawApps.map((app) => ({
              ...app,
              studentName: nameMap[app.student_id] || 'Mahasiswa',
            })),
          })
        } else {
          setLatestActiveJob(null)
        }

        setTemplates((templatesRes.data ?? []) as JobTemplateItem[])
        setCompletedJobsCount(Number(completedJobsRes.count ?? 0))

        const ratingVal = ratingRes.data?.avg_rating
        setAvgRating(
          ratingVal !== null && ratingVal !== undefined
            ? Number(ratingVal)
            : null
        )
        setReviewCount(Number(ratingRes.data?.review_count ?? 0))
        setPaidWorkersCount(Number(releasedPaymentsRes.count ?? 0))
      } catch (err) {
        console.error('Error saat memuat dashboard merchant:', err)
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [router, supabase]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboard(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [loadDashboard])

  useAutoRefresh(() => {
    loadDashboard(true)
  }, 20000)

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete || !userId || deletingTemplate) return
    setDeletingTemplate(true)
    setDeleteTemplateError(null)

    try {
      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', templateToDelete.id)
        .eq('umkm_id', userId)

      if (error) {
        logSupabaseError('MerchantDashboard.deleteTemplate', error)
        setDeleteTemplateError(
          error.message || 'Gagal menghapus template lowongan.'
        )
        return
      }

      setTemplates((prev) =>
        prev.filter((item) => item.id !== templateToDelete.id)
      )
      setTemplateToDelete(null)
    } catch (err) {
      console.error('Exception saat menghapus template:', err)
      setDeleteTemplateError('Terjadi kesalahan saat menghapus template.')
    } finally {
      setDeletingTemplate(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col bg-[#F8F9FF] pb-28 animate-pulse">
        <div className="h-16 px-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="w-32 h-7 rounded bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gray-200" />
            <div className="w-9 h-9 rounded-full bg-gray-200" />
          </div>
        </div>
        <div className="px-4 pt-4 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="w-40 h-7 rounded-lg bg-gray-200" />
            <div className="w-52 h-4 rounded bg-gray-200" />
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="w-32 h-10 rounded-xl bg-gray-200" />
              <div className="w-24 h-9 rounded-full bg-gray-200" />
            </div>
            <div className="w-full h-5 rounded bg-gray-100" />
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="w-44 h-5 rounded bg-gray-200" />
            <div className="h-28 rounded-2xl bg-white border border-slate-100" />
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="w-36 h-5 rounded bg-gray-200" />
            <div className="flex gap-3 overflow-hidden">
              <div className="w-48 h-36 shrink-0 rounded-2xl bg-white border border-slate-100" />
              <div className="w-48 h-36 shrink-0 rounded-2xl bg-white border border-slate-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-white border border-slate-100" />
            <div className="h-20 rounded-2xl bg-white border border-slate-100" />
            <div className="col-span-2 h-20 rounded-2xl bg-white border border-slate-100" />
          </div>
        </div>
      </div>
    )
  }

  const firstName = getOwnerFirstName(ownerName)
  const avatarInitials = getInitials(businessName || ownerName, 'U')
  const hasRating =
    reviewCount > 0 && avgRating !== null && !Number.isNaN(avgRating)

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col bg-[#F8F9FF] text-[#0B1C30] pb-28">
      {/* Toast Notifikasi Sukses Publikasi */}
      {showToast && (
        <div className="fixed top-4 left-4 right-4 max-w-[388px] mx-auto z-50 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Lowongan Berhasil Dipublikasikan!
              </p>
              <p className="text-[11px] text-emerald-800 leading-snug">
                Mahasiswa terdekat sekarang dapat melihat lowongan Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            aria-label="Tutup notifikasi"
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#F8F9FF]/90 backdrop-blur-xl border-b border-slate-200/60">
        <div className="h-16 px-4 flex items-center justify-between">
          <Image
            src="/logo-merchant.png"
            alt="Labor2Go Merchant"
            width={136}
            height={34}
            className="h-8 w-auto object-contain"
            priority
          />
          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} />
            <Link
              href="/merchant/account"
              aria-label="Pengaturan Akun Toko"
              className="relative w-9 h-9 rounded-full overflow-hidden bg-[#FFEDE0] text-[#FF6B00] border border-orange-200/80 flex items-center justify-center font-bold text-xs shadow-xs hover:opacity-90 transition-opacity shrink-0"
            >
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={businessName || 'Akun Toko'}
                  fill
                  className="object-cover"
                  sizes="36px"
                  unoptimized
                />
              ) : (
                <span>{avatarInitials}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {/* 1. Sapaan, Nama Usaha, Badge Verifikasi & Banner */}
        <section className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0B1C30] tracking-tight truncate">
              Halo, {firstName}!
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-600 truncate">
                  {businessName || 'Usaha Mitra Labor2Go'}
                </span>
              </div>
              <VerificationStatusBadge
                verified={verificationStatus === 'approved'}
                status={verificationStatus}
                verifiedLabel="Terverifikasi"
              />
            </div>
          </div>

          <VerificationBanner
            status={verificationStatus}
            note={verificationNote}
            roleLabel="umkm"
          />

          {/* 2. Kartu Dana */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] text-[#4E5E82] flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 leading-none">
                    Dana Upah
                  </span>
                  <span className="text-lg font-extrabold text-[#0B1C30] leading-tight mt-1 truncate">
                    {formatRupiah(walletBalance)}
                  </span>
                </div>
              </div>

              <Link
                href="/merchant/wallet"
                aria-label="Isi Saldo Dompet"
                className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E05E00] active:scale-95 transition-all shadow-[0_4px_12px_rgba(255,107,0,0.3)]"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Isi Saldo</span>
              </Link>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                <Lock className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Dana Ditahan (Escrow)</span>
              </span>
              <span className="font-bold text-[#0B1C30]">
                {formatRupiah(heldAmount)}
              </span>
            </div>
          </div>
        </section>

        {/* 3. Status Lowongan Terkini */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-[#0B1C30]">
                Status Lowongan Terkini
              </h2>
              {latestActiveJob && (
                <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
              )}
            </div>
            <Link
              href="/merchant/jobs"
              className="text-xs font-bold text-[#FF6B00] hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          {!latestActiveJob ? (
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-slate-100 text-center flex flex-col items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#EFF4FF] text-[#4E5E82] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0B1C30]">
                  Belum ada lowongan aktif
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Pasang lowongan baru agar mahasiswa di sekitar lokasi usahamu
                  bisa langsung melamar.
                </p>
              </div>
              <Link
                href="/merchant/post"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E05E00] active:scale-95 transition-all shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Pasang Lowongan</span>
              </Link>
            </div>
          ) : (
            (() => {
              const apps = latestActiveJob.applications
              const pendingCount = apps.filter(
                (a) => a.status === 'pending'
              ).length
              const acceptedApps = apps.filter((a) => a.status === 'accepted')

              return (
                <Link
                  href={`/merchant/jobs/${latestActiveJob.id}`}
                  className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-slate-100 flex flex-col gap-3 hover:border-slate-200 active:scale-[0.99] transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-[#0B1C30] truncate">
                        {latestActiveJob.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatJobScheduleWIB(
                          latestActiveJob.start_at,
                          latestActiveJob.end_at
                        )}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#FF6B00] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                  </div>

                  {/* Kondisi Open */}
                  {latestActiveJob.status === 'open' && (
                    <div className="bg-[#EFF4FF]/70 border border-blue-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-[#FF6B00] border border-orange-200 text-[11px] font-bold shrink-0">
                          <Radio className="w-3 h-3 animate-pulse" />
                          <span>Mencari pekerja</span>
                        </span>
                        <span className="text-xs font-bold text-[#0B1C30] truncate">
                          {pendingCount} pelamar
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                        {acceptedApps.length}/{latestActiveJob.slots} terisi
                      </span>
                    </div>
                  )}

                  {/* Kondisi Filled */}
                  {latestActiveJob.status === 'filled' && (
                    <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-blue-950 truncate">
                          Pekerja lengkap
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-700 shrink-0">
                        {acceptedApps.length}/{latestActiveJob.slots} siap
                        bertugas
                      </span>
                    </div>
                  )}

                  {/* Kondisi In Progress */}
                  {latestActiveJob.status === 'in_progress' && (
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Sedang Berjalan</span>
                        </span>
                        <span className="text-[11px] text-emerald-800 font-semibold">
                          {acceptedApps.length} pekerja
                        </span>
                      </div>
                      {acceptedApps.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {acceptedApps.map((app) => {
                            const checkStatusLabel = app.checked_out_at
                              ? `Sudah check-out • ${formatTimeWIB(
                                  app.checked_out_at,
                                  { includeSuffix: true }
                                )}`
                              : app.checked_in_at
                              ? `Sudah check-in • ${formatTimeWIB(
                                  app.checked_in_at,
                                  { includeSuffix: true }
                                )}`
                              : 'Belum check-in'

                            return (
                              <div
                                key={app.id}
                                className="flex flex-wrap items-center justify-between gap-1.5 bg-white/90 rounded-lg px-2.5 py-1.5 text-xs border border-emerald-100"
                              >
                                <span className="font-bold text-[#0B1C30] truncate min-w-0">
                                  {app.studentName || 'Mahasiswa'}
                                </span>
                                <span
                                  className={`text-[11px] font-semibold shrink-0 flex items-center gap-1 ${
                                    app.checked_out_at
                                      ? 'text-blue-700'
                                      : app.checked_in_at
                                      ? 'text-emerald-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {app.checked_in_at ? (
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <Clock className="w-3 h-3 shrink-0" />
                                  )}
                                  <span>{checkStatusLabel}</span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Link>
              )
            })()
          )}
        </section>

        {/* 4. Panggil Ulang Cepat */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0B1C30]">
              Panggil Ulang Cepat
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              Template tersimpan
            </span>
          </div>

          {templates.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 border border-dashed border-slate-200 text-xs text-slate-500 leading-relaxed text-center">
              Centang &apos;Simpan sebagai template&apos; saat memasang lowongan
              untuk membuat pintasan di sini.
            </div>
          ) : (
            <div className="flex items-stretch gap-3 overflow-x-auto pb-1.5 pt-0.5 -mx-4 px-4 no-scrollbar">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="shrink-0 w-48 bg-white rounded-2xl p-3.5 shadow-[0_4px_16px_-2px_rgba(26,43,76,0.06)] border border-slate-100 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTemplateError(null)
                        setTemplateToDelete(tpl)
                      }}
                      aria-label={`Hapus template ${tpl.title}`}
                      className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-bold text-[#0B1C30] leading-snug line-clamp-2">
                      {tpl.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {formatTemplateDuration(tpl.duration_hours)}
                      {tpl.slots > 1 ? ` • ${tpl.slots} orang` : ''}
                    </p>
                    <p className="text-xs font-bold text-[#FF6B00]">
                      {formatRupiah(tpl.pay_amount)} / orang
                    </p>
                  </div>

                  <Link
                    href={`/merchant/post?template=${tpl.id}`}
                    className="w-full py-2 px-3 rounded-full bg-[#FF6B00] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#E05E00] active:scale-95 transition-all shadow-xs"
                  >
                    <span>Pasang Ulang</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. Performa Toko */}
        <section className="flex flex-col gap-2.5">
          <h2 className="text-base font-bold text-[#0B1C30]">Performa Toko</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Bantuan Selesai */}
            <div className="bg-white p-3.5 rounded-2xl shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] text-[#4E5E82] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-extrabold text-[#0B1C30] leading-tight">
                  {completedJobsCount}
                </span>
                <span className="text-[11px] text-slate-500 font-medium leading-tight">
                  Bantuan Selesai
                </span>
              </div>
            </div>

            {/* Rating Toko */}
            <div className="bg-white p-3.5 rounded-2xl shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-[#FF6B00]" />
              </div>
              <div className="flex flex-col min-w-0">
                {hasRating ? (
                  <>
                    <span className="text-lg font-extrabold text-[#0B1C30] leading-tight">
                      {Number(avgRating).toFixed(1)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium leading-tight truncate">
                      Rating Toko ({reviewCount})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-extrabold text-[#0B1C30] leading-tight">
                      Belum ada
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium leading-tight">
                      Rating Toko
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Total Pekerja Dibayar */}
            <div className="col-span-2 bg-white p-3.5 rounded-2xl shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#0B1C30]">
                    Total Pekerja Dibayar
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Pembayaran upah yang sudah dicairkan
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-lg font-extrabold text-[#0B1C30]">
                  {paidWorkersCount}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Dialog Konfirmasi Hapus Template */}
      {templateToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-template-title"
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-[380px] bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => !deletingTemplate && setTemplateToDelete(null)}
                disabled={deletingTemplate}
                aria-label="Tutup dialog"
                className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3
                id="delete-template-title"
                className="text-base font-extrabold text-[#0B1C30]"
              >
                Hapus Template?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Template{' '}
                <strong className="text-[#0B1C30]">
                  &ldquo;{templateToDelete.title}&rdquo;
                </strong>{' '}
                akan dihapus dari daftar Panggil Ulang Cepat. Lowongan yang
                sudah terbit tidak terpengaruh.
              </p>
            </div>

            {deleteTemplateError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {deleteTemplateError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                disabled={deletingTemplate}
                className="h-11 rounded-full border border-slate-200 bg-white text-[#0B1C30] text-xs font-bold hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTemplate}
                disabled={deletingTemplate}
                className="h-11 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {deletingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus</span>
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
