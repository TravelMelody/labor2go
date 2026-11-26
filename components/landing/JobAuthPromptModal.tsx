'use client'

import React, { useEffect } from 'react'
import { Lock, X, MapPin } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import type { PublicJobItem } from '@/lib/public-jobs'

interface JobAuthPromptModalProps {
  job: PublicJobItem | null
  onClose: () => void
  onSignIn: (job: PublicJobItem) => void
  onSignUp: (job: PublicJobItem) => void
}

export function JobAuthPromptModal({
  job,
  onClose,
  onSignIn,
  onSignUp,
}: JobAuthPromptModalProps) {
  useEffect(() => {
    if (!job) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [job, onClose])

  if (!job) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-auth-prompt-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup informasi masuk"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-4">
          <Lock className="w-6 h-6" />
        </div>

        <h3
          id="job-auth-prompt-title"
          className="text-lg sm:text-xl font-extrabold text-[#0B1C30] mb-1.5 pr-8"
        >
          Masuk untuk Melihat Detail Lowongan
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
          Anda harus masuk ke akun Labor2Go terlebih dahulu untuk melihat detail
          lengkap lowongan, lokasi peta, serta mengajukan lamaran.
        </p>

        {/* Ringkasan Lowongan yang Dipilih */}
        <div className="p-3.5 rounded-xl bg-[#F8F9FF] border border-gray-100 mb-5">
          <p className="text-xs font-semibold text-gray-500 truncate">
            {job.businessName}
          </p>
          <p className="text-sm font-bold text-[#0B1C30] truncate mt-0.5">
            {job.title}
          </p>
          <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 min-w-0 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              <span className="truncate">
                {job.locationName?.trim() || job.distanceText || 'Sekitar Kampus'}
              </span>
            </span>
            <span className="text-xs font-extrabold text-[#FF6B00] shrink-0">
              {formatRupiah(job.payAmount)}
            </span>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onSignIn(job)}
            className="h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-[#0B1C30] font-bold text-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => onSignUp(job)}
            className="h-11 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold text-sm shadow-sm shadow-[#FF6B00]/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            Daftar
          </button>
        </div>
      </div>
    </div>
  )
}
