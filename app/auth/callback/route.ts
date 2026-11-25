import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const roleParam = searchParams.get('role') // 'student' | 'umkm'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      // Periksa apakah profil sudah ada di tabel profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      const finalRole =
        profile?.role ||
        data.user.user_metadata?.role ||
        (roleParam === 'umkm' ? 'umkm' : 'student')

      if (finalRole === 'admin') {
        return NextResponse.redirect(`${origin}/admin`)
      }

      // Cek apakah profil detail (student_profiles atau umkm_profiles) sudah ada
      const detailTable = finalRole === 'umkm' ? 'umkm_profiles' : 'student_profiles'
      const { data: detailProfile } = await supabase
        .from(detailTable)
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!detailProfile) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      if (finalRole === 'umkm') {
        return NextResponse.redirect(`${origin}/merchant`)
      } else {
        return NextResponse.redirect(`${origin}/student`)
      }
    }
  }

  // Jika otentikasi gagal atau tidak ada kode
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
