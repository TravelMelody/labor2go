'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Share2,
  Star,
  Clock,
  Banknote,
  FileText,
  Store,
  MessageCircle,
  MessageSquare,
  MapPin,
  Footprints,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  X,
  Check,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAMPUS } from '@/lib/campus'
import {
  calculateHaversineDistance,
  formatDistance,
  getDistanceFromCampus,
} from '@/lib/geo'
import {
  formatRupiah,
  formatTimeRangeWIB,
  formatDurationHours,
  formatWhatsAppUrl,
  getShiftBadge,
  isUrgentJob,
} from '@/lib/format'
import { useNow } from '@/hooks/useNow'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { StarRating } from '@/components/reviews/StarRating'
import {
  REVIEW_SELECT,
  ReviewList,
  normalizeReviewRows,
  type RawReviewRow,
  type ReviewItem,
} from '@/components/reviews/ReviewList'

export interface JobDetailData {
  id: string
  umkm_id: string
  title: string
  description: string | null
  location_name: string | null
  lat: number | null
  lng: number | null
  start_at: string
  end_at: string
  pay_amount: number
  slots: number
  slots_left: number
  created_at: string
  business_name: string
  business_type: string | null
  business_photo: string | null
  owner_name: string
  merchant_address: string | null
  avg_rating: number | null
  review_count: number
  isAvailable: boolean
  shiftBadge?: string
  isUrgent?: boolean
  isOwner?: boolean
}

export interface CurrentUserData {
  id: string
  role: 'student' | 'umkm' | 'admin'
  isVerified: boolean
  fullName: string | null
}

export interface ApplicationData {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
}

interface JobDetailViewProps {
  job: JobDetailData
  currentUser: CurrentUserData
  initialApplication: ApplicationData | null
  initialMerchantPhone?: string | null
  initialReviews: ReviewItem[]
}

export function JobDetailView({
  job,
  currentUser,
  initialApplication,
  initialMerchantPhone = null,
  initialReviews,
}: JobDetailViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [application, setApplication] = useState<ApplicationData | null>(
    initialApplication
  )
  const [merchantPhone, setMerchantPhone] = useState<string | null>(
    initialMerchantPhone ?? null
  )
  const [avgRating, setAvgRating] = useState<number | null>(job.avg_rating)
  const [reviewCount, setReviewCount] = useState<number>(job.review_count)
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews)
  const [showingAllReviews, setShowingAllReviews] = useState<boolean>(false)
  const [loadingAllReviews, setLoadingAllReviews] = useState<boolean>(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const showingAllReviewsRef = useRef<boolean>(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')
  const [showChatTooltip, setShowChatTooltip] = useState(false)

  const isAcceptedStudent =
    currentUser.role === 'student' &&
    application?.status === 'accepted' &&
    Boolean(application.id)

  const { unreadByAppId } = useUnreadMessages(currentUser.id, {
    enabled: isAcceptedStudent,
  })

  const refreshReviewsAndRating = useCallback(async () => {
    try {
      const limit = showingAllReviewsRef.current ? 20 : 3
      const [ratingRes, reviewsRes, appRes] = await Promise.all([
        supabase
          .from('profile_ratings')
          .select('avg_rating, review_count')
          .eq('user_id', job.umkm_id)
          .maybeSingle(),
        supabase
          .from('reviews')
          .select(REVIEW_SELECT)
          .eq('reviewee_id', job.umkm_id)
          .order('created_at', { ascending: false })
          .limit(limit),
        currentUser.role === 'student'
          ? supabase
              .from('applications')
              .select('id, status')
              .eq('job_id', job.id)
              .eq('student_id', currentUser.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (!ratingRes.error && ratingRes.data) {
        setAvgRating(
          ratingRes.data.avg_rating != null ? Number(ratingRes.data.avg_rating) : null
        )
        setReviewCount(Number(ratingRes.data.review_count ?? 0))
      } else if (!ratingRes.error && !ratingRes.data) {
        setAvgRating(null)
        setReviewCount(0)
      }

      if (!reviewsRes.error && reviewsRes.data) {
        setReviews(normalizeReviewRows(reviewsRes.data as RawReviewRow[]))
      }

      if (currentUser.role === 'student' && !appRes.error) {
        if (appRes.data) {
          setApplication({
            id: appRes.data.id,
            status: appRes.data.status as ApplicationData['status'],
          })
          if (appRes.data.status === 'accepted') {
            const { data: contactData, error: contactError } = await supabase.rpc(
              'get_counterpart_contact',
              { p_application_id: appRes.data.id }
            )
            if (contactError) {
              if (contactError.code === 'P0001') {
                console.warn(
                  'Peringatan refresh get_counterpart_contact:',
                  contactError.message
                )
              } else {
                console.error('Error refresh get_counterpart_contact:', contactError)
              }
            } else {
              const rawContact = contactData as
                | { full_name?: string | null; phone?: string | null }
                | Array<{ full_name?: string | null; phone?: string | null }>
                | null
              const contactRow = Array.isArray(rawContact)
                ? rawContact[0] ?? null
                : rawContact
              setMerchantPhone(contactRow?.phone || null)
            }
          } else {
            setMerchantPhone(null)
          }
        } else {
          setApplication(null)
          setMerchantPhone(null)
        }
      }
    } catch (err) {
      console.error('Gagal memperbarui ulasan merchant:', err)
    }
  }, [supabase, job.umkm_id, job.id, currentUser.role, currentUser.id])

  useAutoRefresh(() => {
    void refreshReviewsAndRating()
  }, 20000)

  const handleLoadAllReviews = async () => {
    if (loadingAllReviews || showingAllReviews) return
    setLoadingAllReviews(true)
    setReviewsError(null)

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('reviewee_id', job.umkm_id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error saat memuat semua ulasan merchant:', error)
        setReviewsError('Gagal memuat semua ulasan.')
        return
      }

      setReviews(normalizeReviewRows(data as RawReviewRow[] | null))
      setShowingAllReviews(true)
      showingAllReviewsRef.current = true
    } catch (err) {
      console.error('Exception saat memuat semua ulasan merchant:', err)
      setReviewsError('Terjadi kesalahan saat memuat semua ulasan.')
    } finally {
      setLoadingAllReviews(false)
    }
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Bagikan lowongan: salin URL ke clipboard dengan toast
  const handleShare = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href)
        setToastType('success')
        setToastMessage('Link lowongan berhasil disalin ke clipboard!')
      }
    } catch (err) {
      console.error('Gagal menyalin link:', err)
      setToastType('error')
      setToastMessage('Gagal menyalin link lowongan.')
    }
  }

  // Aksi Lamar Pekerjaan (Insert atau Update dari Withdrawn)
  const handleApply = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      if (!application) {
        // Belum pernah melamar: INSERT HANYA { job_id, student_id }
        const { data, error } = await supabase
          .from('applications')
          .insert({
            job_id: job.id,
            student_id: currentUser.id,
          })
          .select('id, status')
          .single()

        if (error) {
          console.error('Gagal melamar lowongan:', error)
          if (error.code === '23505') {
            setToastType('info')
            setToastMessage('Kamu sudah melamar lowongan ini.')
            setApplication({ id: '', status: 'pending' })
          } else {
            setToastType('error')
            setToastMessage(error.message || 'Gagal mengirim lamaran.')
          }
          return
        }

        if (data) {
          setApplication({
            id: data.id,
            status: data.status as ApplicationData['status'],
          })
          setToastType('success')
          setToastMessage('Lamaran berhasil dikirim! Menunggu respon merchant.')
        }
      } else if (application.status === 'withdrawn') {
        // Melamar kembali: UPDATE status = 'pending' pada baris yang sama
        const { error } = await supabase
          .from('applications')
          .update({
            status: 'pending',
          })
          .eq('id', application.id)

        if (error) {
          console.error('Gagal mengajukan ulang lamaran:', error)
          setToastType('error')
          setToastMessage(error.message || 'Gagal mengajukan ulang lamaran.')
          return
        }

        setApplication((prev) =>
          prev ? { ...prev, status: 'pending' } : { id: application.id, status: 'pending' }
        )
        setToastType('success')
        setToastMessage('Lamaran kembali diajukan! Menunggu respon merchant.')
      }
    } catch (err: unknown) {
      console.error('Error saat proses lamar:', err)
      setToastType('error')
      setToastMessage('Terjadi kesalahan saat memproses lamaran.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Aksi Batalkan Lamaran (UPDATE status = 'withdrawn' saja)
  const handleWithdraw = async () => {
    if (!application || isSubmitting) return
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'withdrawn',
        })
        .eq('id', application.id)

      if (error) {
        console.error('Gagal membatalkan lamaran:', error)
        setToastType('error')
        setToastMessage(error.message || 'Gagal membatalkan lamaran.')
        return
      }

      setApplication((prev) =>
        prev ? { ...prev, status: 'withdrawn' } : null
      )
      setToastType('info')
      setToastMessage('Lamaran telah dibatalkan.')
    } catch (err: unknown) {
      console.error('Error saat membatalkan lamaran:', err)
      setToastType('error')
      setToastMessage('Terjadi kesalahan saat membatalkan lamaran.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const nowMs = useNow()

  // Perhitungan Data Halaman (utamakan nilai server untuk mencegah hydration mismatch)
  const shiftBadgeText = job.shiftBadge ?? getShiftBadge(job.start_at)
  const isUrgent = job.isUrgent ?? (nowMs !== null ? isUrgentJob(job.start_at, nowMs) : false)
  const hasReviews = reviewCount > 0 && avgRating != null
  const distanceText = getDistanceFromCampus(job.lat, job.lng, CAMPUS)

  // Estimasi Jalan Kaki (80 meter / menit)
  let walkingDistanceText: string | null = null
  if (job.lat != null && job.lng != null) {
    const distKm = calculateHaversineDistance(
      CAMPUS.lat,
      CAMPUS.lng,
      job.lat,
      job.lng
    )
    const distM = Math.round(distKm * 1000)
    const walkMins = Math.max(1, Math.round(distM / 80))
    const formattedDist = formatDistance(distKm)
    walkingDistanceText = `${formattedDist} (${walkMins} menit jalan kaki)`
  }

  // Format Tanggal Lengkap
  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(job.start_at))

  // Inisial pemilik/usaha untuk avatar fallback
  const merchantInitial = (job.owner_name || job.business_name || 'U')
    .trim()
    .charAt(0)
    .toUpperCase()

  // Perbandingan langsung string job.umkm_id === currentUser.id
  const isOwner =
    job.isOwner ??
    (Boolean(job.umkm_id && currentUser.id) &&
      String(job.umkm_id).trim().toLowerCase() ===
        String(currentUser.id).trim().toLowerCase())
  const isOtherMerchant = currentUser.role === 'umkm' && !isOwner

  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-4 right-4 max-w-[388px] mx-auto z-50 p-3.5 rounded-2xl shadow-lg flex items-center justify-between gap-3 border transition-all animate-in fade-in slide-in-from-top-3 ${
            toastType === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : toastType === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastType === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : toastType === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <p className="text-xs font-semibold leading-snug">{toastMessage}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kontainer Layar Mobile-First (Maks ~420px) */}
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col shadow-xs">
        {/* Header Khusus (Tanpa Bottom Nav) */}
        <header className="sticky top-0 z-30 bg-[#F8F9FF]/90 backdrop-blur-md border-b border-gray-100">
          <div className="h-16 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back()
                  } else {
                    router.push(currentUser.role === 'umkm' ? '/merchant' : '/student')
                  }
                }}
                className="w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-[#0B1C30] hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
                aria-label="Kembali"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base font-bold text-[#0B1C30] tracking-tight">
                Detail Lowongan
              </h1>
            </div>

            <button
              type="button"
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
              aria-label="Bagikan lowongan"
              title="Salin link lowongan"
            >
              <Share2 className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </header>

        {/* Konten Utama */}
        <main className="flex-1 w-full px-4 pt-3 pb-32 flex flex-col gap-4">
          {/* Banner Pemilik Lowongan (Selalu tampil jika isOwner) */}
          {isOwner ? (
            <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200 text-[#7A3000] flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-[#FF6B00] shrink-0" />
                <div>
                  <p className="text-xs font-bold">Ini lowongan kamu</p>
                  <p className="text-[11px] text-[#A04100] leading-snug">
                    {!job.isAvailable
                      ? 'Lowongan sudah tidak aktif di feed mahasiswa.'
                      : 'Lowongan sedang aktif menerima pelamar mahasiswa.'}
                  </p>
                </div>
              </div>
              <Link
                href={`/merchant/jobs/${job.id}`}
                className="px-3 py-1.5 rounded-full bg-[#FF6B00] text-white text-xs font-bold shrink-0 hover:bg-[#E05E00] transition-colors shadow-xs"
              >
                Kelola
              </Link>
            </div>
          ) : !job.isAvailable ? (
            /* Banner: Lowongan Sudah Tidak Tersedia (Hanya untuk non-pemilik) */
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Lowongan ini sudah tidak tersedia</p>
                <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                  Lowongan telah penuh, sudah dimulai, atau ditutup oleh merchant.
                </p>
              </div>
            </div>
          ) : null}

          {/* Banner: Akun Mahasiswa Belum Terverifikasi (Hanya mahasiswa bukan pemilik) */}
          {!isOwner && currentUser.role === 'student' && !currentUser.isVerified && (
            <div className="p-3 rounded-xl bg-yellow-50/90 border border-yellow-200/90 text-yellow-900 flex items-center gap-2.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-yellow-700 shrink-0" />
              <p className="text-[11px] leading-snug text-yellow-800 font-medium">
                Akunmu belum diverifikasi admin; merchant akan melihat statusnya.
              </p>
            </div>
          )}

          {/* Bagian Judul & Badge */}
          <div className="flex flex-col gap-2">
            {/* Badges Shift & Segera */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFDBCC] text-[#7A3000] text-[11px] font-bold">
                {shiftBadgeText}
              </span>

              {isUrgent && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Dibutuhkan Segera
                </span>
              )}
            </div>

            {/* Judul Lowongan */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight leading-tight">
              {job.title}
            </h1>

            {/* Nama usaha, Rating/Baru, Jarak dari kampus */}
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
              <span className="font-bold text-xs sm:text-sm text-[#0B1C30]">
                {job.business_name}
              </span>

              {job.business_type && (
                <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {job.business_type}
                </span>
              )}

              <span className="text-gray-300">•</span>

              {hasReviews ? (
                <div className="flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded-full text-[#FF6B00]">
                  <Star className="w-3 h-3 fill-[#FF6B00]" />
                  <span className="text-[11px] font-bold">
                    {Number(avgRating).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    ({reviewCount} ulasan)
                  </span>
                </div>
              ) : (
                <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-100">
                  Baru
                </span>
              )}

              {distanceText && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-600 font-medium">{distanceText}</span>
                </>
              )}
            </div>
          </div>

          {/* Kartu Detail Utama */}
          <div className="w-full bg-white rounded-2xl shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 p-4 flex flex-col gap-4">
            {/* 1. Kartu Jadwal */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Jadwal Shift
                </span>
                <span className="text-base font-bold text-[#0B1C30] mt-0.5">
                  {formatTimeRangeWIB(job.start_at, job.end_at)}
                </span>
                <span className="text-xs text-gray-500 mt-0.5">
                  {formattedDate} • Total durasi {formatDurationHours(job.start_at, job.end_at)}
                </span>
              </div>
            </div>

            {/* 2. Kartu Upah */}
            <div className="flex items-start gap-3 bg-[#F0F4FF] p-3.5 rounded-xl border border-blue-50">
              <div className="w-10 h-10 rounded-full bg-[#FFDBCC] flex items-center justify-center shrink-0 text-[#7A3000]">
                <Banknote className="w-5 h-5" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                    Upah Bersih
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                      <ShieldCheck className="w-3 h-3" />
                      Garansi Aman
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] text-[10px] font-bold">
                      Tersisa {job.slots_left} slot
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-extrabold text-[#FF6B00]">
                    {formatRupiah(job.pay_amount)}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">/ orang</span>
                </div>

                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Dana ditahan platform saat kamu diterima dan dicairkan setelah tugas dikonfirmasi selesai.
                </p>
              </div>
            </div>

            {/* 3. Deskripsi Tugas (TANPA Kualifikasi) */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Deskripsi Tugas
                </span>
                <p className="text-xs text-[#0B1C30] mt-1 leading-relaxed whitespace-pre-line">
                  {job.description?.trim() ? job.description : 'Tidak ada deskripsi tambahan'}
                </p>
              </div>
            </div>

            {/* 4. Kartu Merchant */}
            <div className="pt-1">
              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {job.business_photo ? (
                      <img
                        src={job.business_photo}
                        alt={job.business_name}
                        className="w-11 h-11 rounded-full object-cover shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-orange-100 text-[#FF6B00] font-extrabold text-sm flex items-center justify-center shrink-0 border border-orange-200">
                        {merchantInitial}
                      </div>
                    )}

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-xs sm:text-sm text-[#0B1C30] truncate">
                          {job.owner_name}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">|</span>
                        <span className="text-xs text-gray-600 truncate">
                          {job.business_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                        {hasReviews ? (
                          <>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                            <span className="font-semibold text-gray-700">
                              {Number(avgRating).toFixed(1)}
                            </span>
                            <span>({reviewCount} ulasan)</span>
                          </>
                        ) : (
                          <span className="text-emerald-700 font-semibold">
                            Merchant Terdaftar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Chat (Aktif jika mahasiswa sudah diterima, selain itu nonaktif + tooltip) */}
                  {isAcceptedStudent && application ? (
                    <Link
                      href={`/chat/${application.id}`}
                      aria-label="Chat dengan merchant"
                      title="Chat dengan merchant"
                      className="relative w-10 h-10 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF6B00] shadow-xs hover:bg-orange-100 active:scale-95 transition-all shrink-0"
                    >
                      <MessageSquare className="w-5 h-5" />
                      {(unreadByAppId[application.id] ?? 0) > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center leading-none ring-2 ring-white">
                          {unreadByAppId[application.id] > 99
                            ? '99+'
                            : unreadByAppId[application.id]}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowChatTooltip((prev) => !prev)}
                        onMouseEnter={() => setShowChatTooltip(true)}
                        onMouseLeave={() => setShowChatTooltip(false)}
                        aria-label="Chat pemilik toko"
                        className="w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-400 shadow-xs hover:border-gray-300 transition-colors cursor-not-allowed"
                      >
                        <MessageSquare className="w-5 h-5 text-gray-400" />
                      </button>

                      {showChatTooltip && (
                        <div className="absolute right-0 bottom-full mb-2 w-48 p-2 rounded-xl bg-gray-900 text-white text-[11px] text-center shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          Chat terbuka setelah lamaranmu diterima
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Kontak WhatsApp Merchant (khusus mahasiswa yang lamaran sudah diterima) */}
                {isAcceptedStudent && (() => {
                  const waUrl = formatWhatsAppUrl(
                    merchantPhone,
                    `Halo ${job.owner_name}, saya pekerja yang diterima untuk lowongan "${job.title}" di Labor2Go.`
                  )
                  return (
                    <div className="pt-2.5 border-t border-gray-200/70 flex items-center justify-between gap-2">
                      <div className="text-xs min-w-0">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">
                          Nomor WhatsApp
                        </span>
                        <span className="font-bold text-gray-800 truncate block">
                          {merchantPhone || 'Nomor tidak tersedia'}
                        </span>
                      </div>

                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-white" />
                          <span>Hubungi via WA</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic shrink-0">
                          WA belum diatur
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Bagian Ulasan tentang Merchant */}
          <section className="bg-white rounded-2xl shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#0B1C30]">
                  Ulasan tentang {job.business_name}
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  {hasReviews ? (
                    <>
                      <StarRating value={Number(avgRating)} size="sm" showValue />
                      <span className="text-[11px] text-gray-500">
                        ({reviewCount} ulasan)
                      </span>
                    </>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-100">
                      Baru
                    </span>
                  )}
                </div>
              </div>
            </div>

            <ReviewList reviews={reviews} emptyMessage="Belum ada ulasan" />

            {reviewsError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{reviewsError}</span>
              </div>
            )}

            {!showingAllReviews && reviewCount > 3 && (
              <button
                type="button"
                onClick={handleLoadAllReviews}
                disabled={loadingAllReviews}
                className="w-full h-10 rounded-full bg-[#F8F9FF] hover:bg-orange-50 border border-gray-200 text-[#0B1C30] hover:text-[#FF6B00] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
              >
                {loadingAllReviews && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loadingAllReviews ? 'Memuat ulasan...' : 'Lihat semua'}</span>
              </button>
            )}
          </section>

          {/* Bagian Lokasi & Rute Singkat */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0B1C30]">
                Lokasi &amp; Rute Singkat
              </h2>

              {job.lat != null && job.lng != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B00] hover:text-[#e05e00] transition-colors"
                >
                  <span>Lihat di Peta</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Peta OpenStreetMap (iframe) & Alamat */}
            <div className="relative w-full rounded-2xl overflow-hidden shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] bg-white border border-gray-100 flex flex-col">
              {job.lat != null && job.lng != null ? (
                <div className="relative w-full h-44 bg-gray-100">
                  <iframe
                    title="Peta Lokasi OpenStreetMap"
                    className="w-full h-full border-0"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      job.lng - 0.005
                    }%2C${job.lat - 0.005}%2C${job.lng + 0.005}%2C${
                      job.lat + 0.005
                    }&layer=mapnik&marker=${job.lat}%2C${job.lng}`}
                  />

                  {/* Badge Estimasi Jalan Kaki di pojok atas peta */}
                  {walkingDistanceText && (
                    <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 z-10 border border-gray-100">
                      <Footprints className="w-4 h-4 text-[#FF6B00] shrink-0" />
                      <span className="text-xs font-bold text-[#0B1C30]">
                        {walkingDistanceText}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Baris Alamat */}
              <div className="p-3 bg-white flex items-center gap-2 text-xs text-gray-700 border-t border-gray-50">
                <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <span className="truncate font-medium">
                  {job.location_name ||
                    job.merchant_address ||
                    'Lokasi spesifik tertera pada peta'}
                </span>
              </div>
            </div>
          </div>

          {/* Kotak Keamanan Platform */}
          <div className="p-3.5 rounded-2xl bg-[#F0F4FF] border border-blue-100 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Sistem <strong className="text-[#0B1C30]">Labor2Go</strong> menjamin dana
              tersimpan aman di rekening penampung bersama sebelum Anda mulai bertugas.
            </p>
          </div>
        </main>

        {/* Action Bar Menempel di Bawah (Sticky Bottom) */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl shadow-[0_-4px_24px_0_rgba(26,43,76,0.08)] border-t border-gray-200/80 px-4 py-3 pb-safe">
          <div className="max-w-[420px] mx-auto flex flex-col items-center gap-1.5">
            {/* 1. Kondisi Merchant Pemilik Lowongan (Selalu prioritas pertama, bahkan jika lowongan tidak tersedia) */}
            {isOwner ? (
              <div className="w-full flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <Store className="w-4 h-4 text-[#FF6B00]" />
                  <span>Ini lowongan kamu</span>
                </div>
                <Link
                  href={`/merchant/jobs/${job.id}`}
                  className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#e05e00] active:scale-[0.99] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <span>Kelola Pelamar</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : isOtherMerchant ? (
              /* 2. Kondisi Merchant Lain (Read-Only) */
              <div className="w-full py-2.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold text-center border border-gray-200/60">
                Kamu melihat sebagai Merchant (Mode Baca)
              </div>
            ) : !job.isAvailable ? (
              /* 3. Kondisi Non-Pemilik jika Lowongan Tidak Tersedia -> Tombol Nonaktif */
              <button
                disabled
                className="w-full h-12 rounded-full bg-gray-200 text-gray-400 font-bold text-sm cursor-not-allowed flex items-center justify-center"
              >
                Lowongan Tidak Tersedia
              </button>
            ) : currentUser.role === 'student' ? (
              /* 4. Kondisi Mahasiswa Saat Lowongan Tersedia */
              <>
                {application?.status === 'accepted' ? (
                  // Status Accepted -> Kamu diterima & Tautan Buka di Tugas Aktif
                  <div className="w-full flex flex-col items-center gap-2">
                    <div className="w-full h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Kamu Diterima untuk Pekerjaan Ini</span>
                    </div>
                    <Link
                      href="/student/activity"
                      className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#e05e00] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
                    >
                      <span>Buka di Tugas Aktif</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : application?.status === 'rejected' ? (
                  // Status Rejected -> Lamaran tidak dipilih
                  <div className="w-full flex flex-col items-center gap-1">
                    <button
                      disabled
                      className="w-full h-12 rounded-full bg-gray-200 text-gray-500 font-bold text-sm cursor-not-allowed flex items-center justify-center"
                    >
                      Lamaran Tidak Dipilih
                    </button>
                    <span className="text-xs text-gray-400 font-medium">
                      Tetap semangat, coba eksplor lowongan lainnya!
                    </span>
                  </div>
                ) : application?.status === 'pending' ? (
                  // Status Pending -> Lamaran Terkirim + Batalkan Lamaran
                  <div className="w-full flex flex-col items-center gap-1.5">
                    <button
                      disabled
                      className="w-full h-12 rounded-full bg-gray-100 text-gray-600 font-bold text-sm border border-gray-200 flex items-center justify-center gap-2 cursor-default"
                    >
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Lamaran Terkirim</span>
                    </button>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Menunggu respon merchant</span>
                      <span className="text-gray-300">•</span>
                      <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={isSubmitting}
                        className="text-red-600 hover:text-red-700 font-semibold underline active:opacity-80 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Memproses...' : 'Batalkan lamaran'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Belum Melamar ATAU Status 'withdrawn' -> Tombol Ambil Kerjaan Ini
                  <div className="w-full flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={isSubmitting}
                      className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#e05e00] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-white font-bold text-sm shadow-md shadow-orange-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Mengirim Lamaran...</span>
                        </>
                      ) : (
                        <>
                          <span>Ambil Kerjaan Ini</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <div className="flex items-center justify-center gap-1 text-center">
                      <span className="text-amber-500 text-xs font-bold">⚡</span>
                      <span className="text-xs text-gray-500">
                        Upah akan dibayarkan setelah proses verifikasi
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
