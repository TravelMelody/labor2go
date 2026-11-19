'use client'

import React, { useEffect, useState } from 'react'
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
  X,
  ChevronRight,
  ArrowRight,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah, formatJobScheduleWIB, getFirstName } from '@/lib/format'
import { SERVICE_FEE_PER_WORKER } from '@/lib/pricing'

interface ApplicationItem {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  student_id: string
  student?: {
    id?: string
    full_name?: string | null
  } | null
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

  useEffect(() => {
    async function loadData() {
      try {
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

        // 3. Ambil data jobs milik user beserta applications
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
               student_id
             )`
          )
          .eq('umkm_id', user.id)
          .order('created_at', { ascending: false })

        if (jobsError) {
          console.error('Error saat membaca jobs merchant:', jobsError)
        } else if (jobsData) {
          // Kumpulkan student_id dari lamaran berstatus accepted untuk mengambil nama mahasiswa
          const studentIds = new Set<string>()
          jobsData.forEach((j: any) => {
            if (Array.isArray(j.applications)) {
              j.applications.forEach((a: ApplicationItem) => {
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
              studentProfileMap = profilesData.reduce((acc, curr) => {
                acc[curr.id] = curr.full_name || 'Mahasiswa'
                return acc
              }, {} as Record<string, string>)
            }
          }

          // Pasangkan data student ke applications
          const mappedJobs: JobItem[] = jobsData.map((j: any) => {
            const apps: ApplicationItem[] = (j.applications || []).map(
              (app: any) => ({
                id: app.id,
                status: app.status,
                student_id: app.student_id,
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
        setLoading(false)
      }
    }

    loadData()
  }, [router, supabase])

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
      <div className="flex-1 min-h-[80vh] flex flex-col items-center justify-center p-6 text-slate-500">
        <Loader2 className="w-7 h-7 animate-spin text-[#FF6B00] mb-2" />
        <p className="text-xs font-medium">Memuat lowongan Anda...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col w-full pb-24 bg-[#F8F9FF]">
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
                  className={`pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 ${
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
                    {/* Tombol Batalkan (Hanya untuk aktif, tampil nonaktif 'Segera hadir') */}
                    {activeTab === 'active' && (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        title="Fitur batalkan segera hadir"
                        className="px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-400 text-xs font-medium cursor-not-allowed flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Batalkan</span>
                        <span className="text-[9px] bg-gray-200 text-gray-500 px-1 py-0.2 rounded font-semibold">
                          Segera hadir
                        </span>
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
    </div>
  )
}
