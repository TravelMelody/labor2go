'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  LogOut,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { VerificationStatus } from '@/lib/verification'

export interface SupabaseErrorLike {
  code?: string
  message?: string
  details?: string
  hint?: string
}

/**
 * Mencatat error Supabase sesuai aturan AGENTS.md:
 * - Error bisnis database (code 'P0001') dicatat dengan console.warn
 * - Error tak terduga lainnya dicatat dengan console.error
 */
export function logSupabaseError(context: string, error: SupabaseErrorLike | unknown) {
  const errObj = error as SupabaseErrorLike | null | undefined
  if (errObj?.code === 'P0001') {
    console.warn(`[${context}] Error bisnis database:`, errObj.message ?? errObj)
  } else {
    console.error(`[${context}] Error database:`, error)
  }
}

/**
 * Mengambil maksimal 2 inisial huruf kapital dari nama.
 */
export function getInitials(
  name: string | null | undefined,
  fallback = 'L2'
): string {
  if (!name || !name.trim()) return fallback
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AccountSubpageHeaderProps {
  title: string
  subtitle?: string
  backHref: string
}

export function AccountSubpageHeader({
  title,
  subtitle,
  backHref,
}: AccountSubpageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3">
      <Link
        href={backHref}
        aria-label="Kembali"
        className="w-9 h-9 rounded-full bg-[#F8F9FF] border border-gray-200/80 flex items-center justify-center text-[#0B1C30] hover:bg-gray-100 active:scale-95 transition-all shrink-0"
      >
        <ArrowLeft className="w-4.5 h-4.5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-bold text-[#0B1C30] truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
    </header>
  )
}

interface VerificationStatusBadgeProps {
  verified: boolean
  status: VerificationStatus
  verifiedLabel?: string
}

export function VerificationStatusBadge({
  verified,
  status,
  verifiedLabel = 'Terverifikasi',
}: VerificationStatusBadgeProps) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>{verifiedLabel}</span>
      </span>
    )
  }

  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold">
        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span>Ditolak</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span>Menunggu verifikasi</span>
    </span>
  )
}

export function LockedFieldNotice() {
  return (
    <p className="text-[11px] text-amber-700 flex items-center gap-1 mt-1 font-medium">
      <Lock className="w-3 h-3 shrink-0" />
      <span>Terkunci setelah terverifikasi. Hubungi admin untuk mengubah</span>
    </p>
  )
}

interface AccountMenuItemProps {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
  indicatorColor?: 'emerald' | 'amber' | 'red'
  iconContainerClass?: string
}

export function AccountMenuItem({
  href,
  icon,
  title,
  subtitle,
  indicatorColor,
  iconContainerClass = 'bg-[#EFF4FF] text-[#4E5E82]',
}: AccountMenuItemProps) {
  const dotClass =
    indicatorColor === 'emerald'
      ? 'bg-emerald-500'
      : indicatorColor === 'red'
        ? 'bg-red-500'
        : indicatorColor === 'amber'
          ? 'bg-amber-500'
          : null

  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F8F9FF] active:bg-[#EFF4FF] transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-95 ${iconContainerClass}`}
        >
          {icon}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-[#0B1C30] truncate">
              {title}
            </span>
            {dotClass && <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />}
          </div>
          <span className="text-xs text-gray-500 truncate">{subtitle}</span>
        </div>
      </div>
      <ChevronRight className="w-4.5 h-4.5 text-gray-400 group-hover:text-gray-600 shrink-0 ml-2" />
    </Link>
  )
}

export function LogoutButtonWithDialog() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleConfirmLogout = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        logSupabaseError('LogoutButtonWithDialog.signOut', error)
        setErrorMsg(error.message || 'Gagal keluar akun. Silakan coba lagi.')
        setLoading(false)
        return
      }
      setOpen(false)
      router.push('/')
      router.refresh()
    } catch (err) {
      logSupabaseError('LogoutButtonWithDialog.catch', err)
      setErrorMsg('Terjadi kesalahan saat keluar akun.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null)
          setOpen(true)
        }}
        className="w-full h-12 rounded-full bg-red-50 hover:bg-red-100 border border-red-200/80 text-red-600 flex items-center justify-center gap-2 text-sm font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
      >
        <LogOut className="w-4.5 h-4.5" />
        <span>Keluar Akun</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] px-4"
        >
          <div className="w-full max-w-[360px] bg-white rounded-3xl p-5 shadow-xl border border-gray-100 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => !loading && setOpen(false)}
                disabled={loading}
                aria-label="Tutup dialog"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2
                id="logout-dialog-title"
                className="text-base font-bold text-[#0B1C30]"
              >
                Keluar dari Akun?
              </h2>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Kamu harus masuk kembali dengan akun yang terdaftar untuk mengakses Labor2Go.
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="h-11 rounded-full border border-gray-200 bg-white text-[#0B1C30] text-xs font-bold hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={loading}
                className="h-11 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Keluar...</span>
                  </>
                ) : (
                  <span>Ya, Keluar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
