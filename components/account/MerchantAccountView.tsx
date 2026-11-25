'use client'

import React from 'react'
import Image from 'next/image'
import {
  Store,
  MapPin,
  Star,
  CheckCircle2,
  ShieldCheck,
  HelpCircle,
  FileText,
  Shield,
} from 'lucide-react'
import type { VerificationStatus } from '@/lib/verification'
import {
  AccountMenuItem,
  LogoutButtonWithDialog,
  VerificationStatusBadge,
  getInitials,
} from '@/components/account/AccountShared'

export interface MerchantAccountViewProps {
  fullName: string
  businessName: string
  businessType: string | null
  address: string | null
  photoUrl: string | null
  verified: boolean
  verificationStatus: VerificationStatus
  avgRating: number | null
  reviewCount: number
  completedJobsCount: number
}

export function MerchantAccountView({
  fullName,
  businessName,
  businessType,
  address,
  photoUrl,
  verified,
  verificationStatus,
  avgRating,
  reviewCount,
  completedJobsCount,
}: MerchantAccountViewProps) {
  const initials = getInitials(businessName || fullName, 'U')
  const hasRating = reviewCount > 0 && avgRating !== null && !Number.isNaN(avgRating)

  const verificationSubtitle = verified
    ? 'Data & foto usaha terverifikasi'
    : verificationStatus === 'rejected'
      ? 'Verifikasi ditolak, perbaiki data'
      : 'Menunggu verifikasi admin'

  const verificationDot = verified
    ? 'emerald'
    : verificationStatus === 'rejected'
      ? 'red'
      : 'amber'

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 h-14 px-4 flex items-center justify-center">
        <h1 className="text-base font-bold text-[#0B1C30] tracking-tight">
          Akun
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        {/* Kartu Profil Merchant */}
        <section className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100">
          <div className="flex items-start gap-3.5">
            {photoUrl ? (
              <div className="relative w-16 h-16 rounded-full overflow-hidden border border-gray-200 shrink-0 shadow-xs">
                <Image
                  src={photoUrl}
                  alt={businessName || 'Foto Usaha'}
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
              <h2 className="text-base font-bold text-[#0B1C30] truncate">
                {fullName}
              </h2>
              <p className="text-xs font-medium text-gray-500 truncate mt-0.5">
                {businessName}
              </p>
              <div className="mt-2">
                <VerificationStatusBadge
                  verified={verified}
                  status={verificationStatus}
                  verifiedLabel="Usaha Terverifikasi"
                />
              </div>
            </div>
          </div>

          {/* Meta Grid: Kategori & Lokasi */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-[#F8F9FF] rounded-2xl p-2.5 border border-blue-50 flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold text-gray-500">
                  Kategori
                </span>
                <span className="block text-xs font-bold text-[#0B1C30] truncate">
                  {businessType || '-'}
                </span>
              </div>
            </div>

            <div className="bg-[#F8F9FF] rounded-2xl p-2.5 border border-blue-50 flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold text-gray-500">
                  Lokasi
                </span>
                <span className="block text-xs font-bold text-[#0B1C30] truncate">
                  {address || 'Belum diisi'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Statistik Toko */}
        <section className="grid grid-cols-2 gap-3">
          {/* Card 1: Rating Toko */}
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
                Rating Toko
              </p>
            </div>
          </div>

          {/* Card 2: Lowongan Selesai */}
          <div className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 flex flex-col justify-between">
            <div className="w-10 h-10 rounded-full bg-[#E5EEFF] text-[#4E5E82] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-[#0B1C30] tracking-tight">
                  {completedJobsCount}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-500 mt-1">
                Lowongan Selesai
              </p>
            </div>
          </div>
        </section>

        {/* Menu Pengaturan Toko */}
        <section className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-500 px-1">
            Pengaturan Toko
          </span>
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 overflow-hidden flex flex-col divide-y divide-gray-100">
            <AccountMenuItem
              href="/merchant/account/edit"
              icon={<Store className="w-5 h-5" />}
              title="Edit Profil Toko"
              subtitle="Ubah kontak, kategori, alamat, dan lokasi"
              iconContainerClass="bg-[#FFEDE0] text-[#FF6B00]"
            />
            <AccountMenuItem
              href="/merchant/account/verification"
              icon={<ShieldCheck className="w-5 h-5" />}
              title="Keamanan & Verifikasi"
              subtitle={verificationSubtitle}
              indicatorColor={verificationDot}
              iconContainerClass="bg-[#FFEDE0] text-[#FF6B00]"
            />
            <AccountMenuItem
              href="/help"
              icon={<HelpCircle className="w-5 h-5" />}
              title="Pusat Bantuan"
              subtitle="Pusat komplain & FAQ Labor2Go"
              iconContainerClass="bg-[#FFEDE0] text-[#FF6B00]"
            />
            <AccountMenuItem
              href="/legal/terms"
              icon={<FileText className="w-5 h-5" />}
              title="Syarat & Ketentuan"
              subtitle="Aturan layanan & etika mitra"
              iconContainerClass="bg-[#FFEDE0] text-[#FF6B00]"
            />
            <AccountMenuItem
              href="/legal/privacy"
              icon={<Shield className="w-5 h-5" />}
              title="Kebijakan Privasi"
              subtitle="Perlindungan data & privasi akun"
              iconContainerClass="bg-[#FFEDE0] text-[#FF6B00]"
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
