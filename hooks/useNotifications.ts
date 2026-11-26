'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

export interface NotificationItem {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  ref_id: string | null
  read_at: string | null
  created_at: string
}

const MAX_NOTIFICATIONS = 30

export function useNotifications(userId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), [])
  const enabled = Boolean(userId)

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const refresh = useCallback(async () => {
    if (!enabled || !userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, link, ref_id, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS)

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan memuat notifikasi:', error.message)
        } else {
          console.error('Gagal memuat notifikasi:', error)
        }
        return
      }

      setNotifications((data ?? []) as NotificationItem[])
    } catch (err) {
      console.error('Exception saat memuat notifikasi:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, supabase, userId])

  useEffect(() => {
    if (!enabled || !userId) {
      return
    }

    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresInsertPayload<NotificationItem>) => {
          const incoming = payload.new as NotificationItem | undefined
          if (!incoming?.id) return
          setNotifications((prev) => {
            const without = prev.filter((item) => item.id !== incoming.id)
            return [incoming, ...without].slice(0, MAX_NOTIFICATIONS)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresUpdatePayload<NotificationItem>) => {
          const updated = payload.new as NotificationItem | undefined
          if (!updated?.id) return
          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === updated.id)
            const next = exists
              ? prev.map((item) => (item.id === updated.id ? updated : item))
              : [updated, ...prev]
            return next
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
              .slice(0, MAX_NOTIFICATIONS)
          })
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [enabled, refresh, supabase, userId])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, refresh])

  useAutoRefresh(() => {
    if (enabled) {
      void refresh()
    }
  }, 20000)

  const activeNotifications = useMemo(
    () => (enabled ? notifications : []),
    [enabled, notifications]
  )

  const unreadCount = useMemo(
    () => activeNotifications.filter((item) => item.read_at === null).length,
    [activeNotifications]
  )

  const markAsRead = useCallback(
    async (id: string) => {
      if (!enabled) return
      const nowIso = new Date().toISOString()
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id && !item.read_at ? { ...item, read_at: nowIso } : item
        )
      )

      const { error } = await supabase.rpc('mark_notifications_read', {
        p_ids: [id],
      })
      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan mark_notifications_read:', error.message)
        } else {
          console.error('Gagal menandai notifikasi dibaca:', error)
        }
      }
    },
    [enabled, supabase]
  )

  const markAllAsRead = useCallback(async () => {
    if (!enabled || unreadCount === 0) return
    const nowIso = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: nowIso }))
    )

    const { error } = await supabase.rpc('mark_notifications_read')
    if (error) {
      if (error.code === 'P0001') {
        console.warn('Peringatan mark_notifications_read all:', error.message)
      } else {
        console.error('Gagal menandai semua notifikasi dibaca:', error)
      }
    }
  }, [enabled, supabase, unreadCount])

  return {
    notifications: activeNotifications,
    unreadCount,
    loading: enabled ? loading : false,
    markAsRead,
    markAllAsRead,
    refresh,
  }
}
