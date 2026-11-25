import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeVerificationStatus } from '@/lib/verification'
import { MerchantVerificationView } from '@/components/account/MerchantVerificationView'

export const metadata = {
  title: 'Keamanan & Verifikasi – Labor2Go',
  description: 'Status verifikasi usaha dan pengajuan ulang foto toko mitra UMKM',
}

function MerchantVerificationSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-28 animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="w-44 h-5 rounded bg-gray-200" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="h-28 rounded-3xl bg-white border border-gray-100" />
        <div className="h-64 rounded-3xl bg-white border border-gray-100" />
      </div>
    </div>
  )
}

async function MerchantVerificationContent() {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/merchant/account/verification')
  }

  const [profileRes, umkmRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('verified, verification_status, verification_note, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('umkm_profiles')
      .select('business_name, business_type, address, photo_url')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (profileRes.error) {
    console.error('Gagal membaca status verifikasi merchant:', profileRes.error)
  }
  if (umkmRes.error) {
    console.error('Gagal membaca data usaha verifikasi:', umkmRes.error)
  }

  const role = profileRes.data?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role !== 'umkm') {
    redirect('/student/account/verification')
  }

  const verified = Boolean(profileRes.data?.verified)
  const initialStatus = normalizeVerificationStatus(
    profileRes.data?.verification_status,
    verified
  )

  return (
    <MerchantVerificationView
      userId={user.id}
      initialStatus={initialStatus}
      initialNote={profileRes.data?.verification_note ?? null}
      initialBusinessName={umkmRes.data?.business_name || ''}
      initialBusinessType={umkmRes.data?.business_type || 'F&B'}
      initialAddress={umkmRes.data?.address || ''}
      initialPhotoUrl={umkmRes.data?.photo_url ?? null}
    />
  )
}

export default function MerchantVerificationPage() {
  return (
    <Suspense fallback={<MerchantVerificationSkeleton />}>
      <MerchantVerificationContent />
    </Suspense>
  )
}
