'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Send,
  Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageUploadField } from '@/components/onboarding/ImageUploadField'
import type { VerificationStatus } from '@/lib/verification'
import {
  AccountSubpageHeader,
  logSupabaseError,
} from '@/components/account/AccountShared'

const BUSINESS_TYPES = ['F&B', 'Retail', 'Event', 'Jasa', 'Lainnya'] as const

interface MerchantVerificationViewProps {
  userId: string
  initialStatus: VerificationStatus
  initialNote: string | null
  initialBusinessName: string
  initialBusinessType: string
  initialAddress: string
  initialPhotoUrl: string | null
}

export function MerchantVerificationView({
  userId,
  initialStatus,
  initialNote,
  initialBusinessName,
  initialBusinessType,
  initialAddress,
  initialPhotoUrl,
}: MerchantVerificationViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<VerificationStatus>(initialStatus)
  const [note, setNote] = useState<string | null>(initialNote)

  const [businessName, setBusinessName] = useState(initialBusinessName)
  const [businessType, setBusinessType] = useState(initialBusinessType || 'F&B')
  const [address, setAddress] = useState(initialAddress)
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl)

  const [savedSnapshot, setSavedSnapshot] = useState({
    businessName: initialBusinessName,
    businessType: initialBusinessType || 'F&B',
    address: initialAddress,
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)

  const validateFixForm = (requirePhoto: boolean): boolean => {
    const newErrors: Record<string, string> = {}

    if (!businessName.trim()) {
      newErrors.businessName = 'Nama usaha wajib diisi.'
    } else if (businessName.trim().length < 2) {
      newErrors.businessName = 'Nama usaha minimal 2 karakter.'
    }

    if (!businessType.trim()) {
      newErrors.businessType = 'Pilih jenis usaha Anda.'
    }

    if (requirePhoto && !photoUrl && !photoFile) {
      newErrors.photo =
        'Foto tempat usaha wajib diunggah sebelum mengajukan verifikasi ulang.'
    }

    if (photoFile) {
      if (!photoFile.type.startsWith('image/')) {
        newErrors.photo =
          'File foto usaha harus berupa gambar (JPG, PNG, atau WEBP).'
      } else if (photoFile.size > 2 * 1024 * 1024) {
        newErrors.photo = 'Ukuran foto usaha maksimal 2 MB.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const persistCorrectionData = async (): Promise<boolean> => {
    let uploadedPhotoUrl: string | null = null

    if (photoFile) {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${userId}/usaha.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('business-photos')
        .upload(filePath, photoFile, {
          upsert: true,
          contentType: photoFile.type,
        })

      if (uploadError) {
        logSupabaseError('MerchantVerificationView.uploadPhoto', uploadError)
        setServerError(`Gagal mengunggah foto usaha: ${uploadError.message}`)
        return false
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-photos').getPublicUrl(filePath)
      uploadedPhotoUrl = `${publicUrl}?v=${Date.now()}`
    }

    const updatePayload: {
      business_name: string
      business_type: string
      address: string | null
      photo_url?: string
    } = {
      business_name: businessName.trim(),
      business_type: businessType,
      address: address.trim() || null,
    }
    if (uploadedPhotoUrl) {
      updatePayload.photo_url = uploadedPhotoUrl
    }

    const { error: updateError } = await supabase
      .from('umkm_profiles')
      .update(updatePayload)
      .eq('id', userId)

    if (updateError) {
      logSupabaseError('MerchantVerificationView.updateUmkm', updateError)
      setServerError(updateError.message)
      return false
    }

    setSavedSnapshot({
      businessName: businessName.trim(),
      businessType,
      address: address.trim(),
    })
    if (uploadedPhotoUrl) {
      setPhotoUrl(uploadedPhotoUrl)
      setPhotoFile(null)
    }
    return true
  }

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSuccessMessage(null)

    if (!validateFixForm(false)) return

    setSaving(true)
    try {
      const ok = await persistCorrectionData()
      if (ok) {
        setSuccessMessage(
          'Data usaha disimpan. Tekan "Ajukan Verifikasi Ulang" agar ditinjau admin.'
        )
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRequestReverification = async () => {
    setServerError(null)
    setSuccessMessage(null)

    if (!validateFixForm(true)) return

    const hasUnsavedChanges =
      businessName.trim() !== savedSnapshot.businessName ||
      businessType !== savedSnapshot.businessType ||
      address.trim() !== savedSnapshot.address ||
      photoFile !== null

    setResubmitting(true)
    try {
      if (hasUnsavedChanges) {
        const ok = await persistCorrectionData()
        if (!ok) return
      }

      const { error } = await supabase.rpc('request_reverification')
      if (error) {
        logSupabaseError('MerchantVerificationView.request_reverification', error)
        setServerError(error.message)
        return
      }

      setStatus('pending')
      setNote(null)
      setSuccessMessage(
        'Pengajuan verifikasi ulang berhasil dikirim dan sedang ditinjau admin.'
      )
      router.refresh()
    } catch (err: unknown) {
      logSupabaseError('MerchantVerificationView.reverificationCatch', err)
      setServerError(
        err instanceof Error ? err.message : 'Gagal mengajukan verifikasi ulang.'
      )
    } finally {
      setResubmitting(false)
    }
  }

  const busy = saving || resubmitting

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-28">
      <AccountSubpageHeader
        title="Keamanan & Verifikasi"
        subtitle="Status verifikasi usaha mitra UMKM"
        backHref="/merchant/account"
      />

      <div className="px-4 pt-4 flex flex-col gap-4">
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

        {/* Kartu Status Verifikasi */}
        {status === 'approved' && (
          <section className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-emerald-950">
                Akun terverifikasi
              </h2>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                Usaha dan foto tokomu telah diverifikasi admin. Data pemilik, nama usaha, dan foto usaha dikunci untuk menjaga kepercayaan pekerja mahasiswa.
              </p>
            </div>
          </section>
        )}

        {status === 'pending' && (
          <section className="p-4 rounded-3xl bg-amber-50 border border-amber-200 shadow-xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-amber-950">
                Sedang ditinjau admin
              </h2>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Data usaha dan foto tempat usahamu sedang dalam proses peninjauan oleh admin Labor2Go.
              </p>
            </div>
          </section>
        )}

        {status === 'rejected' && (
          <section className="p-4 rounded-3xl bg-red-50 border border-red-200 shadow-xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-red-950">
                Verifikasi Ditolak
              </h2>
              <p className="text-xs text-red-800 mt-1 leading-relaxed">
                Alasan: {note?.trim() || 'Data usaha belum sesuai ketentuan verifikasi.'}
              </p>
              <p className="text-[11px] text-red-700 mt-1.5">
                Silakan perbaiki data usaha atau unggah ulang foto usaha di bawah ini, lalu ajukan verifikasi ulang.
              </p>
            </div>
          </section>
        )}

        {/* Ringkasan Data Usaha */}
        <section className="bg-white rounded-3xl p-4 shadow-xs border border-gray-100 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />
            <span>Ringkasan Data Usaha</span>
          </h3>

          {photoUrl && (
            <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
              <Image
                src={photoUrl}
                alt={savedSnapshot.businessName || 'Foto Usaha'}
                fill
                className="object-cover"
                sizes="380px"
                unoptimized
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-gray-500">Nama Usaha</span>
              <span className="font-semibold text-[#0B1C30] text-right">
                {savedSnapshot.businessName || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-gray-50">
              <span className="text-gray-500">Kategori</span>
              <span className="font-semibold text-[#0B1C30]">
                {savedSnapshot.businessType || '-'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 py-1 border-t border-gray-50">
              <span className="text-gray-500 shrink-0">Alamat</span>
              <span className="font-semibold text-[#0B1C30] text-right">
                {savedSnapshot.address || '-'}
              </span>
            </div>
          </div>
        </section>

        {/* Formulir Perbaikan jika status rejected */}
        {status === 'rejected' && (
          <form
            onSubmit={handleSaveCorrection}
            className="bg-white rounded-3xl p-4 shadow-xs border border-gray-100 flex flex-col gap-4"
          >
            <h3 className="text-sm font-bold text-[#0B1C30] border-b border-gray-100 pb-2.5">
              Perbaikan Data Usaha
            </h3>

            {/* Nama Usaha */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#0B1C30]">
                Nama Usaha / Warung / Toko <span className="text-[#FF6B00]">*</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                disabled={busy}
                placeholder="Contoh: Geprek Sarjana UNNES"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
                  errors.businessName
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
                }`}
              />
              {errors.businessName && (
                <p className="text-[11px] text-red-500 font-medium">
                  {errors.businessName}
                </p>
              )}
            </div>

            {/* Kategori / Jenis Usaha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#0B1C30]">
                Kategori / Jenis Usaha <span className="text-[#FF6B00]">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BUSINESS_TYPES.map((type) => {
                  const isSelected = businessType === type
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setBusinessType(type)}
                      disabled={busy}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF6B00] border-[#FF6B00] text-white shadow-xs'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-[#FF6B00]/60'
                      }`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
              {errors.businessType && (
                <p className="text-[11px] text-red-500 font-medium">
                  {errors.businessType}
                </p>
              )}
            </div>

            {/* Alamat */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#0B1C30]">
                Alamat Tempat Usaha
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={busy}
                placeholder="Contoh: Jl. Taman Siswa No. 12, Sekaran, Gunungpati"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-hidden transition-colors resize-none"
              />
            </div>

            {/* Upload Foto Usaha Baru */}
            <ImageUploadField
              label="Unggah Foto Usaha Baru"
              description={
                photoUrl
                  ? 'Pilih foto baru jika ingin mengganti foto tempat usaha sebelumnya (maks. 2 MB).'
                  : 'Unggah foto tampak depan usaha atau area kerja (maks. 2 MB).'
              }
              required={!photoUrl}
              file={photoFile}
              onFileChange={setPhotoFile}
              disabled={busy}
              error={errors.photo}
              maxSizeBytes={2 * 1024 * 1024}
              accept="image/jpeg,image/png,image/webp"
            />

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-full border border-[#FF6B00] bg-white hover:bg-[#FFEDE0]/50 text-[#FF6B00] text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Data...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Data Perbaikan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRequestReverification}
                disabled={busy}
                className="w-full h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white text-sm font-bold shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {resubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengajukan Verifikasi Ulang...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Ajukan Verifikasi Ulang</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
