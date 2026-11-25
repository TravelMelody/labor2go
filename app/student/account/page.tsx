import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CAMPUS } from '@/lib/campus'
import { normalizeVerificationStatus } from '@/lib/verification'
import { StudentAccountView } from '@/components/account/StudentAccountView'

export const metadata = {
  title: 'Akun Saya – Labor2Go',
  description: 'Profil mahasiswa, tingkat, reputasi, dan pengaturan akun Labor2Go',
}

function StudentAccountSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100 flex items-center justify-center">
        <div className="w-24 h-5 rounded bg-gray-200" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-full bg-gray-200" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-36 h-5 rounded bg-gray-200" />
              <div className="w-44 h-3.5 rounded bg-gray-100" />
              <div className="w-28 h-5 rounded-full bg-gray-200" />
            </div>
          </div>
          <div className="h-12 rounded-2xl bg-gray-100" />
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

async function StudentAccountContent() {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/student/account')
  }

  const [profileRes, studentRes, ratingRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, verified, verification_status, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('student_profiles')
      .select('university, level, completed_jobs')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('profile_ratings')
      .select('avg_rating, review_count')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (profileRes.error) {
    console.error('Gagal membaca profil akun mahasiswa:', profileRes.error)
  }
  if (studentRes.error) {
    console.error('Gagal membaca student_profiles akun:', studentRes.error)
  }
  if (ratingRes.error) {
    console.error('Gagal membaca profile_ratings mahasiswa:', ratingRes.error)
  }

  const role = profileRes.data?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role !== 'student') {
    redirect('/merchant/account')
  }

  const fullName =
    profileRes.data?.full_name || user.user_metadata?.full_name || 'Mahasiswa'
  const university = studentRes.data?.university || CAMPUS.name
  const level = Number(studentRes.data?.level ?? 1)
  const completedJobs = Number(studentRes.data?.completed_jobs ?? 0)
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

  return (
    <StudentAccountView
      fullName={fullName}
      university={university}
      level={level}
      completedJobs={completedJobs}
      verified={verified}
      verificationStatus={verificationStatus}
      avgRating={avgRating}
      reviewCount={reviewCount}
    />
  )
}

export default function StudentAccountPage() {
  return (
    <Suspense fallback={<StudentAccountSkeleton />}>
      <StudentAccountContent />
    </Suspense>
  )
}
