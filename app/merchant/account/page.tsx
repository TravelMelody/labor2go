import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeVerificationStatus } from '@/lib/verification'
import { MerchantAccountView } from '@/components/account/MerchantAccountView'

export const metadata = {
  title: 'Akun Mitra UMKM – Labor2Go',
  description: 'Profil usaha UMKM, statistik rating, dan pengaturan akun Labor2Go',
}

function MerchantAccountSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-28 animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100 flex items-center justify-center">
        <div className="w-16 h-5 rounded bg-gray-200" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-full bg-gray-200" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-36 h-5 rounded bg-gray-200" />
              <div className="w-40 h-3.5 rounded bg-gray-100" />
              <div className="w-32 h-5 rounded-full bg-gray-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-14 rounded-2xl bg-gray-100" />
            <div className="h-14 rounded-2xl bg-gray-100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 rounded-3xl bg-white border border-gray-100" />
          <div className="h-32 rounded-3xl bg-white border border-gray-100" />
        </div>
        <div className="h-72 rounded-3xl bg-white border border-gray-100" />
        <div className="h-12 rounded-full bg-gray-200" />
      </div>
    </div>
  )
}

async function MerchantAccountContent() {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/merchant/account')
  }

  const [profileRes, umkmRes, ratingRes, completedJobsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, verified, verification_status, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('umkm_profiles')
      .select('business_name, business_type, address, photo_url')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('profile_ratings')
      .select('avg_rating, review_count')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('umkm_id', user.id)
      .eq('status', 'completed'),
  ])

  if (profileRes.error) {
    console.error('Gagal membaca profil akun merchant:', profileRes.error)
  }
  if (umkmRes.error) {
    console.error('Gagal membaca umkm_profiles akun:', umkmRes.error)
  }
  if (ratingRes.error) {
    console.error('Gagal membaca profile_ratings merchant:', ratingRes.error)
  }
  if (completedJobsRes.error) {
    console.error('Gagal menghitung lowongan selesai merchant:', completedJobsRes.error)
  }

  const role = profileRes.data?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role !== 'umkm') {
    redirect('/student/account')
  }

  const fullName =
    profileRes.data?.full_name || user.user_metadata?.full_name || 'Mitra UMKM'
  const businessName = umkmRes.data?.business_name || 'Usaha Mitra'
  const verified = Boolean(profileRes.data?.verified)
  const verificationStatus = normalizeVerificationStatus(
    profileRes.data?.verification_status,
    verified
  )
  const avgRating =
    ratingRes.data?.avg_rating !== null && ratingRes.data?.avg_rating !== undefined
      ? Number(ratingRes.data.avg_rating)
      : null
  const reviewCount = Number(ratingRes.data?.review_count ?? 0)
  const completedJobsCount = Number(completedJobsRes.count ?? 0)

  return (
    <MerchantAccountView
      fullName={fullName}
      businessName={businessName}
      businessType={umkmRes.data?.business_type ?? null}
      address={umkmRes.data?.address ?? null}
      photoUrl={umkmRes.data?.photo_url ?? null}
      verified={verified}
      verificationStatus={verificationStatus}
      avgRating={avgRating}
      reviewCount={reviewCount}
      completedJobsCount={completedJobsCount}
    />
  )
}

export default function MerchantAccountPage() {
  return (
    <Suspense fallback={<MerchantAccountSkeleton />}>
      <MerchantAccountContent />
    </Suspense>
  )
}
