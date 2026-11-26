'use client'

import React, { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Zap,
  Clock,
  ShieldCheck,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  GraduationCap,
  Store,
  Briefcase,
  AlertCircle,
  X,
} from 'lucide-react'
import {
  EmailAuthModal,
  type AuthMode,
  type SignupRole,
} from '@/components/auth/EmailAuthModal'
import { PublicJobCard } from '@/components/landing/PublicJobCard'
import { JobAuthPromptModal } from '@/components/landing/JobAuthPromptModal'
import type { PublicJobItem } from '@/lib/public-jobs'

interface LandingPageClientProps {
  jobs: PublicJobItem[]
  initialAuthMode?: AuthMode | null
  initialRedirectTo?: string | null
  initialError?: string | null
}

const FEATURES = [
  {
    title: 'Kerja Fleksibel Sesuai Jadwal Kuliah',
    description:
      'Pilih pekerjaan harian atau per shift di sekitar kampus tanpa kontrak mengikat, cocok disela jadwal kuliah.',
    icon: Clock,
    iconBg: 'bg-[#FFEDE0]',
    iconColor: 'text-[#FF6B00]',
  },
  {
    title: 'Pembayaran Aman Tertahan Sistem',
    description:
      'Upah pekerja ditahan aman di sistem saat lamaran diterima dan langsung cair ke dompet setelah tugas selesai.',
    icon: ShieldCheck,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    title: 'Verifikasi Mahasiswa & UMKM',
    description:
      'Identitas mahasiswa (KTM) dan usaha mitra UMKM diverifikasi oleh admin agar kolaborasi berlangsung tepercaya.',
    icon: BadgeCheck,
    iconBg: 'bg-[#E5EEFF]',
    iconColor: 'text-[#0B1C30]',
  },
] as const

export function LandingPageClient({
  jobs,
  initialAuthMode = null,
  initialRedirectTo = null,
  initialError = null,
}: LandingPageClientProps) {
  const carouselRef = useRef<HTMLDivElement | null>(null)

  const [authModalOpen, setAuthModalOpen] = useState(Boolean(initialAuthMode))
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode ?? 'signin')
  const [signupRole, setSignupRole] = useState<SignupRole>('student')
  const [redirectTo, setRedirectTo] = useState<string | null>(initialRedirectTo)
  const [selectedJob, setSelectedJob] = useState<PublicJobItem | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(
    initialError && !initialAuthMode ? initialError : null
  )

  const clearAuthUrlParams = () => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (
      url.searchParams.has('auth') ||
      url.searchParams.has('redirectTo') ||
      url.searchParams.has('error')
    ) {
      url.searchParams.delete('auth')
      url.searchParams.delete('redirectTo')
      url.searchParams.delete('error')
      const nextUrl =
        url.pathname + (url.search ? url.search : '') + url.hash
      window.history.replaceState({}, '', nextUrl)
    }
  }

  const openAuthModal = (
    mode: AuthMode,
    options?: { role?: SignupRole; nextRedirectTo?: string | null }
  ) => {
    setSelectedJob(null)
    setAuthMode(mode)
    if (options?.role) {
      setSignupRole(options.role)
    }
    if (options && 'nextRedirectTo' in options) {
      setRedirectTo(options.nextRedirectTo ?? null)
    }
    setAuthModalOpen(true)
  }

  const handleCloseAuthModal = () => {
    setAuthModalOpen(false)
    clearAuthUrlParams()
  }

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return
    const amount = 320
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FF] text-[#0B1C30]">
      {/* 1. Top Bar / Header (sticky) */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 min-w-0 shrink"
            aria-label="Beranda Labor2Go"
          >
            <Image
              src="/logo.png"
              alt="Labor2Go"
              width={140}
              height={36}
              className="h-7 sm:h-8 w-auto object-contain"
              priority
            />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="h-9 sm:h-10 px-3.5 sm:px-5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-[#0B1C30] font-bold text-xs sm:text-sm transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer"
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('signup', { role: 'student' })}
              className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold text-xs sm:text-sm shadow-xs shadow-[#FF6B00]/25 transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer"
            >
              Daftar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">
        {/* Alert Banner (jika ada error dari redirect tanpa modal terbuka) */}
        {bannerError && (
          <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bannerError}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerError(null)}
                aria-label="Tutup peringatan"
                className="p-1 text-red-500 hover:text-red-700 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Hero Section */}
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-12 pb-8 sm:pb-12">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_-4px_rgba(11,28,48,0.06)] p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEDE0] text-[#FF6B00] mb-4">
                <Zap className="w-3.5 h-3.5 fill-[#FF6B00]" />
                <span className="text-xs font-bold">
                  Marketplace Kerja Mikro Kampus
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0B1C30] tracking-tight leading-[1.18] mb-3.5">
                Kerja Fleksibel Mahasiswa, Bantuan Sigap untuk{' '}
                <span className="text-[#FF6B00]">UMKM Sekitar Kampus</span>
              </h1>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6 max-w-xl">
                Labor2Go mempertemukan mahasiswa yang mencari penghasilan tambahan
                paruh waktu atau harian dengan pelaku UMKM sekitar kampus yang
                membutuhkan bantuan cepat, aman, dan terverifikasi.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => openAuthModal('signup', { role: 'student' })}
                  className="h-12 px-6 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-md shadow-[#FF6B00]/25 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Mulai Daftar Sekarang</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="h-12 px-6 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-[#0B1C30] font-bold text-sm inline-flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer"
                >
                  Sudah Punya Akun? Masuk
                </button>
              </div>
            </div>

            {/* Ringkasan Dua Peran */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="p-4 rounded-2xl bg-[#FFF7F1] border border-orange-100 flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0B1C30] mb-0.5">
                    Untuk Mahasiswa
                  </h2>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Temukan lowongan harian dekat kos &amp; kampus, atur waktu
                    sendiri, dan terima upah langsung ke dompet digital.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F4F7FF] border border-blue-100/80 flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#E5EEFF] text-[#0B1C30] flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0B1C30] mb-0.5">
                    Untuk Mitra UMKM
                  </h2>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Pasang lowongan bantu toko atau acara dalam hitungan menit,
                    pilih mahasiswa terverifikasi, dengan dana aman tertahan sistem.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Section Fitur Utama */}
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-12">
          <div className="mb-5 sm:mb-6">
            <h2 className="text-lg sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight">
              Kenapa Pakai Labor2Go?
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Dirancang khusus untuk kebutuhan kerja singkat mahasiswa dan operasional UMKM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col gap-3"
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${feature.iconBg} ${feature.iconColor} flex items-center justify-center`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#0B1C30] mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 4. Section Lowongan Terbaru (Horizontal Scroll / Carousel) */}
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-14">
          <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight">
                Lowongan Terbaru
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Intip peluang kerja terbuka terbaru dari UMKM di sekitar kampus.
              </p>
            </div>

            {jobs.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  aria-label="Geser lowongan ke kiri"
                  className="w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-[#0B1C30] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  aria-label="Geser lowongan ke kanan"
                  className="w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-[#0B1C30] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {jobs.length > 0 ? (
            <div
              ref={carouselRef}
              className="flex gap-3.5 sm:gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              {jobs.map((job) => (
                <PublicJobCard
                  key={job.id}
                  job={job}
                  onSelect={(item) => setSelectedJob(item)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0B1C30]">
                  Belum Ada Lowongan Terbuka Saat Ini
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-md">
                  Daftar sekarang sebagai Mahasiswa untuk mendapat peluang terbaru,
                  atau sebagai Merchant untuk mulai memasang lowongan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuthModal('signup', { role: 'student' })}
                className="h-10 px-5 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                Daftar Sekarang
              </button>
            </div>
          )}
        </section>
      </main>

      {/* 5. Footer Ringkas */}
      <footer className="w-full bg-white border-t border-gray-100 mt-auto">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <Image
              src="/logo.png"
              alt="Labor2Go"
              width={110}
              height={28}
              className="h-6 w-auto object-contain"
            />
            <span className="text-xs text-gray-500">
              Marketplace tenaga kerja mikro mahasiswa &amp; UMKM sekitar kampus.
            </span>
          </div>

          <nav
            aria-label="Tautan legal dan bantuan"
            className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-gray-600"
          >
            <Link
              href="/legal/terms"
              className="hover:text-[#FF6B00] transition-colors"
            >
              Syarat &amp; Ketentuan
            </Link>
            <Link
              href="/legal/privacy"
              className="hover:text-[#FF6B00] transition-colors"
            >
              Kebijakan Privasi
            </Link>
            <Link
              href="/help"
              className="hover:text-[#FF6B00] transition-colors"
            >
              Bantuan
            </Link>
          </nav>
        </div>
      </footer>

      {/* Modal Info Masuk saat Klik Kartu Lowongan */}
      <JobAuthPromptModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onSignIn={(job) =>
          openAuthModal('signin', { nextRedirectTo: `/jobs/${job.id}` })
        }
        onSignUp={(job) =>
          openAuthModal('signup', {
            role: 'student',
            nextRedirectTo: `/jobs/${job.id}`,
          })
        }
      />

      {/* Modal Masuk / Daftar */}
      {authModalOpen && (
        <EmailAuthModal
          isOpen={authModalOpen}
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={handleCloseAuthModal}
          initialRole={signupRole}
          redirectTo={redirectTo}
          initialError={initialAuthMode ? initialError : null}
        />
      )}
    </div>
  )
}
