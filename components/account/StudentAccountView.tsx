'use client'

import React from 'react'
import Image from 'next/image'
import {
  Award,
  Star,
  CheckCircle2,
  User,
  ShieldCheck,
  HelpCircle,
  FileText,
  Shield,
} from 'lucide-react'
import { getStudentLevelName } from '@/lib/levels'
import type { VerificationStatus } from '@/lib/verification'
import {
  AccountMenuItem,
  LogoutButtonWithDialog,
  VerificationStatusBadge,
  getInitials,
} from '@/components/account/AccountShared'

export interface StudentAccountViewProps {
  fullName: string
  avatarUrl: string | null
  university: string
  level: number
  completedJobs: number
  verified: boolean
  verificationStatus: VerificationStatus
  avgRating: number | null
  reviewCount: number
}

export function StudentAccountView({
  fullName,
  avatarUrl,
  university,
  level,
  completedJobs,
  verified,
  verificationStatus,
  avgRating,
  reviewCount,
}: StudentAccountViewProps) {
  const levelName = getStudentLevelName(level)
  const initials = getInitials(fullName, 'M')
  const hasRating = reviewCount > 0 && avgRating !== null && !Number.isNaN(avgRating)

  const verificationSubtitle = verified
    ? 'Identitas & KTM terverifikasi'
    : verificationStatus === 'rejected'
      ? 'Verifikasi ditolak, perbaiki data'
      : 'Menunggu verifikasi admin'

  const verificationDot = verified
    ? 'emerald'
    : verificationStatus === 'rejected'
      ? 'red'
      : 'amber'

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF]">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 h-14 px-4 flex items-center justify-center">
        <h1 className="text-base font-bold text-[#0B1C30] tracking-tight">
          Akun Saya
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4 pb-6 flex flex-col gap-4">
        {/* Kartu Profil Mahasiswa */}
        <section className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              <div className="relative w-16 h-16 rounded-full overflow-hidden border border-orange-200/70 shrink-0 shadow-xs">
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#FFEDE0] text-[#FF6B00] border border-orange-200/70 flex items-center justify-center font-extrabold text-xl shrink-0 shadow-inner">
                {initials}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#0B1C30] truncate">
                {fullName}
              </h2>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {university}
              </p>
              <div className="mt-2">
                <VerificationStatusBadge
                  verified={verified}
                  status={verificationStatus}
                  verifiedLabel="Terverifikasi"
                />
              </div>
            </div>
          </div>

          {/* Tingkat */}
          <div className="mt-4 pt-3.5 border-t border-gray-100">
            <div className="flex items-center justify-between bg-[#F8F9FF] rounded-2xl px-3.5 py-2.5 border border-blue-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
                  <Award className="w-4.5 h-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-gray-500 font-medium leading-tight">
                    Tingkat
                  </span>
                  <span className="text-sm font-bold text-[#FF6B00] leading-tight">
                    {levelName}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#0B1C30] bg-white px-2.5 py-1 rounded-full border border-gray-200/80">
                Level {level}
              </span>
            </div>
          </div>
        </section>

        {/* Statistik */}
        <section className="grid grid-cols-2 gap-3">
          {/* Card 1: Rating */}
          <div className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 flex flex-col justify-between">
            <div className="w-10 h-10 rounded-full bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center">
              <Star className="w-5 h-5 fill-[#FF6B00]" />
            </div>

            <div className="mt-3">
              {hasRating ? (
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-[#0B1C30] tracking-tight">
                      {Number(avgRating).toFixed(1)}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">
                      / 5
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {reviewCount} ulasan
                  </p>
                </div>
              ) : (
                <p className="text-xs font-bold text-gray-500 py-1">
                  Belum ada ulasan
                </p>
              )}
              <p className="text-[11px] font-semibold text-gray-500 mt-1">
                Rating Pekerja
              </p>
            </div>
          </div>

          {/* Card 2: Tugas Selesai */}
          <div className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 flex flex-col justify-between">
            <div className="w-10 h-10 rounded-full bg-[#E5EEFF] text-[#4E5E82] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-[#0B1C30] tracking-tight">
                  {completedJobs}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-500 mt-1">
                Tugas Selesai
              </p>
            </div>
          </div>
        </section>

        {/* Menu Akun & Preferensi */}
        <section className="bg-white rounded-3xl shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Akun &amp; Preferensi
            </span>
          </div>

          <div className="flex flex-col divide-y divide-gray-100">
            <AccountMenuItem
              href="/student/account/edit"
              icon={<User className="w-5 h-5" />}
              title="Edit Profil Pribadi"
              subtitle="Ubah foto profil, kontak, data kampus, dan keahlian"
            />
            <AccountMenuItem
              href="/student/account/verification"
              icon={<ShieldCheck className="w-5 h-5" />}
              title="Keamanan & Verifikasi"
              subtitle={verificationSubtitle}
              indicatorColor={verificationDot}
            />
            <AccountMenuItem
              href="/help"
              icon={<HelpCircle className="w-5 h-5" />}
              title="Pusat Bantuan"
              subtitle="Pusat komplain & FAQ Labor2Go"
            />
            <AccountMenuItem
              href="/legal/terms"
              icon={<FileText className="w-5 h-5" />}
              title="Syarat & Ketentuan"
              subtitle="Aturan layanan & etika pengguna"
            />
            <AccountMenuItem
              href="/legal/privacy"
              icon={<Shield className="w-5 h-5" />}
              title="Kebijakan Privasi"
              subtitle="Perlindungan data & privasi akun"
            />
          </div>
        </section>

        {/* Tombol Keluar & Teks Bawah */}
        <section className="pt-1 flex flex-col gap-3">
          <LogoutButtonWithDialog />
          <p className="text-center text-[11px] font-medium text-gray-400">
            Labor2Go (prototipe)
          </p>
        </section>
      </main>
    </div>
  )
}
