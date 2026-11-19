'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Compass, ArrowLeft, Clock, Search, Filter } from 'lucide-react'

function ExploreContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')
  const kategori = searchParams.get('kategori')

  return (
    <div className="flex-1 flex flex-col px-4 pt-6 pb-8">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/student"
          className="w-9 h-9 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#0B1C30]">Eksplor Lowongan</h1>
          <p className="text-xs text-gray-500">Cari lowongan mikro sekitar kampus</p>
        </div>
      </div>

      {/* Query / Filter Badges if present */}
      {(query || kategori) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {query && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-semibold text-[#0B1C30] shadow-xs">
              <Search className="w-3.5 h-3.5 text-[#FF6B00]" />
              Pencarian: &ldquo;{query}&rdquo;
            </span>
          )}
          {kategori && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-[#FF6B00] shadow-xs">
              <Filter className="w-3.5 h-3.5" />
              Kategori: {kategori}
            </span>
          )}
        </div>
      )}

      {/* Placeholder Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-gray-100 shadow-xs my-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-4 shadow-inner">
          <Compass className="w-8 h-8 stroke-[2]" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-bold mb-2">
          <Clock className="w-3.5 h-3.5" />
          <span>Segera hadir</span>
        </div>
        <h2 className="text-base font-bold text-[#0B1C30] mb-2">
          Eksplorasi & Filter Interaktif
        </h2>
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6">
          Halaman pencarian lowongan penuh dengan peta jarak, filter upah, dan kategori detail akan dikerjakan pada tugas berikutnya.
        </p>
        <Link
          href="/student"
          className="px-5 py-2.5 bg-[#FF6B00] text-white rounded-full text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-transform"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}

export default function StudentExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-gray-400">
          Memuat halaman eksplor...
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  )
}
