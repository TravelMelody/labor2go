import React, { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getShiftBadge, isUrgentJob } from '@/lib/format'
import {
  JobDetailView,
  type JobDetailData,
  type CurrentUserData,
  type ApplicationData,
} from '@/components/jobs/JobDetailView'
import type { ReviewItem } from '@/components/reviews/ReviewList'

interface ServerReviewRow {
  id: string
  rating: number
  comment: string | null
  created_at: string
  profiles?:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null
}

function extractReviewerFirstName(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return 'Pengguna'
  const first = fullName.trim().split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  return {
    title: 'Detail Lowongan – Labor2Go',
    description: `Detail lowongan pekerjaan mikro mahasiswa di Labor2Go (ID: ${id})`,
  }
}

function JobDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8F9FF] flex flex-col items-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col px-4 pt-4 pb-20 animate-pulse gap-4">
        {/* Header skeleton */}
        <div className="h-12 flex items-center justify-between border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="w-32 h-5 rounded bg-gray-200" />
          <div className="w-10 h-10 rounded-full bg-gray-200" />
        </div>

        {/* Badges skeleton */}
        <div className="flex gap-2">
          <div className="w-20 h-6 rounded-full bg-gray-200" />
          <div className="w-28 h-6 rounded-full bg-gray-200" />
        </div>

        {/* Title skeleton */}
        <div className="w-3/4 h-7 rounded-lg bg-gray-200" />
        <div className="w-1/2 h-4 rounded bg-gray-200" />

        {/* Card skeleton */}
        <div className="w-full h-72 rounded-2xl bg-white border border-gray-100 p-4 flex flex-col gap-4">
          <div className="w-full h-12 rounded-xl bg-gray-100" />
          <div className="w-full h-20 rounded-xl bg-gray-100" />
          <div className="w-full h-16 rounded-xl bg-gray-100" />
        </div>

        {/* Map skeleton */}
        <div className="w-full h-44 rounded-2xl bg-gray-200" />
      </div>
    </div>
  )
}

async function JobDetailContent({ params }: PageProps) {
  // Panggil connection() di awal sebelum kode apa pun yang membaca sesi atau memakai Date
  await connection()

  const { id } = await params
  const supabase = await createClient()

  // 1. Verifikasi sesi user login
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/?auth=signin&redirectTo=/jobs/${id}`)
  }

  // 2. Ambil profil user saat ini (role, verified, full_name)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, verified, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Error fetching user profile:', profileError)
  }

  const currentUser: CurrentUserData = {
    id: user.id,
    role: (profile?.role || user.user_metadata?.role || 'student') as CurrentUserData['role'],
    isVerified: Boolean(profile?.verified),
    fullName: profile?.full_name || user.user_metadata?.full_name || null,
  }

  if (currentUser.role === 'admin') {
    redirect('/admin')
  }

  // 3. Sumber utama: VIEW jobs_feed (id = param)
  const { data: feedData, error: feedError } = await supabase
    .from('jobs_feed')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (feedError) {
    console.error('Error fetching jobs_feed:', feedError)
  }

  let directJob = null
  let isAvailable = true

  // 4. Jika tidak ditemukan di jobs_feed, coba baca dari tabel jobs (RLS)
  if (!feedData) {
    isAvailable = false
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (jobError) {
      console.error('Error fetching jobs fallback:', jobError)
    }

    if (!jobData) {
      // Tetap tidak ada di tabel jobs -> notFound()
      notFound()
    }

    directJob = jobData
  }

  // umkm_id diambil langsung dari view jobs_feed atau tabel jobs (bukan join yang bisa null)
  const baseJob = feedData || directJob
  const umkmId = String(baseJob.umkm_id)
  const userId = String(user.id)

  // (b) Perbandingan job.umkm_id === user.id (string)
  const isOwner = umkmId.trim().toLowerCase() === userId.trim().toLowerCase()

  // 5. Info merchant: umkm_profiles, profiles.full_name, view profile_ratings, dan 3 ulasan terbaru
  const [ownerRes, umkmRes, ratingRes, acceptedAppsRes, reviewsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', umkmId)
      .maybeSingle(),
    supabase
      .from('umkm_profiles')
      .select('business_name, business_type, photo_url, address')
      .eq('id', umkmId)
      .maybeSingle(),
    supabase
      .from('profile_ratings')
      .select('avg_rating, review_count')
      .eq('user_id', umkmId)
      .maybeSingle(),
    !feedData
      ? supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', id)
          .eq('status', 'accepted')
      : Promise.resolve({ count: 0, error: null }),
    supabase
      .from('reviews')
      .select('id, rating, comment, created_at, profiles!reviews_reviewer_id_fkey(full_name)')
      .eq('reviewee_id', umkmId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  if (ownerRes.error) console.error('Error fetching merchant owner profile:', ownerRes.error)
  if (umkmRes.error) console.error('Error fetching umkm profile:', umkmRes.error)
  if (ratingRes.error) console.error('Error fetching profile ratings:', ratingRes.error)
  if (reviewsRes.error) console.error('Error fetching merchant reviews:', reviewsRes.error)

  const slotsLeft = feedData
    ? feedData.slots_left
    : Math.max(0, directJob.slots - (acceptedAppsRes.count || 0))

  // Hitung badge shift & urgensi di server setelah connection() untuk mencegah hydration mismatch
  const shiftBadge = getShiftBadge(baseJob.start_at)
  const isUrgent = isUrgentJob(baseJob.start_at)

  const avgRating =
    ratingRes.data?.avg_rating != null
      ? Number(ratingRes.data.avg_rating)
      : feedData?.avg_rating != null
      ? Number(feedData.avg_rating)
      : null
  const reviewCount =
    ratingRes.data?.review_count != null
      ? Number(ratingRes.data.review_count)
      : Number(feedData?.review_count ?? 0)

  const initialReviews: ReviewItem[] = (
    (reviewsRes.data ?? []) as ServerReviewRow[]
  ).map((row) => {
    const profObj = Array.isArray(row.profiles)
      ? row.profiles[0] || null
      : row.profiles || null
    return {
      id: row.id,
      rating: Number(row.rating),
      comment: row.comment?.trim() ? row.comment.trim() : null,
      created_at: row.created_at,
      reviewer_first_name: extractReviewerFirstName(profObj?.full_name),
    }
  })

  const jobDetail: JobDetailData = {
    id: baseJob.id,
    umkm_id: umkmId,
    title: baseJob.title,
    description: baseJob.description,
    location_name: baseJob.location_name,
    lat: baseJob.lat,
    lng: baseJob.lng,
    start_at: baseJob.start_at,
    end_at: baseJob.end_at,
    pay_amount: baseJob.pay_amount,
    slots: baseJob.slots,
    slots_left: slotsLeft,
    created_at: baseJob.created_at,
    business_name:
      feedData?.business_name ||
      umkmRes.data?.business_name ||
      'Usaha Mitra',
    business_type:
      feedData?.business_type ||
      umkmRes.data?.business_type ||
      null,
    business_photo:
      feedData?.business_photo ||
      umkmRes.data?.photo_url ||
      null,
    owner_name: ownerRes.data?.full_name || 'Pemilik Usaha',
    merchant_address: umkmRes.data?.address || null,
    avg_rating: avgRating,
    review_count: reviewCount,
    isAvailable,
    shiftBadge,
    isUrgent,
    isOwner,
  }

  // 6. Cek lamaran untuk mahasiswa (role student) & kontak merchant jika sudah accepted
  let initialApplication: ApplicationData | null = null
  let initialMerchantPhone: string | null = null
  if (currentUser.role === 'student') {
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('id, status')
      .eq('job_id', id)
      .eq('student_id', user.id)
      .maybeSingle()

    if (appError) {
      console.error('Error fetching student application:', appError)
    }

    if (appData) {
      initialApplication = {
        id: appData.id,
        status: appData.status as ApplicationData['status'],
      }

      if (appData.status === 'accepted') {
        const { data: contactData, error: contactError } = await supabase.rpc(
          'get_counterpart_contact',
          { p_application_id: appData.id }
        )

        if (contactError) {
          if (contactError.code === 'P0001') {
            console.warn(
              'Peringatan get_counterpart_contact di detail lowongan:',
              contactError.message
            )
          } else {
            console.error(
              'Error get_counterpart_contact di detail lowongan:',
              contactError
            )
          }
        } else {
          const rawContact = contactData as
            | { full_name?: string | null; phone?: string | null }
            | Array<{ full_name?: string | null; phone?: string | null }>
            | null
          const contactRow = Array.isArray(rawContact)
            ? rawContact[0] ?? null
            : rawContact
          initialMerchantPhone = contactRow?.phone || null
        }
      }
    }
  }

  return (
    <JobDetailView
      job={jobDetail}
      currentUser={currentUser}
      initialApplication={initialApplication}
      initialMerchantPhone={initialMerchantPhone}
      initialReviews={initialReviews}
    />
  )
}

export default function JobDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      <JobDetailContent params={params} />
    </Suspense>
  )
}
