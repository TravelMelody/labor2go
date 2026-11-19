'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  ClipboardList,
  Plus,
  Wallet,
  User,
} from 'lucide-react'

export function MerchantBottomNav() {
  const pathname = usePathname()

  // Sembunyikan bottom navigation di halaman /merchant/post
  // agar tidak menutupi tombol sticky "Publikasikan Lowongan"
  if (pathname.startsWith('/merchant/post')) {
    return null
  }

  const isHomeActive = pathname === '/merchant'
  const isJobsActive = pathname.startsWith('/merchant/jobs')
  const isPostActive = pathname.startsWith('/merchant/post')
  const isWalletActive = pathname.startsWith('/merchant/wallet')
  const isAccountActive = pathname.startsWith('/merchant/account')

  return (
    <nav
      aria-label="Navigasi Bawah Merchant"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe"
    >
      <div className="w-full max-w-[420px] mx-auto flex justify-around items-center h-[70px] px-1 pt-1 pb-2">
        {/* 1. Home */}
        <Link
          href="/merchant"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            isHomeActive
              ? 'text-[#FF6B00]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <Home
            className={`w-6 h-6 ${
              isHomeActive ? 'text-[#FF6B00] stroke-[2.2]' : 'text-slate-400 stroke-[1.8]'
            }`}
          />
          <span
            className={`text-[11px] mt-1 leading-none ${
              isHomeActive
                ? 'text-[#FF6B00] font-bold'
                : 'text-slate-500 font-medium'
            }`}
          >
            Home
          </span>
        </Link>

        {/* 2. Kelola Tugas */}
        <Link
          href="/merchant/jobs"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            isJobsActive
              ? 'text-[#FF6B00]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-current={isJobsActive ? 'page' : undefined}
        >
          <ClipboardList
            className={`w-6 h-6 ${
              isJobsActive ? 'text-[#FF6B00] stroke-[2.2]' : 'text-slate-400 stroke-[1.8]'
            }`}
          />
          <span
            className={`text-[11px] mt-1 leading-none ${
              isJobsActive
                ? 'text-[#FF6B00] font-bold'
                : 'text-slate-500 font-medium'
            }`}
          >
            Kelola Tugas
          </span>
        </Link>

        {/* 3. Pasang (Tombol tengah menonjol) */}
        <div className="relative flex flex-col items-center justify-center flex-1 h-full">
          <div className="absolute -top-5 flex flex-col items-center">
            <Link
              href="/merchant/post"
              className={`w-[52px] h-[52px] rounded-full bg-[#FF6B00] text-white shadow-lg shadow-orange-500/35 flex items-center justify-center cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                isPostActive ? 'ring-4 ring-orange-200/80 shadow-orange-500/50 scale-105' : ''
              }`}
              aria-label="Pasang Lowongan Baru"
              aria-current={isPostActive ? 'page' : undefined}
            >
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </Link>
            <span
              className={`text-[11px] tracking-tight mt-1 leading-none ${
                isPostActive
                  ? 'font-bold text-[#FF6B00]'
                  : 'font-medium text-slate-500'
              }`}
            >
              Pasang
            </span>
          </div>
        </div>

        {/* 4. Dana */}
        <Link
          href="/merchant/wallet"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            isWalletActive
              ? 'text-[#FF6B00]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-current={isWalletActive ? 'page' : undefined}
        >
          <Wallet
            className={`w-6 h-6 ${
              isWalletActive ? 'text-[#FF6B00] stroke-[2.2]' : 'text-slate-400 stroke-[1.8]'
            }`}
          />
          <span
            className={`text-[11px] mt-1 leading-none ${
              isWalletActive
                ? 'text-[#FF6B00] font-bold'
                : 'text-slate-500 font-medium'
            }`}
          >
            Dana
          </span>
        </Link>

        {/* 5. Akun */}
        <Link
          href="/merchant/account"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            isAccountActive
              ? 'text-[#FF6B00]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-current={isAccountActive ? 'page' : undefined}
        >
          <User
            className={`w-6 h-6 ${
              isAccountActive ? 'text-[#FF6B00] stroke-[2.2]' : 'text-slate-400 stroke-[1.8]'
            }`}
          />
          <span
            className={`text-[11px] mt-1 leading-none ${
              isAccountActive
                ? 'text-[#FF6B00] font-bold'
                : 'text-slate-500 font-medium'
            }`}
          >
            Akun
          </span>
        </Link>
      </div>
    </nav>
  )
}
