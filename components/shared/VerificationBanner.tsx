'use client'

import React from 'react'
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export function normalizeVerificationStatus(
  status: string | null | undefined,
  verified?: boolean | null
): VerificationStatus {
  if (status === 'approved' || (status == null && Boolean(verified))) {
    return 'approved'
  }
  if (status === 'rejected') {
    return 'rejected'
  }
  return 'pending'
}

interface VerificationBannerProps {
  status: VerificationStatus
  note?: string | null
  roleLabel?: 'student' | 'umkm'
  className?: string
}

export function VerificationBanner({
  status,
  note,
  roleLabel,
  className = '',
}: VerificationBannerProps) {
  if (status === 'approved') {
    return null
  }

  if (status === 'rejected') {
    const cleanNote = note?.trim() || 'Data belum sesuai'
    return (
      <div
        className={`p-4 rounded-2xl bg-red-50 border border-red-200 shadow-xs flex items-start gap-3 ${className}`}
      >
        <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-900 mb-0.5">
            Verifikasi Ditolak
          </p>
          <p className="text-[11px] sm:text-xs text-red-800 leading-relaxed">
            Verifikasi ditolak: {cleanNote}. Hubungi admin untuk memperbaiki data.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs flex items-start gap-3 ${className}`}
    >
      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
        <Clock className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-bold text-amber-900">
            Akun kamu menunggu verifikasi admin
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        </div>
        <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
          {roleLabel === 'umkm'
            ? 'Data usaha dan foto tokomu sedang ditinjau oleh admin Labor2Go untuk menjamin keamanan komunitas pekerja.'
            : 'Data mahasiswa dan foto KTM kamu sedang ditinjau oleh admin Labor2Go untuk menjaga kepercayaan mitra UMKM.'}
        </p>
      </div>
    </div>
  )
}

export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Akun Terverifikasi"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[10px] font-bold shrink-0 ${className}`}
    >
      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
      <span>Terverifikasi</span>
    </span>
  )
}
