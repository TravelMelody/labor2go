'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface RoleHomeButtonProps {
  variant?: 'primary' | 'secondary'
  className?: string
}

interface HomeTarget {
  href: string
  label: string
}

export function RoleHomeButton({
  variant = 'primary',
  className = '',
}: RoleHomeButtonProps) {
  const [target, setTarget] = useState<HomeTarget>({
    href: '/login',
    label: 'Kembali ke Beranda',
  })

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function resolveRoleTarget() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!active) return

        if (!user) {
          setTarget({
            href: '/login',
            label: 'Kembali ke Halaman Masuk',
          })
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (!active) return

        const role = profile?.role || user.user_metadata?.role
        if (role === 'umkm') {
          setTarget({
            href: '/merchant',
            label: 'Kembali ke Beranda Mitra',
          })
        } else if (role === 'admin') {
          setTarget({
            href: '/admin',
            label: 'Kembali ke Panel Admin',
          })
        } else {
          setTarget({
            href: '/student',
            label: 'Kembali ke Beranda Mahasiswa',
          })
        }
      } catch {
        // Pertahankan fallback default jika gagal membaca sesi
      }
    }

    void resolveRoleTarget()
    return () => {
      active = false
    }
  }, [])

  const baseClass =
    variant === 'primary'
      ? 'w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold text-sm shadow-md shadow-orange-500/20'
      : 'w-full h-11 rounded-full bg-white hover:bg-gray-50 text-[#0B1C30] border border-gray-200 font-bold text-xs'

  return (
    <Link
      href={target.href}
      className={`inline-flex items-center justify-center gap-2 px-5 active:scale-[0.99] transition-all ${baseClass} ${className}`}
    >
      {variant === 'primary' ? (
        <Home className="w-4 h-4 shrink-0" />
      ) : (
        <ArrowLeft className="w-4 h-4 shrink-0" />
      )}
      <span>{target.label}</span>
    </Link>
  )
}
