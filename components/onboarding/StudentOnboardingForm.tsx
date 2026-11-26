'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  GraduationCap,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TagInput } from './TagInput'
import { ImageUploadField } from './ImageUploadField'

interface StudentOnboardingFormProps {
  userId: string
  initialFullName?: string
  initialPhone?: string
  onSuccess?: () => void
}

export function StudentOnboardingForm({
  initialFullName = '',
  initialPhone = '',
  onSuccess,
}: StudentOnboardingFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Form states
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [nim, setNim] = useState('')
  const [university, setUniversity] = useState('Universitas Negeri Semarang')
  const [skills, setSkills] = useState<string[]>([])
  const [ktmFile, setKtmFile] = useState<File | null>(null)

  // Validation & UI states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Nama Lengkap
    if (!fullName.trim()) {
      newErrors.fullName = 'Nama lengkap wajib diisi.'
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Nama lengkap minimal 2 karakter.'
    }

    // Nomor HP
    const cleanPhone = phone.trim().replace(/[-\s]/g, '')
    if (!cleanPhone) {
      newErrors.phone = 'Nomor WhatsApp / HP wajib diisi.'
    } else if (!/^[0-9+]{9,15}$/.test(cleanPhone)) {
      newErrors.phone = 'Nomor HP tidak valid (hanya angka, 9-15 digit).'
    }

    // NIM (wajib, hanya angka)
    if (!nim.trim()) {
      newErrors.nim = 'NIM wajib diisi.'
    } else if (!/^\d+$/.test(nim.trim())) {
      newErrors.nim = 'NIM harus berupa angka saja tanpa spasi atau huruf.'
    }

    // Kampus
    if (!university.trim()) {
      newErrors.university = 'Nama kampus wajib diisi.'
    }

    // Skill
    if (skills.length === 0) {
      newErrors.skills = 'Pilih atau ketik minimal 1 skill yang kamu miliki.'
    }

    // Foto KTM (wajib)
    if (!ktmFile) {
      newErrors.ktm = 'Foto KTM (Kartu Tanda Mahasiswa) wajib diunggah.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setServerError(null)

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      // Dapatkan user aktif langsung dari sesi Supabase Auth
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (userError) {
          console.error('Error saat mengambil sesi user:', {
            message: userError.message,
            name: userError.name,
          })
        }
        throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.')
      }

      // 1. Upload foto KTM ke Supabase Storage (bucket "ktm")
      // Path: <user_id>/ktm.<ext>
      const fileExt = ktmFile!.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user.id}/ktm.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('ktm')
        .upload(filePath, ktmFile!, {
          upsert: true,
          contentType: ktmFile!.type,
        })

      if (uploadError) {
        console.error('Error upload foto KTM ke Storage:', {
          message: uploadError.message,
          name: uploadError.name,
        })
        throw new Error(
          `Gagal mengunggah foto KTM: ${uploadError.message}. Silakan coba lagi.`
        )
      }

      // 2. Simpan nama lengkap dan nomor HP ke profiles
      // Role authenticated HANYA punya izin UPDATE pada kolom full_name dan phone
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
        })
        .eq('id', user.id)

      if (profileError) {
        console.error('Error update profiles:', {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        })
        throw new Error(`Gagal memperbarui profil: ${profileError.message}`)
      }

      // 3. Simpan baris detail ke student_profiles
      // Menggunakan upsert dengan kolom: id, nim, university, skills, ktm_url saja
      const { error: studentProfileError } = await supabase
        .from('student_profiles')
        .upsert({
          id: user.id,
          nim: nim.trim(),
          university: university.trim(),
          skills: skills,
          ktm_url: filePath,
        })

      if (studentProfileError) {
        console.error('Error upsert student_profiles:', {
          message: studentProfileError.message,
          details: studentProfileError.details,
          hint: studentProfileError.hint,
          code: studentProfileError.code,
        })
        throw new Error(
          `Gagal menyimpan profil mahasiswa: ${studentProfileError.message}`
        )
      }

      // Berhasil
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/student')
        router.refresh()
      }
    } catch (err: unknown) {
      console.error('Terjadi kegagalan saat submit form onboarding mahasiswa:', err)
      const message =
        err instanceof Error ? err.message : 'Terjadi kesalahan sistem yang tidak terduga.'
      setServerError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      {/* Alert Error */}
      {serverError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Card 1: Data Diri Mahasiswa */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
        <h3 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
          <User className="w-4 h-4 text-[#FF6B00]" />
          <span>Informasi Mahasiswa</span>
        </h3>

        {/* Nama Lengkap */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Nama Lengkap <span className="text-[#FF6B00]">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Bagas Pratama"
              disabled={submitting}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
                errors.fullName
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                  : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
              }`}
            />
          </div>
          {errors.fullName && (
            <p className="text-[11px] text-red-500 font-medium">{errors.fullName}</p>
          )}
        </div>

        {/* Nomor WhatsApp / HP */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Nomor WhatsApp / HP <span className="text-[#FF6B00]">*</span>
          </label>
          <div className="relative">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              disabled={submitting}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
                errors.phone
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                  : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
              }`}
            />
          </div>
          <span className="text-[10px] text-gray-500">
            Digunakan oleh merchant untuk konfirmasi tugas gig.
          </span>
          {errors.phone && (
            <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>
          )}
        </div>
      </div>

      {/* Card 2: Kampus & Akademik */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
        <h3 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
          <GraduationCap className="w-4 h-4 text-[#FF6B00]" />
          <span>Data Kampus & Keahlian</span>
        </h3>

        {/* NIM (Wajib, hanya angka) */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#0B1C30]">
              Nomor Induk Mahasiswa (NIM) <span className="text-[#FF6B00]">*</span>
            </label>
            <span className="text-[10px] text-gray-500 font-medium shrink-0">Hanya angka</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={nim}
            onChange={(e) => {
              // Hanya perbolehkan karakter angka
              const val = e.target.value.replace(/[^\d]/g, '')
              setNim(val)
            }}
            placeholder="Contoh: 5311420001"
            disabled={submitting}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
              errors.nim
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
            }`}
          />
          {errors.nim && (
            <p className="text-[11px] text-red-500 font-medium">{errors.nim}</p>
          )}
        </div>

        {/* Kampus (Default UNNES, boleh diubah) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Asal Kampus / Universitas <span className="text-[#FF6B00]">*</span>
          </label>
          <input
            type="text"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="Nama Universitas Anda"
            disabled={submitting}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
              errors.university
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
            }`}
          />
          {errors.university && (
            <p className="text-[11px] text-red-500 font-medium">
              {errors.university}
            </p>
          )}
        </div>

        {/* Skill (Tag Input & Pilihan Cepat) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Skill / Keahlian Kamu <span className="text-[#FF6B00]">*</span>
          </label>
          <TagInput
            tags={skills}
            onChange={setSkills}
            suggestions={['F&B', 'Kasir', 'Packing', 'Event', 'Admin', 'Desain']}
            placeholder="Ketik skill (cth: Barista)..."
            disabled={submitting}
            error={errors.skills}
          />
        </div>
      </div>

      {/* Card 3: Upload KTM */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
        <ImageUploadField
          label="Foto Kartu Tanda Mahasiswa (KTM)"
          description="Foto KTM diperlukan untuk memastikan status aktif mahasiswa dan menjaga kepercayaan UMKM mitra."
          required
          file={ktmFile}
          onFileChange={setKtmFile}
          disabled={submitting}
          error={errors.ktm}
          maxSizeBytes={2 * 1024 * 1024}
        />
      </div>

      {/* Tombol Simpan & Selesai */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05E00] text-white text-sm font-bold shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Menyimpan & Mengunggah...</span>
          </>
        ) : (
          <>
            <span>Selesaikan & Masuk ke Beranda</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-gray-500 pb-4">
        Data kamu aman dan hanya digunakan untuk verifikasi identitas resmi Labor2Go.
      </p>
    </form>
  )
}
