import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CAMPUS } from '@/lib/campus'
import { StudentEditProfileForm } from '@/components/account/StudentEditProfileForm'

export const metadata = {
  title: 'Edit Profil Pribadi – Labor2Go',
  description: 'Ubah kontak, data kampus, dan keahlian mahasiswa Labor2Go',
}

function StudentEditSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100 px-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="w-40 h-5 rounded bg-gray-200" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="h-52 rounded-3xl bg-white border border-gray-100" />
        <div className="h-72 rounded-3xl bg-white border border-gray-100" />
        <div className="h-12 rounded-full bg-gray-200" />
      </div>
    </div>
  )
}

async function StudentEditContent() {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/student/account/edit')
  }

  const [profileRes, studentRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, phone, verified, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('student_profiles')
      .select('nim, university, skills')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (profileRes.error) {
    console.error('Gagal membaca profil edit mahasiswa:', profileRes.error)
  }
  if (studentRes.error) {
    console.error('Gagal membaca student_profiles edit:', studentRes.error)
  }

  const role = profileRes.data?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role !== 'student') {
    redirect('/merchant/account/edit')
  }

  return (
    <StudentEditProfileForm
      userId={user.id}
      verified={Boolean(profileRes.data?.verified)}
      initialFullName={
        profileRes.data?.full_name || user.user_metadata?.full_name || ''
      }
      initialPhone={profileRes.data?.phone || ''}
      initialUniversity={studentRes.data?.university || CAMPUS.name}
      initialNim={studentRes.data?.nim || ''}
      initialSkills={
        Array.isArray(studentRes.data?.skills) ? studentRes.data.skills : []
      }
    />
  )
}

export default function StudentEditAccountPage() {
  return (
    <Suspense fallback={<StudentEditSkeleton />}>
      <StudentEditContent />
    </Suspense>
  )
}
