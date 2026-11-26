import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from '@/components/admin/AdminShell'

export const metadata = {
  title: 'Dashboard Admin – Labor2Go',
  description: 'Panel administrasi verifikasi, penarikan dana, pengguna, dan audit Labor2Go',
}

function AdminLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8F9FF] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-gray-500">
        <Loader2 className="w-7 h-7 animate-spin text-[#FF6B00]" />
        <span className="text-xs font-semibold">Memuat panel admin...</span>
      </div>
    </div>
  )
}

async function AdminGuard({ children }: { children: React.ReactNode }) {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/?auth=signin&redirectTo=/admin')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Gagal memeriksa peran admin:', profileError)
  }

  if (profile?.role !== 'admin') {
    redirect(profile?.role === 'umkm' ? '/merchant' : '/student')
  }

  const adminName =
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.email ||
    'Admin'

  return <AdminShell adminName={adminName}>{children}</AdminShell>
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<AdminLayoutSkeleton />}>
      <AdminGuard>{children}</AdminGuard>
    </Suspense>
  )
}
