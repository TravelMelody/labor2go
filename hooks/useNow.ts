'use client'

import { useState, useEffect } from 'react'

/**
 * Hook untuk menyediakan timestamp saat ini (Date.now()) yang aman dari hydration mismatch.
 * - Saat render awal / hidrasi, nilainya adalah null sehingga badge / elemen berbasis
 *   waktu (seperti badge "Butuh Cepat") tidak ditampilkan.
 * - Setelah komponen mounted di client, nilainya di-set ke Date.now() lalu diperbarui
 *   setiap intervalMs (default 30000ms = 30 detik), dengan cleanup saat unmount.
 */
export function useNow(intervalMs: number = 30000): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())

    const intervalId = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)

    return () => clearInterval(intervalId)
  }, [intervalMs])

  return now
}
