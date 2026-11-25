'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface PublicBackHeaderProps {
  title: string
  subtitle?: string
  fallbackHref?: string
}

export function PublicBackHeader({
  title,
  subtitle,
  fallbackHref = '/login',
}: PublicBackHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Kembali"
        className="w-9 h-9 rounded-full bg-[#F8F9FF] border border-gray-200/80 flex items-center justify-center text-[#0B1C30] hover:bg-gray-100 active:scale-95 transition-all shrink-0 cursor-pointer"
      >
        <ArrowLeft className="w-4.5 h-4.5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-bold text-[#0B1C30] truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
    </header>
  )
}
