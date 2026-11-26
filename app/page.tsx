import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPublicLatestJobs } from '@/lib/public-jobs'
import { LandingPageClient } from '@/components/landing/LandingPageClient'
import type { AuthMode } from '@/components/auth/EmailAuthModal'

export const metadata: Metadata = {
  title: 'Labor2Go – Kerja Fleksibel Mahasiswa & Bantuan UMKM Sekitar Kampus',
  description:
    'Platform marketplace tenaga kerja mikro yang menghubungkan mahasiswa pencari kerja paruh waktu/harian dengan UMKM sekitar kampus.',
}

interface HomePageProps {
  searchParams: Promise<{
    auth?: string
    redirectTo?: string
    error?: string
  }>
}

function LandingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FF]">
      <header className="sticky top-0 z-40 w-full bg-white/95 border-b border-gray-100">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="w-28 h-7 rounded-lg bg-gray-200 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="w-20 h-9 rounded-full bg-gray-100 animate-pulse" />
            <div className="w-20 h-9 rounded-full bg-orange-100 animate-pulse" />
          </div>
        </div>
      </header>
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col gap-6 animate-pulse">
        <div className="h-64 rounded-3xl bg-white border border-gray-100" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-36 rounded-2xl bg-white border border-gray-100" />
          <div className="h-36 rounded-2xl bg-white border border-gray-100" />
          <div className="h-36 rounded-2xl bg-white border border-gray-100" />
        </div>
      </main>
    </div>
  )
}

async function HomeContent({ searchParams }: HomePageProps) {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || user.user_metadata?.role || 'student'

    if (role === 'admin') {
      redirect('/admin')
    }

    const detailTable = role === 'umkm' ? 'umkm_profiles' : 'student_profiles'
    const { data: detailProfile } = await supabase
      .from(detailTable)
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!detailProfile) {
      redirect('/onboarding')
    }

    redirect(role === 'umkm' ? '/merchant' : '/student')
  }

  const resolvedParams = await searchParams
  const initialAuthMode: AuthMode | null =
    resolvedParams.auth === 'signup'
      ? 'signup'
      : resolvedParams.auth === 'signin'
      ? 'signin'
      : null

  const initialRedirectTo =
    typeof resolvedParams.redirectTo === 'string' &&
    resolvedParams.redirectTo.startsWith('/') &&
    !resolvedParams.redirectTo.startsWith('//')
      ? resolvedParams.redirectTo
      : null

  const rawError =
    typeof resolvedParams.error === 'string' ? resolvedParams.error : null
  const initialError =
    rawError === 'auth_failed'
      ? 'Gagal melakukan autentikasi. Silakan coba kembali atau gunakan email & kata sandi.'
      : rawError

  const jobs = await getPublicLatestJobs(12)

  return (
    <LandingPageClient
      jobs={jobs}
      initialAuthMode={initialAuthMode}
      initialRedirectTo={initialRedirectTo}
      initialError={initialError}
    />
  )
}

export default function HomePage({ searchParams }: HomePageProps) {
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  )
}
