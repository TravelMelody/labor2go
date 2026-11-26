'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Store,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { normalizeSpaces, validatePersonName } from '@/lib/validation'

export type AuthMode = 'signin' | 'signup'
export type SignupRole = 'student' | 'umkm'

interface EmailAuthModalProps {
  isOpen: boolean
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onClose: () => void
  initialRole?: SignupRole
  redirectTo?: string | null
  initialError?: string | null
}

function getSafeRedirect(
  raw: string | null | undefined,
  role: 'student' | 'umkm' | 'admin'
): string {
  const defaultPath =
    role === 'admin' ? '/admin' : role === 'umkm' ? '/merchant' : '/student'

  if (!raw) return defaultPath
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed === '/login') {
    return defaultPath
  }

  if (role === 'admin') {
    return trimmed === '/admin' || trimmed.startsWith('/admin/')
      ? trimmed
      : '/admin'
  }

  if (role === 'student') {
    if (
      trimmed === '/student' ||
      trimmed.startsWith('/student/') ||
      trimmed.startsWith('/jobs/') ||
      trimmed.startsWith('/chat/')
    ) {
      return trimmed
    }
    return '/student'
  }

  if (
    trimmed === '/merchant' ||
    trimmed.startsWith('/merchant/') ||
    trimmed.startsWith('/jobs/') ||
    trimmed.startsWith('/chat/')
  ) {
    return trimmed
  }
  return '/merchant'
}

export function EmailAuthModal({
  isOpen,
  mode,
  onModeChange,
  onClose,
  initialRole = 'student',
  redirectTo = null,
  initialError = null,
}: EmailAuthModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<SignupRole>(initialRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, loading, onClose])

  if (!isOpen) return null

  const handleSwitchMode = (nextMode: AuthMode) => {
    if (loading) return
    setErrorMsg(null)
    setSuccessMsg(null)
    onModeChange(nextMode)
  }

  const handleClose = () => {
    if (loading) return
    setErrorMsg(null)
    setSuccessMsg(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email.trim() || !password) {
      setErrorMsg('Harap lengkapi email dan kata sandi.')
      return
    }

    const cleanFullName = normalizeSpaces(fullName)
    if (mode === 'signup') {
      const nameError = validatePersonName(cleanFullName, 'Nama lengkap')
      if (nameError) {
        setErrorMsg(nameError)
        return
      }
    }

    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role,
              full_name: cleanFullName,
            },
          },
        })

        if (error) {
          setErrorMsg(error.message)
          setLoading(false)
          return
        }

        if (data?.user) {
          if (data.session) {
            onClose()
            router.push('/onboarding')
            router.refresh()
            return
          } else {
            setSuccessMsg(
              'Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi akun.'
            )
            setLoading(false)
            return
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMsg('Email atau kata sandi yang Anda masukkan salah.')
          } else {
            setErrorMsg(error.message)
          }
          setLoading(false)
          return
        }

        if (data?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()

          if (profileError) {
            if (profileError.code === 'P0001') {
              console.warn('Peringatan membaca peran profil:', profileError.message)
            } else {
              console.error('Gagal membaca peran profil:', profileError)
            }
          }

          const rawRole = profile?.role || data.user.user_metadata?.role
          const targetRole: 'student' | 'umkm' | 'admin' =
            rawRole === 'admin'
              ? 'admin'
              : rawRole === 'umkm'
              ? 'umkm'
              : 'student'

          if (targetRole === 'admin') {
            onClose()
            router.push(getSafeRedirect(redirectTo, 'admin'))
            router.refresh()
            return
          }

          const detailTable =
            targetRole === 'umkm' ? 'umkm_profiles' : 'student_profiles'

          const { data: detailProfile, error: detailError } = await supabase
            .from(detailTable)
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle()

          if (detailError) {
            console.error('Gagal memeriksa kelengkapan profil:', detailError)
          }

          onClose()
          if (!detailProfile) {
            router.push('/onboarding')
          } else {
            router.push(getSafeRedirect(redirectTo, targetRole))
          }
          router.refresh()
          return
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga.'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const isSignup = mode === 'signup'
  const isStudentSignup = role === 'student'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          type="button"
          disabled={loading}
          aria-label="Tutup modal autentikasi"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Title */}
        <div className="pr-10 mb-5">
          <h3 id="auth-modal-title" className="text-xl font-extrabold text-[#0B1C30] mb-1">
            {isSignup ? 'Daftar Akun Baru' : 'Masuk ke Labor2Go'}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500">
            {isSignup
              ? 'Pilih peran lalu lengkapi data untuk mulai di Labor2Go'
              : 'Masukkan email dan kata sandi akun Anda'}
          </p>
        </div>

        {/* Role Tabs ONLY on Daftar (Signup) */}
        {isSignup && (
          <div
            role="tablist"
            aria-label="Pilih peran pendaftaran"
            className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-5 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={role === 'student'}
              onClick={() => {
                setRole('student')
                setErrorMsg(null)
              }}
              className={`py-2.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                role === 'student'
                  ? 'bg-white text-[#FF6B00] shadow-xs'
                  : 'text-gray-500 hover:text-[#0B1C30]'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Mahasiswa</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'umkm'}
              onClick={() => {
                setRole('umkm')
                setErrorMsg(null)
              }}
              className={`py-2.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                role === 'umkm'
                  ? 'bg-white text-[#0B1C30] shadow-xs'
                  : 'text-gray-500 hover:text-[#0B1C30]'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>Merchant</span>
            </button>
          </div>
        )}

        {/* Alert Error / Success */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {isSignup && (
            <div>
              <label
                htmlFor="auth-fullname"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="auth-fullname"
                  type="text"
                  required
                  maxLength={60}
                  placeholder={
                    isStudentSignup ? 'Contoh: Bagas Pratama' : 'Contoh: Budi Santoso'
                  }
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-sm text-[#0B1C30]"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-sm text-[#0B1C30]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-sm text-[#0B1C30]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`mt-2 w-full h-12 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${
              isSignup && !isStudentSignup
                ? 'bg-[#0B1C30] hover:bg-[#152843] shadow-gray-900/20'
                : 'bg-[#FF6B00] hover:bg-[#E05E00] shadow-[#FF6B00]/25'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : isSignup ? (
              isStudentSignup ? (
                'Daftar Sebagai Mahasiswa'
              ) : (
                'Daftar Sebagai Merchant'
              )
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        {/* Footer Mode Switcher */}
        <p className="mt-4 text-center text-xs sm:text-sm text-gray-600">
          {isSignup ? (
            <>
              Sudah memiliki akun?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signin')}
                className="font-bold text-[#FF6B00] hover:text-[#E05E00] hover:underline cursor-pointer"
              >
                Masuk di sini.
              </button>
            </>
          ) : (
            <>
              Belum punya akun?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signup')}
                className="font-bold text-[#FF6B00] hover:text-[#E05E00] hover:underline cursor-pointer"
              >
                Daftar di sini.
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
