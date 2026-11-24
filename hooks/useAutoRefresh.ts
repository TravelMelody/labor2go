'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook untuk auto-refresh data secara berkala dan saat tab kembali fokus.
 * - Memanggil callback saat visibilitychange (hanya ketika tab terlihat / document.visibilityState === 'visible')
 * - Menjalankan timer tiap intervalMs (default 20000ms = 20 detik) HANYA saat tab terlihat
 * - Membersihkan listener dan timer saat unmount
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  intervalMs: number = 20000
) {
  const savedCallback = useRef(callback)

  // Simpan callback terbaru tanpa memicu reset interval
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    // Jalankan callback saat tab browser kembali fokus / terlihat
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        savedCallback.current()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Interval berkala hanya dieksekusi jika tab sedang aktif dilihat
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        savedCallback.current()
      }
    }, intervalMs)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [intervalMs])
}
