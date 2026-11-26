import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  StudentActivityView,
  type ActivityApplication,
  type ActivityJob,
  type ActivityPayment,
} from '@/components/student/StudentActivityView'

export const metadata = {
  title: 'Tugas Aktif & Riwayat – Labor2Go',
  description: 'Pantau pekerjaan aktif, check-in, check-out, dan riwayat tugas mahasiswa di Labor2Go.',
}

function ActivitySkeleton() {
  return (
    <div className="flex-1 w-full px-4 pt-4 pb-12 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="flex flex-col gap-1.5">
          <div className="w-36 h-5 rounded bg-gray-200" />
          <div className="w-48 h-3 rounded bg-gray-200" />
        </div>
      </div>
      <div className="w-full h-20 rounded-3xl bg-gray-200" />
      <div className="w-32 h-4 rounded bg-gray-200 mt-2" />
      <div className="w-full h-36 rounded-2xl bg-gray-200" />
      <div className="w-full h-36 rounded-2xl bg-gray-200" />
    </div>
  )
}

async function StudentActivityContent() {
  await connection()

  const supabase = await createClient()

  // 1. Verifikasi user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/student/activity')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Gagal memeriksa peran user untuk tugas aktif:', profileError)
  }

  const role = profile?.role || user.user_metadata?.role || 'student'
  if (role === 'admin') {
    redirect('/admin')
  }
  if (role !== 'student') {
    redirect('/merchant/jobs')
  }

  // 2. Query applications + jobs + payments
  const { data: appsData, error: appsError } = await supabase
    .from('applications')
    .select(`
      id,
      job_id,
      status,
      checked_in_at,
      checked_out_at,
      created_at,
      jobs (
        id,
        title,
        start_at,
        end_at,
        pay_amount,
        location_name,
        umkm_id,
        status
      ),
      payments (
        id,
        amount,
        status,
        created_at
      )
    `)
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  if (appsError) {
    console.error('Error fetching student applications:', appsError)
  }

  // 3. Ambil daftar umkm_id untuk lookup nama usaha dari umkm_profiles
  const umkmIds: string[] = []
  if (appsData) {
    appsData.forEach((item) => {
      const jobObj = Array.isArray(item.jobs) ? item.jobs[0] : item.jobs
      if (jobObj?.umkm_id && !umkmIds.includes(jobObj.umkm_id)) {
        umkmIds.push(jobObj.umkm_id)
      }
    })
  }

  const umkmMap: Record<string, { business_name: string; business_type: string | null }> = {}
  if (umkmIds.length > 0) {
    const { data: umkmProfiles, error: umkmError } = await supabase
      .from('umkm_profiles')
      .select('id, business_name, business_type')
      .in('id', umkmIds)

    if (umkmError) {
      console.error('Error fetching umkm_profiles:', umkmError)
    }

    if (umkmProfiles) {
      umkmProfiles.forEach((u) => {
        umkmMap[u.id] = {
          business_name: u.business_name,
          business_type: u.business_type,
        }
      })
    }
  }

  // 4. Transform data ke format ActivityApplication
  const initialApplications: ActivityApplication[] = (appsData || [])
    .map((item) => {
      const jobRaw = Array.isArray(item.jobs) ? item.jobs[0] : item.jobs
      if (!jobRaw) return null

      const paymentRaw = Array.isArray(item.payments) ? item.payments[0] : item.payments

      const job: ActivityJob = {
        id: jobRaw.id,
        title: jobRaw.title,
        start_at: jobRaw.start_at,
        end_at: jobRaw.end_at,
        pay_amount: Number(jobRaw.pay_amount),
        location_name: jobRaw.location_name || null,
        umkm_id: jobRaw.umkm_id,
        status: jobRaw.status,
      }

      const payment: ActivityPayment | null = paymentRaw
        ? {
            id: paymentRaw.id,
            amount: Number(paymentRaw.amount),
            status: paymentRaw.status,
            created_at: paymentRaw.created_at,
          }
        : null

      const umkmInfo = umkmMap[job.umkm_id]

      const app: ActivityApplication = {
        id: item.id,
        job_id: item.job_id,
        status: item.status,
        checked_in_at: item.checked_in_at,
        checked_out_at: item.checked_out_at,
        created_at: item.created_at,
        job,
        payment,
        business_name: umkmInfo?.business_name || 'Usaha Mitra',
        business_type: umkmInfo?.business_type || null,
      }

      return app
    })
    .filter((a): a is ActivityApplication => a !== null)

  // 5. Satu query batch untuk cek ulasan yang sudah diberikan mahasiswa pada tugas selesai
  const releasedJobIds = Array.from(
    new Set(
      initialApplications
        .filter((a) => a.payment?.status === 'released')
        .map((a) => a.job_id)
    )
  )

  const initialMyReviewsByJobId: Record<string, number> = {}
  if (releasedJobIds.length > 0) {
    const { data: myReviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('job_id, rating')
      .eq('reviewer_id', user.id)
      .in('job_id', releasedJobIds)

    if (reviewsError) {
      console.error('Error fetching student reviews:', reviewsError)
    } else if (myReviews) {
      myReviews.forEach((r) => {
        initialMyReviewsByJobId[r.job_id] = Number(r.rating)
      })
    }
  }

  const serverTime = new Date().toISOString()

  return (
    <StudentActivityView
      initialApplications={initialApplications}
      initialMyReviewsByJobId={initialMyReviewsByJobId}
      initialServerTime={serverTime}
      currentUserId={user.id}
    />
  )
}

export default function StudentActivityPage() {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <StudentActivityContent />
    </Suspense>
  )
}
