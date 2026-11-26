'use client'

import React, { Suspense, useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  X,
  MapPin,
  Clock,
  ChevronDown,
  Briefcase,
  ArrowLeft,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAMPUS } from '@/lib/campus'
import { calculateHaversineDistance } from '@/lib/geo'
import { JobCard, type JobFeedItem, type ApplicationStatus } from '@/components/student/JobCard'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

type ChipFilter = 'semua' | 'belum_dilamar' | 'dekat' | 'singkat'
type SortOption = 'terbaru' | 'upah_tinggi' | 'mulai_terdekat' | 'terdekat_kampus'

const CATEGORY_OPTIONS = [
  'Semua Kategori',
  'F&B',
  'Kasir',
  'Packing',
  'Event',
  'Retail',
  'Jasa',
  'Lainnya',
] as const

function ExploreSkeleton() {
  return (
    <div className="flex-1 w-full px-4 pt-4 pb-6 flex flex-col gap-4 animate-pulse">
      <div className="w-48 h-6 rounded bg-gray-200" />
      <div className="w-full h-11 rounded-xl bg-gray-200" />
      <div className="flex gap-2">
        <div className="w-20 h-8 rounded-full bg-gray-200" />
        <div className="w-36 h-8 rounded-full bg-gray-200" />
        <div className="w-28 h-8 rounded-full bg-gray-200" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="w-32 h-4 rounded bg-gray-200" />
        <div className="w-24 h-8 rounded-lg bg-gray-200" />
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  )
}

function ExploreContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Ambil state awal dari query string
  const initialQ = searchParams.get('q') || ''
  const initialFilter = (searchParams.get('filter') as ChipFilter) || 'semua'
  const initialKategori = searchParams.get('kategori') || ''
  const initialSort = (searchParams.get('sort') as SortOption) || 'terbaru'

  const [searchInput, setSearchInput] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const [chipFilter, setChipFilter] = useState<ChipFilter>(initialFilter)
  const [selectedCategory, setSelectedCategory] = useState<string>(initialKategori)
  const [sortOption, setSortOption] = useState<SortOption>(initialSort)

  const [jobs, setJobs] = useState<JobFeedItem[]>([])
  const [applicationsMap, setApplicationsMap] = useState<Record<string, ApplicationStatus>>({})
  const [loading, setLoading] = useState(true)

  // Debounce untuk input pencarian (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(searchInput.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Sinkronisasi state filter & sort ke query string URL agar bisa dibagikan (shareable)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (chipFilter !== 'semua') params.set('filter', chipFilter)
    if (selectedCategory && selectedCategory !== 'Semua Kategori') {
      params.set('kategori', selectedCategory)
    }
    if (sortOption !== 'terbaru') params.set('sort', sortOption)

    const queryString = params.toString()
    const newPath = queryString ? `/student/explore?${queryString}` : '/student/explore'
    window.history.replaceState(null, '', newPath)
  }, [debouncedQ, chipFilter, selectedCategory, sortOption])

  // Ambil data dari VIEW jobs_feed (maks 100 baris, urut default created_at desc)
  const fetchJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const { data, error } = await supabase
        .from('jobs_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        const jobsList = data as JobFeedItem[]
        setJobs(jobsList)

        // Ambil status lamaran milik user untuk daftar job yang tampil (1 query batch)
        const {
          data: { user },
        } = await supabase.auth.getUser()

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
      } else if (error) {
        console.error('Error fetching jobs_feed:', error)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchJobs(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchJobs])

  // Sinkronisasi otomatis tiap 20 detik & saat tab kembali fokus tanpa indikator skeleton berkedip
  useAutoRefresh(() => {
    fetchJobs(true)
  }, 20000)

  // Filter & Urutkan data pekerjaan
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        // 1. Filter Pencarian Teks (judul + nama usaha, tidak case-sensitive)
        if (debouncedQ) {
          const qLower = debouncedQ.toLowerCase()
          const matchTitle = job.title?.toLowerCase().includes(qLower)
          const matchBusiness = job.business_name?.toLowerCase().includes(qLower)
          if (!matchTitle && !matchBusiness) return false
        }

        // 2. Chip Filter: Belum Dilamar, Dekat Kampus (<1km) & Shift Singkat (durasi <= 3 jam)
        if (chipFilter === 'belum_dilamar') {
          const status = applicationsMap[job.id]
          if (status === 'pending' || status === 'accepted' || status === 'rejected') {
            return false
          }
        } else if (chipFilter === 'dekat') {
          if (job.lat == null || job.lng == null) return false
          const distKm = calculateHaversineDistance(CAMPUS.lat, CAMPUS.lng, job.lat, job.lng)
          if (distKm >= 1) return false
        } else if (chipFilter === 'singkat') {
          const start = new Date(job.start_at).getTime()
          const end = new Date(job.end_at).getTime()
          const durationHours = (end - start) / (1000 * 60 * 60)
          if (durationHours > 3) return false
        }

        // 3. Filter Kategori (business_type atau judul)
        if (selectedCategory && selectedCategory !== 'Semua Kategori') {
          const katLower = selectedCategory.toLowerCase()
          const bType = job.business_type?.toLowerCase() || ''
          const title = job.title?.toLowerCase() || ''

          if (katLower === 'f&b') {
            const matchFnb =
              bType.includes('f&b') ||
              bType.includes('fnb') ||
              bType.includes('cafe') ||
              bType.includes('kuliner') ||
              title.includes('f&b') ||
              title.includes('cafe') ||
              title.includes('barista') ||
              title.includes('koki') ||
              title.includes('dapur')
            if (!matchFnb) return false
          } else if (katLower === 'packing') {
            const matchPacking =
              bType.includes('packing') ||
              bType.includes('logistik') ||
              title.includes('packing') ||
              title.includes('paket') ||
              title.includes('sortir') ||
              title.includes('gudang')
            if (!matchPacking) return false
          } else if (katLower === 'kasir') {
            const matchKasir = bType.includes('kasir') || title.includes('kasir')
            if (!matchKasir) return false
          } else {
            const matchGeneral = bType.includes(katLower) || title.includes(katLower)
            if (!matchGeneral) return false
          }
        }

        return true
      })
      .sort((a, b) => {
        // 4. Urutkan: Terbaru, Upah Tertinggi, Mulai Terdekat, Terdekat dari Kampus
        if (sortOption === 'upah_tinggi') {
          return b.pay_amount - a.pay_amount
        }
        if (sortOption === 'mulai_terdekat') {
          return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        }
        if (sortOption === 'terdekat_kampus') {
          const distA =
            a.lat != null && a.lng != null
              ? calculateHaversineDistance(CAMPUS.lat, CAMPUS.lng, a.lat, a.lng)
              : Infinity
          const distB =
            b.lat != null && b.lng != null
              ? calculateHaversineDistance(CAMPUS.lat, CAMPUS.lng, b.lat, b.lng)
              : Infinity
          return distA - distB
        }
        // Default: Terbaru
        return new Date(b.created_at || b.start_at).getTime() - new Date(a.created_at || a.start_at).getTime()
      })
  }, [jobs, applicationsMap, debouncedQ, chipFilter, selectedCategory, sortOption])

  // Reset semua filter
  const handleResetFilters = () => {
    setSearchInput('')
    setDebouncedQ('')
    setChipFilter('semua')
    setSelectedCategory('')
    setSortOption('terbaru')
    router.replace('/student/explore')
  }

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F8F9FF]">
      {/* Top Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-[#0B1C30] tracking-tight truncate">
            Eksplor Lowongan
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            Pekerjaan santai sekitar kampus UNNES
          </p>
        </div>
        <Link
          href="/student"
          aria-label="Kembali ke Beranda"
          className="w-9 h-9 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all shadow-xs shrink-0"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
      </div>

      {/* Filter & Search Bar Section */}
      <div className="px-4 pt-2 flex flex-col gap-3">
        {/* Search Bar Input */}
        <div className="relative flex items-center w-full">
          <Search className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari shift, posisi, atau nama toko..."
            className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white text-xs font-medium text-[#0B1C30] placeholder:text-gray-400 shadow-xs border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 focus:border-[#FF6B00] transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Hapus teks pencarian"
              className="absolute right-3 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Chip Filter Bar (Semua, Belum Dilamar, Dekat Kampus, Shift Singkat, Dropdown Kategori) */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 -mx-4 px-4 no-scrollbar">
          {/* Chip: Semua */}
          <button
            type="button"
            onClick={() => {
              setChipFilter('semua')
            }}
            className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-bold transition-all active:scale-95 shadow-xs ${
              chipFilter === 'semua'
                ? 'bg-[#FF6B00] text-white shadow-orange-500/20'
                : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
            }`}
          >
            Semua
          </button>

          {/* Chip: Belum dilamar */}
          <button
            type="button"
            onClick={() => setChipFilter(chipFilter === 'belum_dilamar' ? 'semua' : 'belum_dilamar')}
            className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-bold transition-all active:scale-95 shadow-xs ${
              chipFilter === 'belum_dilamar'
                ? 'bg-[#FF6B00] text-white shadow-orange-500/20'
                : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
            }`}
          >
            Belum dilamar
          </button>

          {/* Chip: Dekat Kampus (<1km) */}
          <button
            type="button"
            onClick={() => setChipFilter(chipFilter === 'dekat' ? 'semua' : 'dekat')}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-xs ${
              chipFilter === 'dekat'
                ? 'bg-[#FF6B00] text-white shadow-orange-500/20'
                : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Dekat Kampus (&lt;1km)</span>
          </button>

          {/* Chip: Shift Singkat (<=3 Jam) */}
          <button
            type="button"
            onClick={() => setChipFilter(chipFilter === 'singkat' ? 'semua' : 'singkat')}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-xs ${
              chipFilter === 'singkat'
                ? 'bg-[#FF6B00] text-white shadow-orange-500/20'
                : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Shift Singkat (&le;3 Jam)</span>
          </button>

          {/* Dropdown Kategori */}
          <div className="relative shrink-0 inline-flex items-center">
            <select
              value={selectedCategory || 'Semua Kategori'}
              onChange={(e) => {
                const val = e.target.value
                setSelectedCategory(val === 'Semua Kategori' ? '' : val)
              }}
              className={`appearance-none h-8 pl-3 pr-7 rounded-full text-xs font-bold shadow-xs cursor-pointer focus:outline-none transition-all ${
                selectedCategory && selectedCategory !== 'Semua Kategori'
                  ? 'bg-orange-50 border border-orange-200 text-[#FF6B00]'
                  : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
              }`}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Semua Kategori' ? 'Semua Kategori' : `Kategori: ${cat}`}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Counter & Urutkan Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-gray-500">
            Menampilkan <strong className="text-[#0B1C30] font-bold">{filteredJobs.length}</strong> lowongan
          </span>

          <div className="relative inline-flex items-center max-w-full">
            <div className="flex items-center gap-1.5 bg-white border border-gray-200/80 rounded-xl px-2.5 py-1.5 shadow-xs max-w-full">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="appearance-none bg-transparent text-xs font-semibold text-[#0B1C30] pr-5 focus:outline-none cursor-pointer"
              >
                <option value="terbaru">Terbaru</option>
                <option value="upah_tinggi">Upah Tertinggi</option>
                <option value="mulai_terdekat">Mulai Terdekat</option>
                <option value="terdekat_kampus">Terdekat dari Kampus</option>
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Content: List of Jobs / Empty State */}
      <div className="flex-1 px-4 pt-3 pb-8">
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-200" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          /* Empty State yang Ramah */
          <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-xs text-center flex flex-col items-center justify-center py-10 my-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-3.5 shadow-inner">
              <Briefcase className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h3 className="text-base font-bold text-[#0B1C30] mb-1.5">
              Tidak Ada Lowongan yang Cocok
            </h3>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-5">
              {debouncedQ || chipFilter !== 'semua' || selectedCategory
                ? 'Tidak ditemukan lowongan dengan kriteria filter saat ini. Coba ubah kata kunci atau reset filter.'
                : 'Belum ada lowongan pekerjaan mikro yang aktif saat ini. Silakan cek kembali nanti.'}
            </p>
            {(debouncedQ || chipFilter !== 'semua' || selectedCategory) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF6B00] text-white text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-transform"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                applicationStatus={applicationsMap[job.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StudentExplorePage() {
  return (
    <Suspense fallback={<ExploreSkeleton />}>
      <ExploreContent />
    </Suspense>
  )
}
