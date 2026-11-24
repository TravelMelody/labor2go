import React from 'react'
import Link from 'next/link'
import { Star, MapPin, Clock, Users, Zap } from 'lucide-react'
import { CAMPUS, CampusLocation } from '@/lib/campus'
import { getDistanceFromCampus } from '@/lib/geo'
import { formatRupiah, formatJobScheduleWIB } from '@/lib/format'
import { useNow } from '@/hooks/useNow'

export interface JobFeedItem {
  id: string
  umkm_id?: string
  title: string
  description?: string | null
  location_name?: string | null
  lat: number | null
  lng: number | null
  start_at: string
  end_at: string
  pay_amount: number
  slots?: number
  created_at?: string
  business_name: string
  business_type?: string | null
  business_photo?: string | null
  avg_rating: number | null
  review_count: number
  slots_left: number
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | null

interface JobCardProps {
  job: JobFeedItem
  href?: string
  campus?: CampusLocation
  applicationStatus?: ApplicationStatus
}

export function JobCard({
  job,
  href,
  campus = CAMPUS,
  applicationStatus,
}: JobCardProps) {
  const distanceText = getDistanceFromCampus(job.lat, job.lng, campus)
  const scheduleText = formatJobScheduleWIB(job.start_at, job.end_at)
  const hasReviews = job.review_count > 0 && job.avg_rating != null

  const nowMs = useNow()

  // Hitung apakah pekerjaan butuh cepat (jam mulai kurang dari 60 menit dari sekarang)
  // Saat nowMs null (render awal / hidrasi), badge "Butuh Cepat" TIDAK ditampilkan untuk mencegah hydration mismatch
  const startTime = new Date(job.start_at).getTime()
  const diffMinutes = nowMs !== null ? Math.floor((startTime - nowMs) / (1000 * 60)) : -1
  const isUrgent = diffMinutes > 0 && diffMinutes <= 60

  return (
    <Link
      href={href || `/jobs/${job.id}`}
      className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 hover:border-orange-200 transition-all active:scale-[0.99] flex items-start justify-between gap-3 group"
    >
      {/* Kolom Kiri: Info Lowongan (flex-1, min-w-0) */}
      <div className="flex flex-col min-w-0 flex-1">
        {/* Baris 1: Nama usaha + badge kategori + badge rating / baru + badge status lamaran */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 truncate max-w-[130px] sm:max-w-[170px]">
            {job.business_name}
          </span>

          {/* Badge Kategori (business_type) */}
          {job.business_type && (
            <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
              {job.business_type}
            </span>
          )}

          {/* Badge Rating atau "Baru" */}
          {hasReviews ? (
            <div className="flex items-center gap-0.5 bg-orange-50 px-1.5 py-0.5 rounded-full text-[#FF6B00] shrink-0">
              <Star className="w-3 h-3 fill-[#FF6B00]" />
              <span className="text-[10px] font-bold">
                {Number(job.avg_rating).toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
              Baru
            </span>
          )}

          {/* Badge Status Lamaran (Tugas A) */}
          {applicationStatus === 'pending' && (
            <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
              Sudah dilamar
            </span>
          )}
          {applicationStatus === 'accepted' && (
            <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
              Diterima
            </span>
          )}
          {applicationStatus === 'rejected' && (
            <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200/80 shrink-0">
              Tidak dipilih
            </span>
          )}
        </div>

        {/* Baris 2: Judul lowongan (bold, truncate satu baris) */}
        <h3 className="text-sm font-bold text-[#0B1C30] truncate mb-2 group-hover:text-[#FF6B00] transition-colors">
          {job.title}
        </h3>

        {/* 3 Baris Info Tetap (Vertikal tanpa flex-wrap & tanpa titik pemisah) */}
        <div className="flex flex-col gap-1 text-[11px]">
          {/* (a) Pin: Jarak dari kampus (dihilangkan jika lat/lng null tanpa mengubah urutan b & c) */}
          {distanceText && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              <span className="truncate">{distanceText}</span>
            </div>
          )}

          {/* (b) Jam: Hari ini / Besok / tanggal singkat, HH:mm - HH:mm WIB */}
          <div className="flex items-center gap-1.5 text-gray-500">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{scheduleText}</span>
          </div>

          {/* (c) Orang: Tersisa N slot (warna oranye) */}
          <div className="flex items-center gap-1.5 text-[#FF6B00] font-semibold">
            <Users className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
            <span className="truncate">Tersisa {job.slots_left} slot</span>
          </div>

          {/* Badge Butuh Cepat: hanya tampil jika jam mulai kurang dari 60 menit dari sekarang */}
          {isUrgent && (
            <div className="flex items-center gap-1 text-[#FF6B00] font-bold mt-0.5">
              <Zap className="w-3.5 h-3.5 text-[#FF6B00] fill-[#FF6B00] shrink-0" />
              <span className="truncate">Butuh Cepat (Mulai {diffMinutes} mnt lagi)</span>
            </div>
          )}
        </div>
      </div>

      {/* Kolom Kanan: Pill Harga (shrink-0, rata atas, whitespace-nowrap) */}
      <div className="shrink-0 pt-0.5">
        <span className="inline-block bg-[#FF6B00] text-white px-3 py-1.5 rounded-full font-bold text-xs shadow-sm shadow-orange-500/20 group-hover:bg-[#E05E00] active:scale-95 transition-all text-center whitespace-nowrap">
          {formatRupiah(job.pay_amount)}
        </span>
      </div>
    </Link>
  )
}
