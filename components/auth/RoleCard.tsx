'use client'

import React from 'react'
import { GraduationCap, Store, Zap, CheckCircle2, ArrowRight } from 'lucide-react'

export type UserRole = 'student' | 'umkm'

interface RoleCardProps {
  role: UserRole
  isSelected: boolean
  onSelect: () => void
  onActionClick: () => void
}

export function RoleCard({
  role,
  isSelected,
  onSelect,
  onActionClick,
}: RoleCardProps) {
  const isStudent = role === 'student'

  const studentBenefits = [
    'Tanpa kontrak, fleksibel',
    'Radius 1–3 km dari kos & kampus',
    'Upah transparan langsung masuk e-wallet',
  ]

  const merchantBenefits = [
    'Respons pelamar rata-rata < 5 menit',
    'Dana aman terproteksi',
    'Hanya bayar per tugas yang selesai tuntas',
  ]

  const benefits = isStudent ? studentBenefits : merchantBenefits

  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col p-4 sm:p-5 rounded-2xl bg-white transition-all duration-200 cursor-pointer ${
        isSelected
          ? isStudent
            ? 'ring-2 ring-[#FF6B00] shadow-md shadow-[#FF6B00]/10 bg-orange-50/20'
            : 'ring-2 ring-[#0B1C30] shadow-md shadow-[#0B1C30]/10 bg-slate-50/40'
          : 'border border-gray-100 shadow-sm hover:border-gray-200'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isStudent
              ? 'bg-[#FFEDE0] text-[#FF6B00]'
              : 'bg-[#E5EEFF] text-[#0B1C30]'
          }`}
        >
          {isStudent ? (
            <GraduationCap className="w-6 h-6" />
          ) : (
            <Store className="w-6 h-6" />
          )}
        </div>

        {/* Badge */}
        {isStudent ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEDE0] text-[#FF6B00] text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse"></span>
            Cari Cuan Santai
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E5EEFF] text-[#0B1C30] text-xs font-bold">
            <Zap className="w-3.5 h-3.5 text-[#FF6B00] fill-[#FF6B00]" />
            Bantuan Kilat
          </span>
        )}
      </div>

      {/* Title & Radio */}
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-base sm:text-lg font-bold text-[#0B1C30]">
          {isStudent ? 'Saya Mahasiswa' : 'Saya Pemilik Usaha / UMKM'}
        </h2>
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
            isSelected
              ? isStudent
                ? 'border-[#FF6B00] bg-[#FF6B00]'
                : 'border-[#0B1C30] bg-[#0B1C30]'
              : 'border-gray-300 bg-white'
          }`}
        >
          {isSelected && (
            <div className="w-2 h-2 rounded-full bg-white"></div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs sm:text-sm text-gray-500 mb-4 leading-relaxed">
        {isStudent
          ? 'Cari kerja harian & freelance praktis di sekitar kampus. Upah langsung cair.'
          : 'Pasang lowongan kilat hitungan menit. Mahasiswa sigap bantu pesanan toko/warung.'}
      </p>

      {/* Micro Benefits List */}
      <div className="flex flex-col gap-2 mb-4 bg-[#F8F9FF] p-3 rounded-xl border border-gray-100/80">
        {benefits.map((benefit, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-[13px] text-gray-700 font-medium">
              {benefit}
            </span>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onActionClick()
        }}
        className={`w-full h-11 sm:h-12 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98] ${
          isStudent
            ? 'bg-[#FF6B00] hover:bg-[#E05E00] text-white shadow-[#FF6B00]/20'
            : 'bg-[#0B1C30] hover:bg-[#152843] text-white shadow-gray-900/10'
        }`}
      >
        <span>
          {isStudent ? 'Masuk Sebagai Mahasiswa' : 'Masuk Sebagai Merchant'}
        </span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
