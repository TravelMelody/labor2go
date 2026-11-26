'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  SlidersHorizontal,
  Flame,
  Wallet,
  Banknote,
  Utensils,
  Receipt,
  Package,
  Sparkles,
  Briefcase,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAMPUS } from '@/lib/campus'
import { formatRupiah, getFirstName } from '@/lib/format'
import { JobCard, type JobFeedItem, type ApplicationStatus } from '@/components/student/JobCard'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  VerificationBanner,
  VerifiedBadge,
} from '@/components/shared/VerificationBanner'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { getInitials } from '@/components/account/AccountShared'
import {
  normalizeVerificationStatus,
  type VerificationStatus,
} from '@/lib/verification'

interface StudentData {
  fullName: string
  avatarUrl: string | null
  university: string
  level: number
  verificationStatus: VerificationStatus
  verificationNote: string | null
  walletBalance: number
}

export default function StudentHomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [student, setStudent] = useState<StudentData | null>(null)
  const [jobs, setJobs] = useState<JobFeedItem[]>([])
  const [applicationsMap, setApplicationsMap] = useState<Record<string, ApplicationStatus>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchHomeData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/?auth=signin&redirectTo=/student')
        return
      }

      setUserId(user.id)

      // 1. Ambil data profil dasar
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, verified, verification_status, verification_note, role')
        .eq('id', user.id)
        .maybeSingle()

      // 2. Ambil data profil mahasiswa
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('university, level')
        .eq('id', user.id)
        .maybeSingle()

      // 3. Ambil saldo dompet mahasiswa (hanya membaca wallets.balance)
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()

      setStudent({
        fullName:
          profile?.full_name || user.user_metadata?.full_name || 'Mahasiswa',
        avatarUrl: profile?.avatar_url ?? null,
        university:
          studentProfile?.university || CAMPUS.name,
        level: studentProfile?.level || 1,
        verificationStatus: normalizeVerificationStatus(
          profile?.verification_status,
          profile?.verified
        ),
        verificationNote: profile?.verification_note ?? null,
        walletBalance: wallet?.balance ? Number(wallet.balance) : 0,
      })

      // 4. Ambil 5 lowongan terbaru HANYA dari view jobs_feed (urut created_at desc)
      const { data: feedData, error: feedError } = await supabase
        .from('jobs_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!feedError && feedData) {
        const jobsList = feedData as JobFeedItem[]
        setJobs(jobsList)

        // Ambil status lamaran milik user untuk daftar job yang tampil (1 query batch)
        const jobIds = jobsList.map((j: JobFeedItem) => j.id)
        if (jobIds.length > 0 && user) {
          const { data: appsData, error: appsError } = await supabase
            .from('applications')
            .select('job_id, status')
            .eq('student_id', user.id)
            .in('job_id', jobIds)

          if (!appsError && appsData) {
            const map: Record<string, ApplicationStatus> = {}
            appsData.forEach((app: { job_id: string; status: string }) => {
              map[app.job_id] = app.status as ApplicationStatus
            })
            setApplicationsMap(map)
          }
        }
      }
    } catch (err) {
      console.error('Gagal memuat data beranda mahasiswa:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchHomeData(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchHomeData])

  // Sinkronisasi otomatis tiap 20 detik & saat tab kembali fokus tanpa kedipan skeleton
  useAutoRefresh(() => {
    fetchHomeData(true)
  }, 20000)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (query) {
      router.push(`/student/explore?q=${encodeURIComponent(query)}`)
    } else {
      router.push('/student/explore')
    }
  }

  const handleSearchFocus = () => {
    // Arahkan ke /student/explore saat difokus
    if (searchQuery.trim()) {
      router.push(`/student/explore?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/student/explore')
    }
  }

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F8F9FF]">
      {/* Sticky Header Top Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#F8F9FF]/90 backdrop-blur-xl border-b border-slate-200/60">
        <div className="h-16 px-4 flex items-center justify-between">
          <Image
            src="/logo.png"
            alt="Labor2Go"
            width={120}
            height={32}
            className="h-7 w-auto object-contain"
            priority
          />
          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} />
            <Link
              href="/student/account"
              aria-label="Profil & Pengaturan Akun"
              className="relative w-9 h-9 rounded-full overflow-hidden bg-[#FFEDE0] text-[#FF6B00] border border-orange-200/80 flex items-center justify-center font-bold text-xs shadow-xs hover:opacity-90 transition-opacity shrink-0"
            >
              {student?.avatarUrl ? (
                <Image
                  src={student.avatarUrl}
                  alt={student.fullName}
                  fill
                  className="object-cover"
                  sizes="36px"
                  unoptimized
                />
              ) : (
                <span>{getInitials(student?.fullName, 'M')}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 pt-4 pb-6 flex flex-col gap-5">
        {/* Loading Skeleton */}
        {loading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {/* Top Card Skeleton */}
            <div className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] flex flex-col gap-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gray-200" />
                  <div className="flex items-center gap-1.5">
                    <div className="w-28 h-4 rounded bg-gray-200" />
                  </div>
                </div>
                <div className="w-16 h-6 rounded-full bg-gray-200" />
              </div>
              <div className="w-full h-11 rounded-full bg-gray-100" />
              <div className="w-full h-16 rounded-2xl bg-gray-100" />
            </div>

            {/* Categories Skeleton */}
            <div className="flex flex-col gap-2">
              <div className="w-24 h-4 rounded bg-gray-200" />
              <div className="grid grid-cols-4 gap-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 rounded-2xl bg-gray-200" />
                ))}
              </div>
            </div>

            {/* Jobs Feed Skeleton */}
            <div className="flex flex-col gap-3">
              <div className="w-48 h-5 rounded bg-gray-200" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-gray-200" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {student && (
              <VerificationBanner
                status={student.verificationStatus}
                note={student.verificationNote}
                roleLabel="student"
              />
            )}

            {/* TOP CARD: Greeting, Level Badge, Search & Saldo Dompet */}
            <section className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] flex flex-col gap-4 border border-gray-100">
              {/* Sapaan & Badge Level */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-11 h-11 rounded-full overflow-hidden bg-[#FFEDE0] text-[#FF6B00] border border-orange-200/70 flex items-center justify-center font-bold text-base shrink-0 shadow-inner">
                    {student?.avatarUrl ? (
                      <Image
                        src={student.avatarUrl}
                        alt={student.fullName}
                        fill
                        className="object-cover"
                        sizes="44px"
                        unoptimized
                      />
                    ) : (
                      <span>{getFirstName(student?.fullName).charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-base text-[#0B1C30] truncate">
                        Halo, {getFirstName(student?.fullName)}
                      </span>
                      {student?.verificationStatus === 'approved' && (
                        <VerifiedBadge />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 truncate">
                      {student?.university}
                    </span>
                  </div>
                </div>

                {/* Badge Level */}
                <div className="flex items-center gap-1 bg-[#EFF4FF] px-2.5 py-1 rounded-full text-slate-700 shrink-0 border border-blue-100/60">
                  <Flame className="w-3.5 h-3.5 text-[#FF6B00] fill-[#FF6B00]" />
                  <span className="text-xs font-bold text-[#0B1C30]">
                    Level {student?.level || 1}
                  </span>
                </div>
              </div>

              {/* Pill-shaped Search Bar */}
              <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
                <Search className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  placeholder="Cari kerja dadakan..."
                  className="w-full bg-[#EFF4FF]/70 text-[#0B1C30] placeholder:text-gray-400 rounded-full py-2.5 pl-10 pr-10 text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/30 transition-all border border-transparent focus:border-[#FF6B00]"
                />
                <button
                  type="button"
                  aria-label="Filter lowongan"
                  onClick={() => router.push('/student/explore')}
                  className="absolute right-2 w-7 h-7 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-[#FF6B00] shadow-xs active:scale-95 transition-all"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Saldo Dompet Row */}
              <div className="bg-[#EFF4FF]/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 border border-blue-50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
                    <Wallet className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-gray-500 font-medium">Saldo Dompet</span>
                    <span className="text-base font-extrabold text-[#0B1C30] truncate">
                      {formatRupiah(student?.walletBalance)}
                    </span>
                  </div>
                </div>

                {/* Tombol Tarik Tunai -> arahkan ke halaman dompet */}
                <Link
                  href="/student/wallet"
                  aria-label="Tarik Tunai di Dompet"
                  className="bg-[#FF6B00] hover:bg-[#E05E00] text-white px-3.5 py-2 rounded-full text-xs font-bold shadow-[0_4px_12px_rgba(255,107,0,0.3)] inline-flex items-center gap-1.5 active:scale-95 transition-all shrink-0 whitespace-nowrap"
                >
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span>Tarik Tunai</span>
                </Link>
              </div>
            </section>

            {/* KATEGORI CEPAT (F&B, Kasir, Packing, Event) */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-[#0B1C30]">Kategori Cepat</h2>
                <Link
                  href="/student/explore"
                  className="text-xs font-bold text-[#FF6B00] hover:underline flex items-center gap-0.5"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                {/* 1. F&B */}
                <Link
                  href="/student/explore?kategori=F%26B"
                  className="flex flex-col items-center gap-1.5 p-2 sm:p-2.5 bg-white rounded-2xl shadow-xs border border-gray-100 hover:border-orange-200 active:scale-95 transition-all group min-w-0"
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FFEBD8] flex items-center justify-center text-[#FF6B00] group-hover:scale-105 transition-transform shadow-inner">
                    <Utensils className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-[#0B1C30] truncate max-w-full">F&amp;B</span>
                </Link>

                {/* 2. Kasir */}
                <Link
                  href="/student/explore?kategori=Kasir"
                  className="flex flex-col items-center gap-1.5 p-2 sm:p-2.5 bg-white rounded-2xl shadow-xs border border-gray-100 hover:border-blue-200 active:scale-95 transition-all group min-w-0"
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#DDF4FF] flex items-center justify-center text-[#36558F] group-hover:scale-105 transition-transform shadow-inner">
                    <Receipt className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-[#0B1C30] truncate max-w-full">Kasir</span>
                </Link>

                {/* 3. Packing */}
                <Link
                  href="/student/explore?kategori=Packing"
                  className="flex flex-col items-center gap-1.5 p-2 sm:p-2.5 bg-white rounded-2xl shadow-xs border border-gray-100 hover:border-emerald-200 active:scale-95 transition-all group min-w-0"
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#DCFCE7] flex items-center justify-center text-[#006C49] group-hover:scale-105 transition-transform shadow-inner">
                    <Package className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-[#0B1C30] truncate max-w-full">Packing</span>
                </Link>

                {/* 4. Event */}
                <Link
                  href="/student/explore?kategori=Event"
                  className="flex flex-col items-center gap-1.5 p-2 sm:p-2.5 bg-white rounded-2xl shadow-xs border border-gray-100 hover:border-purple-200 active:scale-95 transition-all group min-w-0"
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#F3E8FF] flex items-center justify-center text-[#7E22CE] group-hover:scale-105 transition-transform shadow-inner">
                    <Sparkles className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-[#0B1C30] truncate max-w-full">Event</span>
                </Link>
              </div>
            </section>

            {/* SECTION: Pekerjaan Tersedia Sekarang (5 Lowongan Terbaru) */}
            <section className="flex flex-col gap-3">
              {/* Header Bagian dengan tautan "Lihat Semua" */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex flex-col min-w-0">
                  <h2 className="text-base font-bold text-[#0B1C30] tracking-tight">
                    Pekerjaan Tersedia Sekarang
                  </h2>
                  <p className="text-xs text-gray-500">Pekerjaan santai dekat kampus</p>
                </div>
                <Link
                  href="/student/explore"
                  className="text-xs font-bold text-[#FF6B00] hover:underline flex items-center gap-0.5 shrink-0"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Daftar Kartu Lowongan Menggunakan Komponen Bersama JobCard */}
              {jobs.length === 0 ? (
                /* Empty State Ramah */
                <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-xs text-center flex flex-col items-center justify-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-3">
                    <Briefcase className="w-7 h-7 stroke-[1.8]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1C30] mb-1">
                    Belum Ada Lowongan Aktif
                  </h3>
                  <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-4">
                    UMKM di sekitar kampus belum memposting pekerjaan baru saat ini. Silakan cek berkala atau gunakan pencarian eksplor.
                  </p>
                  <Link
                    href="/student/explore"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF6B00] text-white text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-transform"
                  >
                    <span>Cari di Eksplor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      applicationStatus={applicationsMap[job.id]}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
