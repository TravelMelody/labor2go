import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MerchantEditProfileForm } from '@/components/account/MerchantEditProfileForm'

export const metadata = {
  title: 'Edit Profil Toko – Labor2Go',
  description: 'Ubah kontak, kategori usaha, alamat, dan titik lokasi toko UMKM',
}

function MerchantEditSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-28 animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="w-40 h-5 rounded bg-gray-200" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="h-52 rounded-3xl bg-white border border-gray-100" />
        <div className="h-80 rounded-3xl bg-white border border-gray-100" />
        <div className="h-44 rounded-3xl bg-white border border-gray-100" />
      </div>
    </div>
  )
}

async function MerchantEditContent() {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/merchant/account/edit')
  }

  const [profileRes, umkmRes, phoneRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, verified, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('umkm_profiles')
      .select('business_name, business_type, address, lat, lng, photo_url')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.rpc('get_my_phone'),
  ])

  if (profileRes.error) {
    console.error('Gagal membaca profil edit merchant:', profileRes.error)
  }
  if (umkmRes.error) {
    console.error('Gagal membaca umkm_profiles edit:', umkmRes.error)
  }
  if (phoneRes.error) {
    if (phoneRes.error.code === 'P0001') {
      console.warn('Peringatan saat mengambil nomor HP edit merchant:', phoneRes.error.message)
    } else {
      console.error('Gagal mengambil nomor HP edit merchant:', phoneRes.error)
    }
  }

  const role = profileRes.data?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role !== 'umkm') {
    redirect('/student/account/edit')
  }

  return (
    <MerchantEditProfileForm
      userId={user.id}
      verified={Boolean(profileRes.data?.verified)}
      initialFullName={
        profileRes.data?.full_name || user.user_metadata?.full_name || ''
      }
      initialPhone={typeof phoneRes.data === 'string' ? phoneRes.data : ''}
      initialBusinessName={umkmRes.data?.business_name || ''}
      initialBusinessType={umkmRes.data?.business_type || 'F&B'}
      initialAddress={umkmRes.data?.address || ''}
      initialLat={
        umkmRes.data?.lat !== null && umkmRes.data?.lat !== undefined
          ? Number(umkmRes.data.lat)
          : null
      }
      initialLng={
        umkmRes.data?.lng !== null && umkmRes.data?.lng !== undefined
          ? Number(umkmRes.data.lng)
          : null
      }
      initialPhotoUrl={umkmRes.data?.photo_url ?? null}
    />
  )
}

export default function MerchantEditAccountPage() {
  return (
    <Suspense fallback={<MerchantEditSkeleton />}>
      <MerchantEditContent />
    </Suspense>
  )
}
