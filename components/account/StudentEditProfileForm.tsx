'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  GraduationCap,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatarFile } from '@/lib/avatar'
import {
  formatValidationConstraintError,
  normalizeSpaces,
  validateIndonesianPhone,
  validateNim,
  validatePersonName,
  validateSkillsList,
  validateUniversity,
} from '@/lib/validation'
import { TagInput } from '@/components/onboarding/TagInput'
import { AvatarUploadField } from '@/components/account/AvatarUploadField'
import {
  AccountSubpageHeader,
  LockedFieldNotice,
  getInitials,
  logSupabaseError,
} from '@/components/account/AccountShared'

interface StudentEditProfileFormProps {
  userId: string
  verified: boolean
  initialFullName: string
  initialAvatarUrl: string | null
  initialPhone: string
  initialUniversity: string
  initialNim: string
  initialSkills: string[]
}

export function StudentEditProfileForm({
  userId,
  verified,
  initialFullName,
  initialAvatarUrl,
  initialPhone,
  initialUniversity,
  initialNim,
  initialSkills,
}: StudentEditProfileFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState(initialFullName)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(
    initialAvatarUrl
  )
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [phone, setPhone] = useState(initialPhone)
  const [university, setUniversity] = useState(initialUniversity)
  const [nim, setNim] = useState(initialNim)
  const [skills, setSkills] = useState<string[]>(initialSkills)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!verified) {
      const fullNameError = validatePersonName(fullName, 'Nama lengkap')
      if (fullNameError) newErrors.fullName = fullNameError

      const nimError = validateNim(nim)
      if (nimError) newErrors.nim = nimError

      const universityError = validateUniversity(university)
      if (universityError) newErrors.university = universityError
    }

    const { error: phoneError } = validateIndonesianPhone(phone)
    if (phoneError) newErrors.phone = phoneError

    const skillsError = validateSkillsList(skills)
    if (skillsError) newErrors.skills = skillsError

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSuccessMessage(null)

    if (!validate()) return

    setSubmitting(true)
    try {
      let nextAvatarUrl: string | null | undefined = undefined
      if (newAvatarFile) {
        nextAvatarUrl = await uploadAvatarFile(supabase, userId, newAvatarFile)
      } else if (removeAvatar) {
        nextAvatarUrl = null
      }

      const { clean: cleanPhone } = validateIndonesianPhone(phone)

      // profiles hanya boleh di-update pada full_name, phone, dan avatar_url.
      // Jika verified = true, full_name terkunci dan TIDAK dikirim.
      const profilePayload: {
        phone: string
        full_name?: string
        avatar_url?: string | null
      } = {
        phone: cleanPhone,
      }
      if (!verified) {
        profilePayload.full_name = normalizeSpaces(fullName)
      }
      if (nextAvatarUrl !== undefined) {
        profilePayload.avatar_url = nextAvatarUrl
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', userId)

      if (profileError) {
        logSupabaseError('StudentEditProfileForm.profiles', profileError)
        setServerError(
          formatValidationConstraintError(
            profileError,
            profileError.message
          )
        )
        return
      }

      // Jika verified = true, nim dan university terkunci dan TIDAK dikirim.
      const cleanSkills = skills.map((s) => normalizeSpaces(s))
      const studentPayload = verified
        ? { skills: cleanSkills }
        : {
            nim: nim.trim(),
            university: normalizeSpaces(university),
            skills: cleanSkills,
          }

      const { error: studentError } = await supabase
        .from('student_profiles')
        .update(studentPayload)
        .eq('id', userId)

      if (studentError) {
        logSupabaseError('StudentEditProfileForm.student_profiles', studentError)
        setServerError(
          formatValidationConstraintError(
            studentError,
            studentError.message
          )
        )
        return
      }

      if (nextAvatarUrl !== undefined) {
        setCurrentAvatarUrl(nextAvatarUrl)
        setNewAvatarFile(null)
        setRemoveAvatar(false)
      }
      setPhone(cleanPhone)
      setSkills(cleanSkills)

      setSuccessMessage('Profil berhasil diperbarui.')
      router.refresh()
    } catch (err: unknown) {
      logSupabaseError('StudentEditProfileForm.catch', err)
      setServerError(
        err instanceof Error ? err.message : 'Gagal memperbarui profil.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF]">
      <AccountSubpageHeader
        title="Edit Profil Pribadi"
        subtitle="Perbarui data diri, kontak, dan keahlian"
        backHref="/student/account"
      />

      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-8 flex flex-col gap-4">
        {serverError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Card 0: Foto Profil */}
        <div className="bg-white p-4 rounded-3xl shadow-xs border border-gray-100">
          <AvatarUploadField
            label="Foto Profil"
            helperText="Foto profil akan ditampilkan di beranda dan saat melamar pekerjaan. Bisa diubah kapan saja."
            currentUrl={currentAvatarUrl}
            pendingFile={newAvatarFile}
            markedForRemoval={removeAvatar}
            initials={getInitials(fullName, 'M')}
            onFileSelect={(file) => {
              setNewAvatarFile(file)
              if (file) setRemoveAvatar(false)
            }}
            onRemove={() => {
              setNewAvatarFile(null)
              setRemoveAvatar(true)
            }}
            disabled={submitting}
          />
        </div>

        {/* Card 1: Informasi Mahasiswa */}
        <div className="bg-white p-4 rounded-3xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
          <h2 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <User className="w-4 h-4 text-[#FF6B00]" />
            <span>Informasi Mahasiswa</span>
          </h2>

          {/* Nama Lengkap */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C30] flex items-center justify-between">
              <span>
                Nama Lengkap <span className="text-[#FF6B00]">*</span>
              </span>
              {verified && <Lock className="w-3.5 h-3.5 text-gray-400" />}
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={60}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                readOnly={verified}
                disabled={submitting || verified}
                placeholder="Contoh: Bagas Pratama"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-hidden transition-colors ${
                  verified
                    ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed pr-9'
                    : errors.fullName
                      ? 'bg-white border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                      : 'bg-white border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
                }`}
              />
              {verified && (
                <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
            {verified && <LockedFieldNotice />}
            {errors.fullName && (
              <p className="text-[11px] text-red-500 font-medium">{errors.fullName}</p>
            )}
          </div>

          {/* Nomor WhatsApp / HP */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C30]">
              Nomor WhatsApp / HP <span className="text-[#FF6B00]">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              placeholder="Contoh: 081234567890"
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
                errors.phone
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                  : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
              }`}
            />
            <span className="text-[10px] text-gray-500">
              Digunakan oleh merchant untuk konfirmasi tugas gig.
            </span>
            {errors.phone && (
              <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Card 2: Kampus & Keahlian */}
        <div className="bg-white p-4 rounded-3xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
          <h2 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <GraduationCap className="w-4 h-4 text-[#FF6B00]" />
            <span>Data Kampus &amp; Keahlian</span>
          </h2>

          {/* NIM */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0B1C30]">
                Nomor Induk Mahasiswa (NIM) <span className="text-[#FF6B00]">*</span>
              </label>
              {verified ? (
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <span className="text-[10px] text-gray-500 font-medium">Hanya angka</span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                maxLength={20}
                value={nim}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, '')
                  setNim(val)
                }}
                readOnly={verified}
                disabled={submitting || verified}
                placeholder="Contoh: 5311420001"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-hidden transition-colors ${
                  verified
                    ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed pr-9'
                    : errors.nim
                      ? 'bg-white border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                      : 'bg-white border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
                }`}
              />
              {verified && (
                <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
            {verified && <LockedFieldNotice />}
            {errors.nim && (
              <p className="text-[11px] text-red-500 font-medium">{errors.nim}</p>
            )}
          </div>

          {/* Kampus */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C30] flex items-center justify-between">
              <span>
                Asal Kampus / Universitas <span className="text-[#FF6B00]">*</span>
              </span>
              {verified && <Lock className="w-3.5 h-3.5 text-gray-400" />}
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={80}
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                readOnly={verified}
                disabled={submitting || verified}
                placeholder="Nama Universitas Anda"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-hidden transition-colors ${
                  verified
                    ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed pr-9'
                    : errors.university
                      ? 'bg-white border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                      : 'bg-white border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
                }`}
              />
              {verified && (
                <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
            {verified && <LockedFieldNotice />}
            {errors.university && (
              <p className="text-[11px] text-red-500 font-medium">{errors.university}</p>
            )}
          </div>

          {/* Skill */}
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

        {/* Tombol Simpan */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white text-sm font-bold shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menyimpan Perubahan...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
