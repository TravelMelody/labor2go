'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  CheckSquare,
  Compass,
  Wallet,
  User,
} from 'lucide-react'

export function StudentBottomNav() {
  const pathname = usePathname()

  const isHomeActive = pathname === '/student'
  const isActivityActive = pathname.startsWith('/student/activity')
  const isExploreActive = pathname.startsWith('/student/explore')
  const isWalletActive = pathname.startsWith('/student/wallet')
  const isAccountActive = pathname.startsWith('/student/account')

  return (
    <nav
      aria-label="Navigasi Bawah Mahasiswa"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe"
    >
      <div className="w-full max-w-[420px] mx-auto flex justify-around items-center h-[70px] px-1 pt-1 pb-2">
        {/* 1. Home */}
        <Link
          href="/student"
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

        {/* 2. Tugas Aktif */}
        <Link
          href="/student/activity"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
            isActivityActive
              ? 'text-[#FF6B00]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-current={isActivityActive ? 'page' : undefined}
        >
          <CheckSquare
            className={`w-6 h-6 ${
              isActivityActive ? 'text-[#FF6B00] stroke-[2.2]' : 'text-slate-400 stroke-[1.8]'
            }`}
          />
          <span
            className={`text-[11px] mt-1 leading-none ${
              isActivityActive
                ? 'text-[#FF6B00] font-bold'
                : 'text-slate-500 font-medium'
            }`}
          >
            Tugas Aktif
          </span>
        </Link>

        {/* 3. Eksplor (Tombol tengah menonjol) */}
        <div className="relative flex flex-col items-center justify-center flex-1 h-full">
          <div className="absolute -top-5 flex flex-col items-center">
            <Link
              href="/student/explore"
              className={`w-[52px] h-[52px] rounded-full bg-[#FF6B00] shadow-lg shadow-orange-500/35 flex items-center justify-center cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                isExploreActive ? 'ring-4 ring-orange-200/80 shadow-orange-500/50 scale-105' : ''
              }`}
              aria-label="Eksplor lowongan"
              aria-current={isExploreActive ? 'page' : undefined}
            >
              <Compass className="w-6 h-6 text-white stroke-[2]" />
            </Link>
            <span
              className={`text-[11px] tracking-tight mt-1 leading-none ${
                isExploreActive
                  ? 'font-bold text-[#FF6B00]'
                  : 'font-medium text-slate-500'
              }`}
            >
              Eksplor
            </span>
          </div>
        </div>

        {/* 4. Dana */}
        <Link
          href="/student/wallet"
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
          href="/student/account"
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
