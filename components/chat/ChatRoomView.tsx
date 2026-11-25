'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  Lock,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react'
import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimePostgresInsertPayload,
  type RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  formatChatDateSeparatorWIB,
  formatTimeWIB,
  getWibDateKey,
} from '@/lib/format'

export interface ChatMessage {
  id: string
  application_id: string
  sender_id: string
  receiver_id: string
  body: string
  created_at: string
  read_at: string | null
  _optimistic?: boolean
}

interface ChatRoomViewProps {
  applicationId: string
  currentUserId: string
  counterpartId: string
  counterpartName: string
  jobTitle: string
  initialStatus: string
  initialMessages: ChatMessage[]
  fallbackHref: string
}

const MAX_BODY_LENGTH = 1000
const COUNTER_THRESHOLD = 800

function getFirstNameLabel(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Pengguna'
  return trimmed.charAt(0).toUpperCase()
}

export function ChatRoomView({
  applicationId,
  currentUserId,
  counterpartId,
  counterpartName,
  jobTitle,
  initialStatus,
  initialMessages,
  fallbackHref,
}: ChatRoomViewProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [applicationStatus, setApplicationStatus] = useState<string>(initialStatus)
  const [showSafetyNote, setShowSafetyNote] = useState<boolean>(true)
  const [draft, setDraft] = useState<string>('')
  const [isSending, setIsSending] = useState<boolean>(false)
  const [toastError, setToastError] = useState<string | null>(null)
  const [channelStatus, setChannelStatus] = useState<string>('JOINING')
  const [hasNewWhileScrolledUp, setHasNewWhileScrolledUp] = useState<boolean>(false)

  const listRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const isAtBottomRef = useRef<boolean>(true)
  const isSendingRef = useRef<boolean>(false)
  const markingReadRef = useRef<boolean>(false)
  const shouldScrollToBottomOnMountRef = useRef<boolean>(true)

  const isClosed = applicationStatus !== 'accepted'

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    isAtBottomRef.current = true
    setHasNewWhileScrolledUp(false)
  }, [])

  // Auto-dismiss error toast
  useEffect(() => {
    if (!toastError) return
    const timer = setTimeout(() => {
      setToastError(null)
    }, 4500)
    return () => clearTimeout(timer)
  }, [toastError])

  // Tandai pesan masuk sebagai sudah dibaca via RPC mark_thread_read
  const markThreadRead = useCallback(async () => {
    if (markingReadRef.current) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    markingReadRef.current = true
    try {
      const { error } = await supabase.rpc('mark_thread_read', {
        p_application_id: applicationId,
      })
      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan mark_thread_read:', error.message)
        } else {
          console.error('Gagal mark_thread_read:', error)
        }
      }
    } catch (err) {
      console.error('Exception saat mark_thread_read:', err)
    } finally {
      markingReadRef.current = false
    }
  }, [applicationId, supabase])

  // Scroll ke bawah saat awal membuka halaman dan tandai terbaca
  useEffect(() => {
    if (shouldScrollToBottomOnMountRef.current) {
      shouldScrollToBottomOnMountRef.current = false
      requestAnimationFrame(() => {
        scrollToBottom('auto')
      })
    }
    void markThreadRead()
  }, [markThreadRead, scrollToBottom])

  // Pantau posisi scroll untuk smart auto-scroll
  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distanceFromBottom < 80
    isAtBottomRef.current = nearBottom
    if (nearBottom && hasNewWhileScrolledUp) {
      setHasNewWhileScrolledUp(false)
    }
  }

  // Merge pesan dari server sambil menjaga pesan optimistis yang masih dikirim & deduplikasi id
  const mergeServerMessages = useCallback((serverRows: ChatMessage[]) => {
    setMessages((prev) => {
      const byId = new Map<string, ChatMessage>()
      for (const row of serverRows) {
        byId.set(row.id, row)
      }

      const serverBodiesBySender = new Set(
        serverRows
          .filter((r) => r.sender_id === currentUserId)
          .map((r) => r.body)
      )

      // Pertahankan pesan optimistis yang belum masuk dari server
      const pendingOptimistic = prev.filter(
        (m) => m._optimistic && !byId.has(m.id) && !serverBodiesBySender.has(m.body)
      )

      const merged = [...serverRows, ...pendingOptimistic]
      merged.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      return merged
    })
  }, [currentUserId])

  // Sinkronisasi ulang status lamaran dan 100 pesan terakhir
  const syncLatestThread = useCallback(async () => {
    try {
      const [appRes, msgsRes] = await Promise.all([
        supabase
          .from('applications')
          .select('status')
          .eq('id', applicationId)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('id, application_id, sender_id, receiver_id, body, created_at, read_at')
          .eq('application_id', applicationId)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (!appRes.error && appRes.data?.status) {
        setApplicationStatus(appRes.data.status)
      }

      if (msgsRes.error) {
        if (msgsRes.error.code === 'P0001') {
          console.warn('Peringatan polling pesan:', msgsRes.error.message)
        } else {
          console.error('Gagal polling pesan:', msgsRes.error)
        }
        return
      }

      const ordered = [...((msgsRes.data ?? []) as ChatMessage[])].reverse()
      const hadUnreadIncoming = ordered.some(
        (m) => m.receiver_id === currentUserId && m.read_at === null
      )

      const wasAtBottom = isAtBottomRef.current
      mergeServerMessages(ordered)

      if (wasAtBottom) {
        requestAnimationFrame(() => scrollToBottom('smooth'))
      }

      if (
        hadUnreadIncoming &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        void markThreadRead()
      }
    } catch (err) {
      console.error('Exception saat sinkronisasi pesan:', err)
    }
  }, [applicationId, currentUserId, markThreadRead, mergeServerMessages, scrollToBottom, supabase])

  // Realtime subscription untuk INSERT & UPDATE pesan
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${applicationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `application_id=eq.${applicationId}`,
        },
        (payload: RealtimePostgresInsertPayload<ChatMessage>) => {
          const incoming = payload.new as ChatMessage | undefined
          if (!incoming?.id) return

          const wasAtBottom = isAtBottomRef.current
          let appendedNew = false

          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) {
              return prev
            }

            // Jika pesan ini berasal dari diri sendiri yang masih optimistis, ganti item optimistisnya
            if (incoming.sender_id === currentUserId) {
              const optIdx = prev.findIndex(
                (m) => m._optimistic && m.sender_id === currentUserId && m.body === incoming.body
              )
              if (optIdx !== -1) {
                const next = [...prev]
                next[optIdx] = incoming
                return next
              }
            }

            appendedNew = true
            const next = [...prev, incoming]
            next.sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
            return next
          })

          if (incoming.sender_id !== currentUserId) {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
              void markThreadRead()
            }
          }

          if (appendedNew || incoming.sender_id === currentUserId) {
            if (wasAtBottom || incoming.sender_id === currentUserId) {
              requestAnimationFrame(() => scrollToBottom('smooth'))
            } else {
              setHasNewWhileScrolledUp(true)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `application_id=eq.${applicationId}`,
        },
        (payload: RealtimePostgresUpdatePayload<ChatMessage>) => {
          const updated = payload.new as ChatMessage | undefined
          if (!updated?.id) return
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated, _optimistic: false } : m))
          )
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        setChannelStatus(status)
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [applicationId, currentUserId, markThreadRead, scrollToBottom, supabase])

  // Cadangan polling 10 detik bila channel tidak SUBSCRIBED
  useEffect(() => {
    if (channelStatus === 'SUBSCRIBED') return

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void syncLatestThread()
      }
    }, 10000)

    return () => clearInterval(timer)
  }, [channelStatus, syncLatestThread])

  // Saat tab kembali terlihat, tandai terbaca & perbarui status lamaran
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void markThreadRead()
        void syncLatestThread()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [markThreadRead, syncLatestThread])

  // Auto-tinggi textarea saat teks berubah
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [draft, adjustTextareaHeight])

  // Kirim pesan lewat rpc('send_message') dengan tampilan optimistis + rollback
  const handleSend = async () => {
    if (isClosed || isSendingRef.current) return
    const trimmed = draft.trim()
    if (!trimmed) return

    if (trimmed.length > MAX_BODY_LENGTH) {
      setToastError(`Pesan maksimal ${MAX_BODY_LENGTH} karakter`)
      return
    }

    isSendingRef.current = true
    setIsSending(true)
    setToastError(null)

    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const previousDraft = draft
    const optimisticMsg: ChatMessage = {
      id: tempId,
      application_id: applicationId,
      sender_id: currentUserId,
      receiver_id: counterpartId,
      body: trimmed,
      created_at: new Date().toISOString(),
      read_at: null,
      _optimistic: true,
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setDraft('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    requestAnimationFrame(() => scrollToBottom('smooth'))

    try {
      const { data: realId, error } = await supabase.rpc('send_message', {
        p_application_id: applicationId,
        p_body: trimmed,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan send_message:', error.message)
        } else {
          console.error('Error send_message:', error)
        }

        // Rollback pesan optimistis & kembalikan teks jika kolom masih kosong
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setDraft((current) => (current === '' ? previousDraft : current))
        setToastError(error.message || 'Gagal mengirim pesan.')

        // Jika status lamaran berubah (mis. ditutup), sinkronkan ulang
        void syncLatestThread()
        return
      }

      if (typeof realId === 'string' && realId) {
        setMessages((prev) => {
          const alreadyHasReal = prev.some((m) => m.id === realId)
          if (alreadyHasReal) {
            return prev.filter((m) => m.id !== tempId)
          }
          return prev.map((m) =>
            m.id === tempId ? { ...m, id: realId, _optimistic: false } : m
          )
        })
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _optimistic: false } : m))
        )
      }
    } catch (err) {
      console.error('Exception saat send_message:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setDraft((current) => (current === '' ? previousDraft : current))
      setToastError('Terjadi kesalahan jaringan saat mengirim pesan.')
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleBack = () => {
    const hasSameOriginReferrer =
      typeof window !== 'undefined' &&
      Boolean(document.referrer) &&
      document.referrer.startsWith(window.location.origin) &&
      document.referrer !== window.location.href &&
      window.history.length > 1

    if (hasSameOriginReferrer) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      {/* Toast Error */}
      {toastError && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[396px] animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl shadow-xl border bg-rose-50/95 border-rose-200 text-rose-900 text-xs font-semibold backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1 leading-snug">{toastError}</span>
            <button
              type="button"
              onClick={() => setToastError(null)}
              aria-label="Tutup notifikasi"
              className="p-0.5 rounded-full hover:bg-black/5 text-gray-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile-first shell (~420px) */}
      <div className="w-full max-w-[420px] h-dvh bg-[#F8F9FF] flex flex-col relative shadow-xs">
        {/* 1. Header */}
        <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-gray-100 px-3.5 py-3 flex items-center gap-3 z-20">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Kembali"
            className="w-9 h-9 rounded-full bg-[#F8F9FF] border border-gray-200/80 flex items-center justify-center text-[#0B1C30] hover:bg-gray-100 active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>

          <div className="w-9 h-9 rounded-full bg-orange-100 text-[#FF6B00] font-extrabold text-sm flex items-center justify-center shrink-0 border border-orange-200">
            {getFirstNameLabel(counterpartName)}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-extrabold text-[#0B1C30] truncate leading-tight">
              {counterpartName}
            </h1>
            <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
              {jobTitle}
            </p>
          </div>
        </header>

        {/* 2. Catatan keamanan (bisa ditutup) */}
        {showSafetyNote && (
          <div className="shrink-0 px-3.5 pt-2.5">
            <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl px-3 py-2 flex items-start gap-2 text-[11px] text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="flex-1 leading-snug font-medium">
                Demi keamanan, bayar lewat Labor2Go. Jangan bagikan PIN, OTP, atau data pembayaran di chat.
              </p>
              <button
                type="button"
                onClick={() => setShowSafetyNote(false)}
                aria-label="Tutup catatan keamanan"
                className="p-0.5 rounded-full text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Daftar Pesan */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3.5 py-4 flex flex-col gap-2"
        >
          {messages.length === 0 ? (
            <div className="my-auto text-center px-6 py-8">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mx-auto mb-3">
                <Send className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#0B1C30]">Belum ada pesan</p>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                {isClosed
                  ? 'Percakapan ini telah ditutup tanpa riwayat pesan.'
                  : 'Mulai obrolan untuk koordinasi jadwal dan detail tugas.'}
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.sender_id === currentUserId
              const currentDayKey = getWibDateKey(msg.created_at)
              const prevDayKey = idx > 0 ? getWibDateKey(messages[idx - 1].created_at) : ''
              const showDateDivider = currentDayKey !== prevDayKey

              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-2">
                      <span className="px-3 py-1 rounded-full bg-white border border-gray-200/80 text-[10px] font-bold text-gray-500 shadow-2xs">
                        {formatChatDateSeparatorWIB(msg.created_at)}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isOwn
                          ? 'bg-[#FF6B00] text-white rounded-br-sm shadow-xs shadow-orange-500/20'
                          : 'bg-white text-[#0B1C30] border border-gray-100 rounded-bl-sm shadow-xs'
                      } ${msg._optimistic ? 'opacity-80' : ''}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>

                      <div
                        className={`mt-1 flex items-center gap-1.5 text-[10px] ${
                          isOwn ? 'justify-end text-orange-100' : 'justify-start text-gray-400'
                        }`}
                      >
                        <span>{formatTimeWIB(msg.created_at, { includeSuffix: true })}</span>
                        {isOwn && (
                          <span className="inline-flex items-center gap-0.5 font-semibold">
                            {msg._optimistic ? (
                              <span>• Mengirim...</span>
                            ) : msg.read_at ? (
                              <>
                                <span>•</span>
                                <CheckCheck className="w-3 h-3" />
                                <span>Dibaca</span>
                              </>
                            ) : (
                              <>
                                <span>•</span>
                                <Check className="w-3 h-3" />
                                <span>Terkirim</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              )
            })
          )}
        </div>

        {/* Tombol cepat gulir ke bawah bila user sedang menggulir ke atas */}
        {hasNewWhileScrolledUp && (
          <div className="absolute bottom-20 right-4 z-20">
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="px-3 py-1.5 rounded-full bg-[#0B1C30] text-white text-[11px] font-bold shadow-lg flex items-center gap-1 active:scale-95 transition-all"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Pesan baru</span>
            </button>
          </div>
        )}

        {/* 4. Input / Status Percakapan Ditutup */}
        {isClosed ? (
          <footer className="shrink-0 bg-white border-t border-gray-200/80 px-4 py-3.5 flex items-center justify-center gap-2 text-xs font-bold text-gray-500">
            <Lock className="w-4 h-4 text-gray-400 shrink-0" />
            <span>Percakapan ditutup</span>
          </footer>
        ) : (
          <footer className="shrink-0 bg-white border-t border-gray-200/80 px-3.5 py-2.5">
            {draft.length > COUNTER_THRESHOLD && (
              <div className="flex justify-end mb-1 pr-1">
                <span
                  className={`text-[10px] font-bold ${
                    draft.length >= MAX_BODY_LENGTH ? 'text-rose-600' : 'text-gray-400'
                  }`}
                >
                  {draft.length}/{MAX_BODY_LENGTH}
                </span>
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={MAX_BODY_LENGTH}
                rows={1}
                placeholder="Tulis pesan..."
                aria-label="Tulis pesan"
                className="flex-1 resize-none rounded-2xl bg-[#F8F9FF] border border-gray-200 px-3.5 py-2.5 text-xs text-[#0B1C30] placeholder:text-gray-400 focus:outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/15 max-h-32 leading-relaxed"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || !draft.trim()}
                aria-label="Kirim pesan"
                className="w-10 h-10 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/25 active:scale-95 transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
