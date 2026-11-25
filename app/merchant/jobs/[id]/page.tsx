import React, { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MerchantJobApplicantsView,
  type MerchantJobInfo,
  type ApplicantItem,
} from '@/components/merchant/MerchantJobApplicantsView'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ProfileRecord {
  id: string
  full_name: string | null
  phone: string | null
  verified: boolean
}

interface StudentProfileRecord {
  id: string
  university: string | null
  skills: string[] | null
  level: number | null
  completed_jobs: number | null
}

interface ProfileRatingRecord {
  user_id: string
  avg_rating: number | null
  review_count: number | null
}

interface ApplicationPaymentRecord {
  id: string
  amount: number
  commission: number
  status: 'pending' | 'held' | 'released' | 'refunded'
}

interface ApplicationRow {
  id: string
  job_id: string
  student_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  checked_in_at: string | null
  checked_out_at: string | null
  created_at: string
  payments?: ApplicationPaymentRecord[] | ApplicationPaymentRecord | null
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  return {
    title: 'Kelola Pelamar – Labor2Go',
    description: `Kelola pelamar dan terima pekerja lowongan Labor2Go (ID: ${id})`,
  }
}

function MerchantApplicantsSkeleton() {
  return (
    <div className="flex-1 flex flex-col px-4 pt-5 pb-24 animate-pulse">
      {/* Top Header skeleton */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="space-y-1.5 flex-1">
          <div className="w-36 h-4 bg-gray-200 rounded-md" />
          <div className="w-48 h-3 bg-gray-100 rounded-md" />
        </div>
      </div>

      {/* Summary Card skeleton */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-5 space-y-3">
        <div className="flex justify-between items-center">
          <div className="w-24 h-4 bg-gray-200 rounded-full" />
          <div className="w-24 h-5 bg-gray-200 rounded-full" />
        </div>
        <div className="w-3/4 h-6 bg-gray-200 rounded-lg" />
        <div className="w-full h-8 bg-gray-100 rounded-xl" />
        <div className="w-full h-20 bg-gray-50 rounded-2xl" />
        <div className="w-full h-12 bg-gray-100 rounded-xl" />
      </div>

      {/* Applicants List skeleton */}
      <div className="space-y-3">
        <div className="w-32 h-4 bg-gray-200 rounded-md mb-2" />
        <div className="bg-white rounded-2xl p-4 border border-gray-100 h-32" />
        <div className="bg-white rounded-2xl p-4 border border-gray-100 h-32" />
      </div>
    </div>
  )
}

async function MerchantManageApplicantsContent({ params }: PageProps) {
  const { id } = await params
  await connection()

  const supabase = await createClient()

  // 1. Verifikasi Autentikasi Pengguna
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect(`/login?redirectTo=/merchant/jobs/${id}`)
  }

  // 2. Proteksi Peran: Hanya UMKM yang boleh mengakses
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Error saat membaca role profil UMKM:', profileError)
  }

  const role = profile?.role || user.user_metadata?.role
  if (role !== 'umkm') {
    redirect('/student')
  }

  // 3. Baca Data Lowongan (Wajib milik user; 404 jika bukan miliknya atau tidak ada)
  const { data: jobData, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (jobError) {
    console.error('Error saat membaca lowongan merchant:', jobError)
  }

  if (!jobData || jobData.umkm_id !== user.id) {
    notFound()
  }

  // 4. Baca Saldo Dompet Milik User
  const { data: walletData, error: walletError } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  if (walletError) {
    console.error('Error saat membaca wallet merchant:', walletError)
  }
  const walletBalance = Number(walletData?.balance || 0)

  // 5. Baca Biaya Layanan dari platform_settings (key: service_fee_per_worker)
  const { data: settingsData, error: settingsError } = await supabase
    .from('platform_settings')
    .select('int_value')
    .eq('key', 'service_fee_per_worker')
    .maybeSingle()

  if (settingsError) {
    console.error('Error saat membaca platform_settings biaya layanan:', settingsError)
  }
  const serviceFee = Number(settingsData?.int_value ?? 5000)

  // 6. Baca Applications untuk Job Ini (termasuk status check-in/out dan payments)
  const { data: appsData, error: appsError } = await supabase
    .from('applications')
    .select(`
      id,
      job_id,
      student_id,
      status,
      checked_in_at,
      checked_out_at,
      created_at,
      payments (
        id,
        amount,
        commission,
        status
      )
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false })

  if (appsError) {
    console.error('Error saat membaca data applications:', appsError)
  }

  // 7. Ambil info pelamar: profiles, student_profiles, dan profile_ratings
  const rawApps = (appsData || []) as ApplicationRow[]
  const studentIds = Array.from(new Set(rawApps.map((a) => a.student_id)))

  let profilesMap: Record<string, ProfileRecord> = {}
  let studentProfilesMap: Record<string, StudentProfileRecord> = {}
  let ratingsMap: Record<string, ProfileRatingRecord> = {}
  let myReviewsMap: Record<string, number> = {}

  if (studentIds.length > 0) {
    const [profilesRes, studentProfilesRes, ratingsRes, myReviewsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, phone, verified')
        .in('id', studentIds),
      supabase
        .from('student_profiles')
        .select('id, university, skills, level, completed_jobs')
        .in('id', studentIds),
      supabase
        .from('profile_ratings')
        .select('user_id, avg_rating, review_count')
        .in('user_id', studentIds),
      supabase
        .from('reviews')
        .select('reviewee_id, rating')
        .eq('job_id', id)
        .eq('reviewer_id', user.id),
    ])

    if (profilesRes.error) {
      console.error('Error saat membaca profiles pelamar di server:', profilesRes.error)
    } else if (profilesRes.data) {
      profilesMap = (profilesRes.data as ProfileRecord[]).reduce((acc, curr) => {
        acc[curr.id] = curr
        return acc
      }, {} as Record<string, ProfileRecord>)
    }

    if (studentProfilesRes.error) {
      console.error('Error saat membaca student_profiles di server:', studentProfilesRes.error)
    } else if (studentProfilesRes.data) {
      studentProfilesMap = (studentProfilesRes.data as StudentProfileRecord[]).reduce((acc, curr) => {
        acc[curr.id] = curr
        return acc
      }, {} as Record<string, StudentProfileRecord>)
    }

    if (ratingsRes.error) {
      console.error('Error saat membaca profile_ratings di server:', ratingsRes.error)
    } else if (ratingsRes.data) {
      ratingsMap = (ratingsRes.data as ProfileRatingRecord[]).reduce((acc, curr) => {
        acc[curr.user_id] = curr
        return acc
      }, {} as Record<string, ProfileRatingRecord>)
    }

    if (myReviewsRes.error) {
      console.error('Error saat membaca ulasan merchant di server:', myReviewsRes.error)
    } else if (myReviewsRes.data) {
      myReviewsMap = (myReviewsRes.data as Array<{ reviewee_id: string; rating: number }>).reduce(
        (acc, curr) => {
          acc[curr.reviewee_id] = Number(curr.rating)
          return acc
        },
        {} as Record<string, number>
      )
    }
  }

  const initialApplications: ApplicantItem[] = rawApps.map((app) => {
    const prof = profilesMap[app.student_id]
    const sp = studentProfilesMap[app.student_id]
    const rat = ratingsMap[app.student_id]
    const rawPay = Array.isArray(app.payments)
      ? app.payments[0] || null
      : app.payments || null

    return {
      id: app.id,
      job_id: app.job_id,
      student_id: app.student_id,
      status: app.status,
      checked_in_at: app.checked_in_at || null,
      checked_out_at: app.checked_out_at || null,
      created_at: app.created_at,
      my_review_rating: myReviewsMap[app.student_id] ?? null,
      payment: rawPay
        ? {
            id: rawPay.id,
            amount: rawPay.amount,
            commission: rawPay.commission,
            status: rawPay.status,
          }
        : null,
      student: {
        id: app.student_id,
        full_name: prof?.full_name || 'Mahasiswa',
        phone: prof?.phone || null,
        verified: Boolean(prof?.verified),
        university: sp?.university || 'Universitas Negeri Semarang',
        skills: Array.isArray(sp?.skills) ? sp.skills : [],
        level: sp?.level ?? 1,
        completed_jobs: sp?.completed_jobs ?? 0,
        avg_rating: rat?.avg_rating != null ? Number(rat.avg_rating) : null,
        review_count: rat?.review_count ?? 0,
      },
    }
  })

  return (
    <MerchantJobApplicantsView
      initialJob={jobData as MerchantJobInfo}
      initialApplications={initialApplications}
      initialWalletBalance={walletBalance}
      initialServiceFee={serviceFee}
      currentUserId={user.id}
    />
  )
}

export default function MerchantManageApplicantsPage({ params }: PageProps) {
  return (
    <Suspense fallback={<MerchantApplicantsSkeleton />}>
      <MerchantManageApplicantsContent params={params} />
    </Suspense>
  )
}
