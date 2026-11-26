'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  MessageCircle,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Wallet,
  Star,
  ShieldCheck,
  X,
  CheckCheck,
  Loader2,
} from 'lucide-react'
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications'
import { formatRelativeTimeID } from '@/lib/format'

interface NotificationBellProps {
  userId: string | null
}

function getNotificationAppearance(type: string): {
  icon: React.ReactNode
  bgClass: string
  textClass: string
} {
  switch (type) {
    case 'chat_message':
      return {
        icon: <MessageCircle className="w-4 h-4" />,
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-600',
      }
    case 'new_applicant':
      return {
        icon: <UserPlus className="w-4 h-4" />,
        bgClass: 'bg-[#FFEDE0]',
        textClass: 'text-[#FF6B00]',
      }
    case 'application_accepted':
    case 'verification_approved':
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-600',
      }
    case 'application_rejected':
    case 'job_cancelled':
      return {
        icon: <XCircle className="w-4 h-4" />,
        bgClass: 'bg-red-50',
        textClass: 'text-red-600',
      }
    case 'reported_no_show':
    case 'verification_rejected':
    case 'withdrawal_rejected':
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-600',
      }
    case 'check_in':
    case 'check_out':
      return {
        icon: <Clock className="w-4 h-4" />,
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-600',
      }
    case 'payment_released':
    case 'refund':
    case 'topup_success':
    case 'withdrawal_processed':
      return {
        icon: <Wallet className="w-4 h-4" />,
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-600',
      }
    case 'review_received':
      return {
        icon: <Star className="w-4 h-4" />,
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-500',
      }
    default:
      if (type.startsWith('verification')) {
        return {
          icon: <ShieldCheck className="w-4 h-4" />,
          bgClass: 'bg-blue-50',
          textClass: 'text-blue-600',
        }
      }
      return {
        icon: <Bell className="w-4 h-4" />,
        bgClass: 'bg-[#FFEDE0]',
        textClass: 'text-[#FF6B00]',
      }
  }
}

function isSafeInternalLink(link: string | null): link is string {
  return Boolean(link && link.startsWith('/') && !link.startsWith('//'))
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useNotifications(userId)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        void refresh()
      }
      return next
    })
  }

  const handleItemClick = (item: NotificationItem) => {
    if (!item.read_at) {
      void markAsRead(item.id)
    }
    setOpen(false)
    if (isSafeInternalLink(item.link)) {
      router.push(item.link)
    }
  }

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={
          unreadCount > 0
            ? `Notifikasi (${unreadCount} belum dibaca)`
            : 'Notifikasi'
        }
        aria-expanded={open}
        className="relative w-9 h-9 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-[#0B1C30] hover:bg-gray-50 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold leading-none flex items-center justify-center ring-2 ring-[#F8F9FF]">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 backdrop-blur-[1px] pt-16 px-3"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Daftar Notifikasi"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header Panel */}
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-extrabold text-[#0B1C30] truncate">
                  Notifikasi
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FFEDE0] text-[#FF6B00] text-[10px] font-bold shrink-0">
                    {unreadCount} baru
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllAsRead()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#FF6B00] hover:bg-[#FFEDE0]/60 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tandai dibaca</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Tutup notifikasi"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {loading && notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF6B00]" />
                  <span className="text-xs font-medium">Memuat notifikasi...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 px-6 text-center flex flex-col items-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#F8F9FF] border border-gray-100 text-gray-400 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0B1C30]">
                      Belum ada notifikasi
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                      Info chat, pelamar baru, penerimaan kerja, dan transaksi akan muncul di sini.
                    </p>
                  </div>
                </div>
              ) : (
                notifications.map((item) => {
                  const appearance = getNotificationAppearance(item.type)
                  const isUnread = item.read_at === null

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50 active:bg-gray-100 cursor-pointer ${
                        isUnread ? 'bg-[#FFF7F2]/80' : 'bg-white'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${appearance.bgClass} ${appearance.textClass}`}
                      >
                        {appearance.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-xs leading-snug ${
                              isUnread
                                ? 'font-extrabold text-[#0B1C30]'
                                : 'font-semibold text-[#0B1C30]'
                            }`}
                          >
                            {item.title}
                          </p>
                          {isUnread && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#FF6B00] shrink-0 mt-1"
                              aria-label="Belum dibaca"
                            />
                          )}
                        </div>

                        {item.body && (
                          <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5 line-clamp-2">
                            {item.body}
                          </p>
                        )}

                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                          {formatRelativeTimeID(item.created_at)}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
