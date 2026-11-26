'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from './RoleCard'

interface EmailAuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialRole: UserRole
}

export function EmailAuthModal({
  isOpen,
  onClose,
  initialRole,
}: EmailAuthModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [roleOverride, setRoleOverride] = useState<{
    base: UserRole
    selected: UserRole
  } | null>(null)
  const role =
    roleOverride && roleOverride.base === initialRole
      ? roleOverride.selected
      : initialRole
  const setRole = (next: UserRole) =>
    setRoleOverride({ base: initialRole, selected: next })

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email || !password) {
      setErrorMsg('Harap lengkapi email dan kata sandi.')
      return
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMsg('Harap masukkan nama lengkap Anda.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        // Sign Up flow with options.data { role, full_name }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role,
              full_name: fullName.trim(),
            },
          },
        })

        if (error) {
          setErrorMsg(error.message)
          setLoading(false)
          return
        }

        if (data?.user) {
          // Baris profiles sudah dibuat otomatis oleh database trigger saat signup
          if (data.session) {
            router.push('/onboarding')
            router.refresh()
            return
          } else {
            // Perlu konfirmasi email
            setSuccessMsg(
              'Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi akun.'
            )
            setLoading(false)
            return
          }
        }
      } else {
        // Sign In flow
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
          // Ambil peran dari tabel profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()

          const targetRole = profile?.role || data.user.user_metadata?.role || role

          if (targetRole === 'admin') {
            router.push('/admin')
            router.refresh()
            return
          }

          const detailTable = targetRole === 'umkm' ? 'umkm_profiles' : 'student_profiles'

          const { data: detailProfile } = await supabase
            .from(detailTable)
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle()

          if (!detailProfile) {
            router.push('/onboarding')
          } else if (targetRole === 'umkm') {
            router.push('/merchant')
          } else {
            router.push('/student')
          }
          router.refresh()
          return
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga.'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const isStudent = role === 'student'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Tutup"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Role Pill Switcher */}
        <div className="flex flex-wrap items-center gap-2 mb-4 pr-10">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Peran:
          </span>
          <button
            type="button"
            onClick={() => setRole(isStudent ? 'umkm' : 'student')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              isStudent
                ? 'bg-[#FFEDE0] text-[#FF6B00]'
                : 'bg-[#E5EEFF] text-[#0B1C30]'
            }`}
          >
            {isStudent ? '🎓 Mahasiswa' : '🏪 Merchant (UMKM)'} (Ganti)
          </button>
        </div>

        {/* Header Title */}
        <h3 className="text-xl font-bold text-[#0B1C30] mb-1">
          {mode === 'signin' ? 'Masuk ke Akun' : 'Daftar Akun Baru'}
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 mb-5">
          {mode === 'signin'
            ? `Masuk sebagai ${isStudent ? 'Mahasiswa' : 'Pemilik Usaha'}`
            : `Daftar sebagai ${isStudent ? 'Mahasiswa pencari kerja' : 'Mitra UMKM'}`}
        </p>

        {/* Tabs Masuk / Daftar */}
        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setErrorMsg(null)
              setSuccessMsg(null)
            }}
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-white text-[#0B1C30] shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setErrorMsg(null)
              setSuccessMsg(null)
            }}
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-white text-[#0B1C30] shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Daftar Akun
          </button>
        </div>

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
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder={isStudent ? 'Contoh: Bagas Pratama' : 'Contoh: Toko Kopi Senja'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-sm text-[#0B1C30]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-sm text-[#0B1C30]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-sm text-[#0B1C30]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label="Lihat kata sandi"
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
            className={`mt-2 w-full h-12 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed ${
              isStudent
                ? 'bg-[#FF6B00] hover:bg-[#E05E00] shadow-[#FF6B00]/25'
                : 'bg-[#0B1C30] hover:bg-[#152843] shadow-gray-900/20'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : mode === 'signin' ? (
              `Masuk Sebagai ${isStudent ? 'Mahasiswa' : 'Merchant'}`
            ) : (
              `Daftar Sebagai ${isStudent ? 'Mahasiswa' : 'Merchant'}`
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
