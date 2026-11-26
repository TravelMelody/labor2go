'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { RoleHomeButton } from '@/components/shared/RoleHomeButton'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Terjadi kesalahan aplikasi:', error)
  }, [error])

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
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-[#FF6B00] border border-amber-200/70 flex items-center justify-center shadow-inner">
            <AlertTriangle className="w-8 h-8 stroke-[1.9]" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-extrabold text-[#0B1C30] tracking-tight">
              Terjadi Kesalahan
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              Maaf, halaman mengalami kendala tak terduga. Silakan coba muat ulang atau kembali ke beranda.
            </p>
          </div>

          <div className="w-full pt-1 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Coba lagi</span>
            </button>

            <RoleHomeButton variant="secondary" />
          </div>
        </div>
      </div>
    </div>
  )
}
