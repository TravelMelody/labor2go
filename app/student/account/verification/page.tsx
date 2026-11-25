import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CAMPUS } from '@/lib/campus'
import { normalizeVerificationStatus } from '@/lib/verification'
import { StudentVerificationView } from '@/components/account/StudentVerificationView'

export const metadata = {
  title: 'Keamanan & Verifikasi – Labor2Go',
  description: 'Status verifikasi identitas dan pengajuan ulang KTM mahasiswa Labor2Go',
}

function StudentVerificationSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="w-44 h-5 rounded bg-gray-200" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="h-28 rounded-3xl bg-white border border-gray-100" />
        <div className="h-36 rounded-3xl bg-white border border-gray-100" />
      </div>
    </div>
  )
}

async function StudentVerificationContent() {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/student/account/verification')
  }

  const [profileRes, studentRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('verified, verification_status, verification_note, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('student_profiles')
      .select('nim, university, ktm_url')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (profileRes.error) {
    console.error('Gagal membaca status verifikasi mahasiswa:', profileRes.error)
  }
  if (studentRes.error) {
    console.error('Gagal membaca data KTM mahasiswa:', studentRes.error)
  }

  const role = profileRes.data?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role !== 'student') {
    redirect('/merchant/account/verification')
  }

  const verified = Boolean(profileRes.data?.verified)
  const initialStatus = normalizeVerificationStatus(
    profileRes.data?.verification_status,
    verified
  )

  return (
    <StudentVerificationView
      userId={user.id}
      initialStatus={initialStatus}
      initialNote={profileRes.data?.verification_note ?? null}
      initialNim={studentRes.data?.nim || ''}
      university={studentRes.data?.university || CAMPUS.name}
      initialHasKtm={Boolean(studentRes.data?.ktm_url)}
    />
  )
}

export default function StudentVerificationPage() {
  return (
    <Suspense fallback={<StudentVerificationSkeleton />}>
      <StudentVerificationContent />
    </Suspense>
  )
}
