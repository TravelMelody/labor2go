'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface SocialLoginButtonProps {
  provider: 'google' | 'whatsapp'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  label?: string
}

export function SocialLoginButton({
  provider,
  onClick,
  disabled = false,
  loading = false,
  label,
}: SocialLoginButtonProps) {
  if (provider === 'google') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full h-12 rounded-full bg-[#EFF4FF] hover:bg-[#E0ECFF] active:scale-[0.98] text-[#0B1C30] font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all border border-[#D8E4FF] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[#FF6B00]" />
        ) : (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
        )}
        <span>{label || 'Lanjutkan dengan Akun Google'}</span>
      </button>
    )
  }

  // WhatsApp Button
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={true}
      className="relative w-full h-12 rounded-full bg-[#128C7E] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 opacity-60 cursor-not-allowed transition-all"
    >
      <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.04 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.07 16.3C4.24 14.98 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.04 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.64 7.89 8 8.49 8 9.72C8 10.95 8.89 12.14 9.02 12.31C9.14 12.47 10.77 14.98 13.25 16.06C13.84 16.32 14.3 16.47 14.66 16.59C15.25 16.77 15.79 16.75 16.22 16.68C16.7 16.61 17.69 16.08 17.89 15.51C18.1 14.94 18.1 14.45 18.04 14.35C17.98 14.24 17.82 14.18 17.58 14.06C17.33 13.94 16.12 13.34 15.89 13.26C15.66 13.17 15.5 13.13 15.34 13.37C15.17 13.62 14.7 14.18 14.56 14.35C14.41 14.51 14.27 14.53 14.03 14.41C13.78 14.29 12.99 14.03 12.05 13.19C11.32 12.54 10.83 11.74 10.69 11.49C10.54 11.25 10.67 11.11 10.8 10.99C10.91 10.88 11.05 10.7 11.17 10.56C11.29 10.42 11.34 10.31 11.42 10.15C11.5 9.99 11.46 9.84 11.4 9.72C11.34 9.6 10.87 8.45 10.67 7.97C10.48 7.51 10.28 7.57 10.13 7.56C10 7.56 9.83 7.34 9.53 7.34Z" />
      </svg>
      <span>{label || 'Masuk dengan Nomor WhatsApp'}</span>
      <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-bold tracking-wide">
        Segera hadir
      </span>
    </button>
  )
}
