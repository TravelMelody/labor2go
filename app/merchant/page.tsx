'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Store,
  LogOut,
  PlusCircle,
  Users,
  Wallet,
  Loader2,
  Clock,
  CheckCircle,
  MapPin,
  Tag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function MerchantDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState<boolean>(false)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [businessType, setBusinessType] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email ?? null)

        // Baca profiles (full_name, verified)
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, verified')
          .eq('id', user.id)
          .maybeSingle()

        setUserName(
          profile?.full_name || user.user_metadata?.full_name || 'Mitra UMKM'
        )
        setIsVerified(Boolean(profile?.verified))

        // Baca data umkm_profiles
        const { data: umkmProfile } = await supabase
          .from('umkm_profiles')
          .select('business_name, business_type, address, photo_url')
          .eq('id', user.id)
          .maybeSingle()

        if (umkmProfile) {
          setBusinessName(umkmProfile.business_name || null)
          setBusinessType(umkmProfile.business_type || null)
          setAddress(umkmProfile.address || null)
          setPhotoUrl(umkmProfile.photo_url || null)
        }
      }
      setLoading(false)
    }

    loadUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FF]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0B1C30]" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col px-4 pt-6 pb-8 bg-[#F8F9FF]">
      {/* Top Bar */}
      <header className="flex items-center justify-between mb-5">
        <Image
          src="/logo-merchant.png"
          alt="Labor2Go Merchant"
          width={130}
          height={34}
          className="h-8 w-auto object-contain"
          priority
        />
        <button
          onClick={handleLogout}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </header>

      {/* Verification Status Alert (Berdasarkan profiles.verified) */}
      {!isVerified ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs mb-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-amber-900">
                Akun kamu menunggu verifikasi admin
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
              Data usaha dan foto tokomu sedang ditinjau oleh admin Labor2Go untuk menjamin keamanan komunitas pekerja.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 mb-4 flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-emerald-800">
            Usaha Terverifikasi
          </span>
        </div>
      )}

      {/* Profile Card */}
      <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs mb-4">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-gray-200 shrink-0">
              <Image
                src={photoUrl}
                alt={businessName || 'Foto Usaha'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#E5EEFF] text-[#0B1C30] flex items-center justify-center font-bold text-lg shrink-0">
              <Store className="w-6 h-6" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E5EEFF] text-[#0B1C30] text-[10px] font-bold">
                Pemilik Usaha / UMKM
              </span>
              {isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Terverifikasi
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[#0B1C30] truncate">
              {businessName || userName || 'Mitra Labor2Go'}
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {userName} • {userEmail}
            </p>
          </div>
        </div>

        {/* Business details */}
        {(businessType || address) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1.5 text-xs text-gray-600">
            {businessType && (
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                <span className="font-semibold text-gray-800">Kategori:</span>
                <span>{businessType}</span>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-tight">{address}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Placeholder Content */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-xs text-center flex flex-col items-center justify-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-[#E5EEFF] text-[#0B1C30] flex items-center justify-center mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#0B1C30] mb-1">
            Dashboard Merchant (UMKM)
          </h3>
          <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-4">
            Modul pasang lowongan kilat, kelola pelamar mahasiswa, dan dompet usaha siap digunakan pada tugas berikutnya.
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
              <PlusCircle className="w-3.5 h-3.5" /> Pasang Lowongan
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
              <Wallet className="w-3.5 h-3.5" /> Saldo Aman
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
