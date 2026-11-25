'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const FLASH_TOAST_KEY = 'labor2go_flash_toast'

export type FlashToastType = 'error' | 'info' | 'success'

interface FlashToastPayload {
  message: string
  type: FlashToastType
}

/**
 * Menyimpan pesan toast lintas halaman di sessionStorage untuk ditampilkan setelah redirect.
 */
export function setFlashToast(message: string, type: FlashToastType = 'error') {
  if (typeof window === 'undefined') return
  try {
    const payload: FlashToastPayload = { message, type }
    window.sessionStorage.setItem(FLASH_TOAST_KEY, JSON.stringify(payload))
  } catch {
    // Abaikan jika storage tidak tersedia
  }
}

export function FlashToast() {
  const pathname = usePathname()
  const [toast, setToast] = useState<FlashToastPayload | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(FLASH_TOAST_KEY)
        if (!raw) return
        window.sessionStorage.removeItem(FLASH_TOAST_KEY)
        const parsed = JSON.parse(raw) as Partial<FlashToastPayload>
        if (parsed?.message) {
          setToast({
            message: parsed.message,
            type:
              parsed.type === 'success' || parsed.type === 'info' || parsed.type === 'error'
                ? parsed.type
                : 'error',
          })
        }
      } catch {
        // Abaikan payload korup
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      setToast(null)
    }, 4500)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-[396px] animate-in fade-in slide-in-from-top-3 duration-200"
    >
      <div
        className={`flex items-start gap-2.5 p-3.5 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-md ${
          toast.type === 'success'
            ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
            : toast.type === 'error'
            ? 'bg-rose-50/95 border-rose-200 text-rose-900'
            : 'bg-blue-50/95 border-blue-200 text-blue-900'
        }`}
      >
        {toast.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : toast.type === 'error' ? (
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        )}
        <span className="flex-1 leading-snug">{toast.message}</span>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Tutup notifikasi"
          className="p-0.5 rounded-full hover:bg-black/5 text-gray-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
