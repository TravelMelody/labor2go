'use client'

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ShieldCheck,
  Wallet,
  Users,
  ClipboardList,
  LogOut,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AdminShellProps {
  adminName: string
  children: React.ReactNode
}

const ADMIN_NAV_ITEMS = [
  {
    href: '/admin',
    label: 'Ringkasan',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: '/admin/verifikasi',
    label: 'Verifikasi',
    icon: ShieldCheck,
    exact: false,
  },
  {
    href: '/admin/penarikan',
    label: 'Penarikan',
    icon: Wallet,
    exact: false,
  },
  {
    href: '/admin/pengguna',
    label: 'Pengguna',
    icon: Users,
    exact: false,
  },
  {
    href: '/admin/log',
    label: 'Log Aktivitas',
    icon: ClipboardList,
    exact: false,
  },
] as const

export function AdminShell({ adminName, children }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loggingOut, setLoggingOut] = useState(false)

  const isNavActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col md:flex-row">
      {/* Desktop Sidebar (>= md) */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen bg-white border-r border-gray-100 shadow-xs">
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between gap-2">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Labor2Go"
              width={120}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FFEDE0] text-[#FF6B00] text-[11px] font-bold">
            Admin
          </span>
        </div>

        {/* Admin Identity */}
        <div className="px-5 py-3.5 border-b border-gray-100 bg-[#F8F9FF]/60">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Masuk sebagai
          </p>
          <p className="text-sm font-bold text-[#0B1C30] truncate mt-0.5">
            {adminName}
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isNavActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? 'bg-[#FFEDE0] text-[#FF6B00] font-bold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-[#0B1C30] font-medium'
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 shrink-0 ${
                    active ? 'text-[#FF6B00]' : 'text-gray-400'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header + Top Tabs (< md) */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/admin" className="shrink-0">
              <Image
                src="/logo.png"
                alt="Labor2Go"
                width={110}
                height={28}
                className="h-6.5 w-auto object-contain"
                priority
              />
            </Link>
            <span className="px-2 py-0.5 rounded-full bg-[#FFEDE0] text-[#FF6B00] text-[10px] font-bold shrink-0">
              Admin
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60 shrink-0"
          >
            {loggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            <span>Keluar</span>
          </button>
        </div>

        {/* Scrollable Mobile Tabs */}
        <nav className="px-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isNavActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors shrink-0 ${
                  active
                    ? 'bg-[#FF6B00] text-white font-bold shadow-xs'
                    : 'bg-[#F8F9FF] text-gray-600 hover:bg-gray-100 font-semibold border border-gray-200/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main Content Area (max width ~1100px) */}
      <main className="flex-1 min-w-0 px-4 py-5 md:px-8 md:py-7">
        <div className="w-full max-w-[1100px] mx-auto">{children}</div>
      </main>
    </div>
  )
}
