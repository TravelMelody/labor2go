'use client'

import React, { useState, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Zap, ShieldCheck, Mail, AlertCircle } from 'lucide-react'
import { RoleCard, UserRole } from '@/components/auth/RoleCard'
import { SocialLoginButton } from '@/components/auth/SocialLoginButton'
import { EmailAuthModal } from '@/components/auth/EmailAuthModal'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const supabase = createClient()

  const handleRoleAction = (role: UserRole) => {
    setSelectedRole(role)
    setIsAuthModalOpen(true)
  }

  const handleGoogleLogin = async () => {
    if (googleLoading) return
    try {
      setGoogleLoading(true)
      setOauthError(null)

      const origin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : ''

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?role=${selectedRole}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        setOauthError(error.message)
        setGoogleLoading(false)
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menghubungkan ke Google.'
      setOauthError(msg)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col px-4 pt-6 pb-8 bg-[#F8F9FF]">
      {/* Brand & Intro Section */}
      <section className="flex flex-col items-center text-center mt-2 mb-4">
        {/* Logo Labor2Go */}
        <div className="flex items-center justify-center mb-3">
          <Image
            src="/logo.png"
            alt="Labor2Go"
            width={170}
            height={44}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>

        {/* App Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEDE0] text-[#FF6B00] shadow-xs mb-3">
          <Zap className="w-3.5 h-3.5 fill-[#FF6B00]" />
          <span className="text-xs font-bold">Labor2Go</span>
          <span className="text-orange-300">•</span>
          <span className="text-xs text-orange-950 font-medium">
            Kampus & Solusi UMKM
          </span>
        </div>

        {/* Hero Headlines */}
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight mb-1">
          Mulai Langkahmu di Labor2Go
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-xs">
          Pilih peran untuk masuk atau mendaftar akun
        </p>

        {/* Alert jika ada error callback */}
        {(errorParam || oauthError) && (
          <div className="mt-3 w-full p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {oauthError ||
                'Gagal melakukan autentikasi. Silakan coba kembali atau gunakan email & kata sandi.'}
            </span>
          </div>
        )}
      </section>

      {/* Interactive Role Cards */}
      <div className="flex flex-col gap-3.5 w-full mb-4">
        <RoleCard
          role="student"
          isSelected={selectedRole === 'student'}
          onSelect={() => setSelectedRole('student')}
          onActionClick={() => handleRoleAction('student')}
        />

        <RoleCard
          role="umkm"
          isSelected={selectedRole === 'umkm'}
          onSelect={() => setSelectedRole('umkm')}
          onActionClick={() => handleRoleAction('umkm')}
        />
      </div>

      {/* Fast Sign-In Gateway Section */}
      <section className="flex flex-col w-full bg-white p-4 rounded-2xl shadow-xs border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs sm:text-sm font-bold text-[#0B1C30]">
            Opsi Masuk Cepat
          </span>
          <span className="text-[11px] sm:text-xs text-gray-500 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Aman & Terverifikasi
          </span>
        </div>

        <div className="flex flex-col gap-2.5 w-full">
          {/* Google Auth Button */}
          <SocialLoginButton
            provider="google"
            onClick={handleGoogleLogin}
            loading={googleLoading}
            label={`Lanjutkan Google sebagai ${
              selectedRole === 'student' ? 'Mahasiswa' : 'Merchant'
            }`}
          />
        </div>

        {/* Email & Password Direct Option */}
        <div className="mt-3.5 pt-3 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="text-xs font-semibold text-[#FF6B00] hover:text-[#E05E00] hover:underline inline-flex items-center gap-1.5 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Masuk atau daftar dengan Email & Kata Sandi</span>
          </button>
        </div>
      </section>

      {/* Legal & Privacy Notice Footer */}
      <footer className="text-center px-2 mt-auto">
        <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">
          Dengan masuk, anda menyetujui{' '}
          <Link
            href="/legal/terms"
            className="font-semibold text-[#FF6B00] underline decoration-[#FF6B00]/40 hover:decoration-[#FF6B00]"
          >
            Syarat &amp; Ketentuan
          </Link>{' '}
          serta{' '}
          <Link
            href="/legal/privacy"
            className="font-semibold text-[#FF6B00] underline decoration-[#FF6B00]/40 hover:decoration-[#FF6B00]"
          >
            Kebijakan Privasi
          </Link>{' '}
          Labor2Go.
        </p>
      </footer>

      {/* Email / Password Modal */}
      <EmailAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialRole={selectedRole}
      />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FF]">
          <div className="w-6 h-6 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
