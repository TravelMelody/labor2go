'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

interface UseUnreadMessagesOptions {
  enabled?: boolean
  intervalMs?: number
}

/**
 * Mengambil jumlah pesan belum dibaca untuk user saat ini lewat satu query messages
 * (receiver_id = user.id, read_at is null) dan mengelompokkannya per application_id.
 */
export function useUnreadMessages(
  userId: string | null | undefined,
  options?: UseUnreadMessagesOptions
) {
  const enabled = (options?.enabled ?? true) && Boolean(userId)
  const intervalMs = options?.intervalMs ?? 20000
  const supabase = useMemo(() => createClient(), [])
  const [unreadByAppId, setUnreadByAppId] = useState<Record<string, number>>({})

  const refreshUnread = useCallback(async () => {
    if (!enabled || !userId) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('application_id')
        .eq('receiver_id', userId)
        .is('read_at', null)

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan unread messages:', error.message)
        } else {
          console.error('Gagal memuat pesan belum dibaca:', error)
        }
        return
      }

      const grouped: Record<string, number> = {}
      for (const row of data ?? []) {
        if (row.application_id) {
          grouped[row.application_id] = (grouped[row.application_id] ?? 0) + 1
        }
      }
      setUnreadByAppId(grouped)
    } catch (err) {
      console.error('Exception saat memuat pesan belum dibaca:', err)
    }
  }, [enabled, supabase, userId])

  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => {
      void refreshUnread()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [enabled, refreshUnread])

  useEffect(() => {
    if (!enabled) return
    const handleFocus = () => {
      void refreshUnread()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [enabled, refreshUnread])

  useAutoRefresh(() => {
    if (enabled) {
      void refreshUnread()
    }
  }, intervalMs)

  return {
    unreadByAppId: enabled ? unreadByAppId : {},
    refreshUnread,
  }
}
