import React from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { RoleHomeButton } from '@/components/shared/RoleHomeButton'

export const metadata: Metadata = {
  title: 'Halaman Tidak Ditemukan – Labor2Go',
  description: 'Halaman yang kamu cari tidak tersedia di Labor2Go.',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px] flex flex-col items-center gap-5">
        <Image
          src="/logo.png"
          alt="Labor2Go"
          width={140}
          height={36}
          className="h-9 w-auto object-contain"
          priority
        />

        <div className="w-full bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] text-center flex flex-col items-center gap-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFEDE0] text-[#FF6B00] text-xs font-extrabold tracking-wide">
            404 • Tidak Ditemukan
          </span>

          <div className="w-16 h-16 rounded-2xl bg-[#EFF4FF] text-[#FF6B00] flex items-center justify-center shadow-inner">
            <Compass className="w-8 h-8 stroke-[1.8]" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-extrabold text-[#0B1C30] tracking-tight">
              Halaman Tidak Ditemukan
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              Tautan yang kamu buka mungkin sudah dipindahkan, dihapus, atau alamatnya kurang tepat.
            </p>
          </div>

          <div className="w-full pt-1 flex flex-col gap-2.5">
            <RoleHomeButton variant="primary" />
            <Link
              href="/help"
              className="text-xs font-semibold text-gray-500 hover:text-[#FF6B00] transition-colors py-1"
            >
              Butuh bantuan? Buka Pusat Bantuan
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
