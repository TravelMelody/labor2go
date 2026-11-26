import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Rute publik legal & bantuan berada di luar proteksi login
  if (pathname.startsWith('/legal') || pathname === '/help') {
    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isStudentRoute = pathname.startsWith('/student')
  const isMerchantRoute = pathname.startsWith('/merchant')
  const isChatRoute = pathname.startsWith('/chat')
  const isJobsRoute = pathname.startsWith('/jobs')
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  const isAdminRoute = pathname.startsWith('/admin')
  const isAuthRoute = pathname === '/login'

  // Jika belum login dan mencoba mengakses rute terproteksi
  if (!user) {
    if (isStudentRoute || isMerchantRoute || isChatRoute || isOnboardingRoute || isAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      if (!isOnboardingRoute) {
        url.searchParams.set('redirectTo', pathname)
      }
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // User sudah terautentikasi: ambil role user dari tabel profiles atau metadata
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role || user.user_metadata?.role || 'student'

  // Role admin tidak perlu onboarding dan hanya boleh mengakses /admin
  if (role === 'admin') {
    if (isAdminRoute) {
      return supabaseResponse
    }
    if (
      isStudentRoute ||
      isMerchantRoute ||
      isChatRoute ||
      isJobsRoute ||
      isOnboardingRoute ||
      isAuthRoute ||
      pathname === '/'
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const detailTable = role === 'umkm' ? 'umkm_profiles' : 'student_profiles'

  // Cek apakah profil detail sudah ada
  const { data: detailProfile } = await supabase
    .from(detailTable)
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const hasCompletedProfile = Boolean(detailProfile)

  // 0. Rute Admin (/admin) oleh role non-admin -> arahkan ke beranda masing-masing
  if (isAdminRoute) {
    const url = request.nextUrl.clone()
    if (!hasCompletedProfile) {
      url.pathname = '/onboarding'
    } else {
      url.pathname = role === 'umkm' ? '/merchant' : '/student'
    }
    return NextResponse.redirect(url)
  }

  // 1. Rute Onboarding (/onboarding)
  if (isOnboardingRoute) {
    // Jika profil detail sudah lengkap, larang akses /onboarding dan arahkan ke dashboard
    if (hasCompletedProfile) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'umkm' ? '/merchant' : '/student'
      return NextResponse.redirect(url)
    }
    // Jika belum lengkap, izinkan akses form onboarding
    return supabaseResponse
  }

  // 2. Rute Dashboard (/student atau /merchant)
  if (isStudentRoute || isMerchantRoute) {
    // Mencegah akses silang peran (student ke merchant atau sebaliknya)
    if (isStudentRoute && role !== 'student') {
      const url = request.nextUrl.clone()
      url.pathname = '/merchant'
      return NextResponse.redirect(url)
    }

    if (isMerchantRoute && role !== 'umkm') {
      const url = request.nextUrl.clone()
      url.pathname = '/student'
      return NextResponse.redirect(url)
    }

    // Jika user belum melengkapi profil detail, redirect ke /onboarding
    if (!hasCompletedProfile) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // 2b. Rute Chat (/chat) untuk role non-admin yang sudah melengkapi profil
  if (isChatRoute) {
    if (!hasCompletedProfile) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 3. Rute Login (/login) saat user sudah login
  if (isAuthRoute) {
    const url = request.nextUrl.clone()
    if (!hasCompletedProfile) {
      url.pathname = '/onboarding'
    } else {
      url.pathname = role === 'umkm' ? '/merchant' : '/student'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
