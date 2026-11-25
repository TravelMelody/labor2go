'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Store,
  LogOut,
  PlusCircle,
  Users,
  Loader2,
  CheckCircle,
  MapPin,
  Tag,
  Briefcase,
  Banknote,
  X,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  VerificationBanner,
  VerifiedBadge,
  normalizeVerificationStatus,
  type VerificationStatus,
} from '@/components/shared/VerificationBanner'

interface JobItem {
  id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  pay_amount: number
  slots: number
  status: 'open' | 'filled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
}

export default function MerchantDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>('pending')
  const [verificationNote, setVerificationNote] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [businessType, setBusinessType] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Jobs state
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)

  // Success toast state
  const [showToast, setShowToast] = useState(false)

  // Sembunyikan toast otomatis setelah beberapa detik
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  const loadUserAndJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
        setLoadingJobs(true)
      }

      // Periksa query param ?posted=true untuk notifikasi sukses
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get('posted') === 'true') {
          setShowToast(true)
          window.history.replaceState({}, '', window.location.pathname)
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email ?? null)

        // Baca profiles (full_name, verified, verification_status, verification_note)
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, verified, verification_status, verification_note')
          .eq('id', user.id)
          .maybeSingle()

        setUserName(
          profile?.full_name || user.user_metadata?.full_name || 'Mitra UMKM'
        )
        setVerificationStatus(
          normalizeVerificationStatus(
            profile?.verification_status,
            profile?.verified
          )
        )
        setVerificationNote(profile?.verification_note ?? null)

        // Baca data umkm_profiles
        const { data: umkmProfile } = await supabase
          .from('umkm_profiles')
          .select('business_name, business_type, address, photo_url')
          .eq('id', user.id)
          .maybeSingle()

        if (umkmProfile) {
          setBusinessName(umkmProfile.business_name || null)
          setBusinessType(umkmProfile.business_type || null)
          setAddress(umkmProfile.address || null)
          setPhotoUrl(umkmProfile.photo_url || null)
        }

        // Ambil daftar lowongan milik UMKM
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select(
            'id, title, description, start_at, end_at, pay_amount, slots, status, created_at'
          )
          .eq('umkm_id', user.id)
          .order('created_at', { ascending: false })

        if (jobsError) {
          console.error('Error saat membaca daftar jobs:', {
            message: jobsError.message,
            details: jobsError.details,
            hint: jobsError.hint,
            code: jobsError.code,
          })
        } else if (jobsData) {
          setJobs(jobsData as JobItem[])
        }
      }
    } catch (err) {
      console.error('Error saat memuat data dashboard merchant:', err)
    } finally {
      if (!silent) {
        setLoadingJobs(false)
        setLoading(false)
      }
    }
  }, [supabase])

  useEffect(() => {
    loadUserAndJobs(false)
  }, [loadUserAndJobs])

  // Sinkronisasi otomatis tiap 20 detik & saat tab kembali fokus tanpa kedipan skeleton
  useAutoRefresh(() => {
    loadUserAndJobs(true)
  }, 20000)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const formatSchedule = (startAt: string, endAt: string): string => {
    try {
      const start = new Date(startAt)
      const end = new Date(endAt)

      const dateStr = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(start)

      const startTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(start)

      const endTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(end)

      return `${dateStr} • ${startTime} - ${endTime} WIB`
    } catch {
      return 'Jadwal belum ditentukan'
    }
  }

  const getStatusBadge = (status: JobItem['status']) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Terbuka
          </span>
        )
      case 'filled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Terisi
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Berlangsung
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
            Selesai
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            Dibatalkan
          </span>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FF]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0B1C30]" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col px-4 pt-6 pb-24 bg-[#F8F9FF]">
      {/* Toast Notifikasi Sukses */}
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
            onClick={() => setShowToast(false)}
            aria-label="Tutup notifikasi"
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <header className="flex items-center justify-between mb-5">
        <Image
          src="/logo-merchant.png"
          alt="Labor2Go Merchant"
          width={130}
          height={34}
          className="h-8 w-auto object-contain"
          priority
        />
        <button
          onClick={handleLogout}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </header>

      {/* Verification Status Alert */}
      <VerificationBanner
        status={verificationStatus}
        note={verificationNote}
        roleLabel="umkm"
        className="mb-4"
      />

      {/* Profile Card */}
      <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs mb-4">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-gray-200 shrink-0">
              <Image
                src={photoUrl}
                alt={businessName || 'Foto Usaha'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#E5EEFF] text-[#0B1C30] flex items-center justify-center font-bold text-lg shrink-0">
              <Store className="w-6 h-6" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E5EEFF] text-[#0B1C30] text-[10px] font-bold">
                Pemilik Usaha / UMKM
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base font-bold text-[#0B1C30] truncate">
                {businessName || userName || 'Mitra Labor2Go'}
              </h2>
              {verificationStatus === 'approved' && <VerifiedBadge />}
            </div>
            <p className="text-xs text-gray-500 truncate">
              {userName} • {userEmail}
            </p>
          </div>
        </div>

        {/* Business details */}
        {(businessType || address) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1.5 text-xs text-gray-600">
            {businessType && (
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                <span className="font-semibold text-gray-800">Kategori:</span>
                <span>{businessType}</span>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-tight">{address}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pasang Lowongan Action Banner / Button */}
      <div className="mb-5">
        <Link
          href="/merchant/post"
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#FF6B00] text-white shadow-[0_8px_20px_-4px_rgba(255,107,0,0.35)] hover:bg-[#E05E00] active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold leading-tight">Pasang Lowongan</p>
              <p className="text-xs text-white/80 mt-0.5">
                Butuh bantuan dadakan hari ini?
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-white text-[#FF6B00] text-xs font-bold group-hover:bg-orange-50 transition-colors">
            Mulai
          </span>
        </Link>
      </div>

      {/* Lowongan Saya Section */}
      <section className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0B1C30]">Lowongan Saya</h3>
            {!loadingJobs && jobs.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#E5EEFF] text-[#0B1C30] text-[10px] font-bold">
                {jobs.length}
              </span>
            )}
          </div>
          <Link
            href="/merchant/post"
            className="text-xs font-bold text-[#FF6B00] hover:text-[#E05E00] flex items-center gap-1"
          >
            <span>+ Pasang Baru</span>
          </Link>
        </div>

        {loadingJobs ? (
          <div className="p-8 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin text-[#0B1C30]" />
          </div>
        ) : jobs.length === 0 ? (
          /* Empty State */
          <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-xs text-center flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-[#E5EEFF] text-[#0B1C30] flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#0B1C30] mb-1">
              Belum ada lowongan aktif
            </h4>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-4">
              Buat lowongan bantuan dadakan pertama kamu dan biarkan mahasiswa siap membantu usahamu.
            </p>
            <Link
              href="/merchant/post"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E05E00] shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Pasang Lowongan Sekarang</span>
            </Link>
          </div>
        ) : (
          /* List Lowongan */
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/merchant/jobs/${job.id}`}
                className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col gap-2.5 cursor-pointer hover:border-gray-200 hover:shadow-sm active:scale-[0.99] transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#0B1C30] line-clamp-1">
                    {job.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {getStatusBadge(job.status)}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {job.description && (
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>
                )}

                <div className="pt-2 border-t border-gray-100 flex flex-col gap-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                    <span className="font-medium">
                      {formatSchedule(job.start_at, job.end_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="font-semibold">{job.slots} Mahasiswa</span>
                    </div>

                    <div className="flex items-center gap-1 font-bold text-[#FF6B00]">
                      <Banknote className="w-3.5 h-3.5 shrink-0" />
                      <span>Rp {job.pay_amount.toLocaleString('id-ID')} / orang</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
