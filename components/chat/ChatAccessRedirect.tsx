'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { setFlashToast } from '@/components/shared/FlashToast'

interface ChatAccessRedirectProps {
  message: string
  fallbackHref: string
}

export function ChatAccessRedirect({ message, fallbackHref }: ChatAccessRedirectProps) {
  const router = useRouter()
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true

    setFlashToast(message, 'error')

    const hasSameOriginReferrer =
      typeof window !== 'undefined' &&
      Boolean(document.referrer) &&
      document.referrer.startsWith(window.location.origin) &&
      document.referrer !== window.location.href &&
      window.history.length > 1

    if (hasSameOriginReferrer) {
      router.back()
    } else {
      router.replace(fallbackHref)
    }
  }, [fallbackHref, message, router])

  return (
    <div className="min-h-screen bg-[#F8F9FF] flex flex-col items-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col items-center justify-center px-6 text-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00]" />
        <p className="text-xs font-medium text-gray-500">Mengalihkan kembali...</p>
      </div>
    </div>
  )
}
