'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2, Sparkles, GraduationCap, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StudentOnboardingForm } from '@/components/onboarding/StudentOnboardingForm'
import { MerchantOnboardingForm } from '@/components/onboarding/MerchantOnboardingForm'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'student' | 'umkm'>('student')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    async function checkUserAndProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        setUserId(user.id)

        // Ambil data profil dasar dan nomor HP milik sendiri via RPC
        const [profileRes, phoneRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .maybeSingle(),
          supabase.rpc('get_my_phone'),
        ])

        const profile = profileRes.data
        if (profileRes.error) {
          if (profileRes.error.code === 'P0001') {
            console.warn('Peringatan saat membaca profil onboarding:', profileRes.error.message)
          } else {
            console.error('Gagal membaca profil onboarding:', profileRes.error)
          }
        }
        if (phoneRes.error) {
          if (phoneRes.error.code === 'P0001') {
            console.warn('Peringatan saat mengambil nomor HP onboarding:', phoneRes.error.message)
          } else {
            console.error('Gagal mengambil nomor HP onboarding:', phoneRes.error)
          }
        }

        if (profile?.role === 'admin') {
          router.replace('/admin')
          return
        }

        const role =
          profile?.role ||
          (user.user_metadata?.role === 'umkm' ? 'umkm' : 'student')

        setUserRole(role)
        setFullName(
          profile?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            ''
        )
        setPhone(typeof phoneRes.data === 'string' ? phoneRes.data : '')

        // Cek apakah profil detail sudah ada
        const detailTable = role === 'umkm' ? 'umkm_profiles' : 'student_profiles'
        const { data: detailProfile } = await supabase
          .from(detailTable)
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (detailProfile) {
          // Jika sudah lengkap, redirect ke dashboard (tidak boleh akses /onboarding)
          router.replace(role === 'umkm' ? '/merchant' : '/student')
          return
        }

        setLoading(false)
      } catch (err) {
        console.error('Error checking onboarding status:', err)
        setLoading(false)
      }
    }

    checkUserAndProfile()
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading || !userId) {
    return (
      <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col items-center justify-center bg-[#F8F9FF]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B00] mb-2" />
        <p className="text-xs text-gray-500 font-medium">Memuat formulir pendaftaran...</p>
      </div>
    )
  }

  const isStudent = userRole === 'student'

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col px-4 pt-5 pb-8 bg-[#F8F9FF]">
      {/* Top Header */}
      <header className="flex items-center justify-between mb-4">
        <Image
          src={isStudent ? '/logo.png' : '/logo-merchant.png'}
          alt="Labor2Go"
          width={130}
          height={34}
          className="h-8 w-auto object-contain"
          priority
        />
        <button
          onClick={handleLogout}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 text-gray-500" />
          <span>Keluar</span>
        </button>
      </header>

      {/* Hero / Step Card */}
      <section className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFEDE0] text-[#FF6B00] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Langkah Terakhir</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E5EEFF] text-[#0B1C30] text-xs font-bold">
            {isStudent ? (
              <>
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Mahasiswa</span>
              </>
            ) : (
              <>
                <Store className="w-3.5 h-3.5" />
                <span>Merchant UMKM</span>
              </>
            )}
          </div>
        </div>

        <h1 className="text-lg sm:text-xl font-extrabold text-[#0B1C30] tracking-tight mb-1">
          {isStudent
            ? 'Lengkapi Profil Mahasiswa'
            : 'Lengkapi Data Usaha Anda'}
        </h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          {isStudent
            ? 'Isi data kampus, keahlian, dan unggah foto KTM untuk mulai melamar pekerjaan mikro di sekitar kampus.'
            : 'Lengkapi identitas toko dan unggah foto tempat usaha agar lowongan gig Anda dapat dipercaya pelamar.'}
        </p>
      </section>

      {/* Form Content based on Role */}
      {isStudent ? (
        <StudentOnboardingForm
          userId={userId}
          initialFullName={fullName}
          initialPhone={phone}
          onSuccess={() => {
            router.push('/student')
            router.refresh()
          }}
        />
      ) : (
        <MerchantOnboardingForm
          userId={userId}
          initialFullName={fullName}
          initialPhone={phone}
          onSuccess={() => {
            router.push('/merchant')
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
