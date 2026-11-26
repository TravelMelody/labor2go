'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Store,
  User,
  MapPin,
  Navigation,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  formatValidationConstraintError,
  normalizeSpaces,
  validateAddress,
  validateBusinessName,
  validateIndonesianPhone,
  validatePersonName,
} from '@/lib/validation'
import { ImageUploadField } from './ImageUploadField'

interface MerchantOnboardingFormProps {
  userId: string
  initialFullName?: string
  initialPhone?: string
  onSuccess?: () => void
}

const BUSINESS_TYPES = ['F&B', 'Retail', 'Event', 'Jasa', 'Lainnya'] as const
type BusinessType = (typeof BUSINESS_TYPES)[number]

export function MerchantOnboardingForm({
  initialFullName = '',
  initialPhone = '',
  onSuccess,
}: MerchantOnboardingFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Form states
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('F&B')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [businessPhotoFile, setBusinessPhotoFile] = useState<File | null>(null)

  // Geolocation UI states
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Validation & UI states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Peramban Anda tidak mendukung fitur geolokasi.')
      return
    }

    setGeoLoading(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude)
        setLng(position.coords.longitude)
        setGeoLoading(false)
      },
      (error) => {
        setGeoLoading(false)
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError(
            'Izin lokasi ditolak. Silakan izinkan akses lokasi pada browser Anda.'
          )
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoError('Informasi lokasi tidak tersedia saat ini.')
        } else if (error.code === error.TIMEOUT) {
          setGeoError('Waktu permintaan lokasi habis. Coba lagi.')
        } else {
          setGeoError('Gagal mendeteksi lokasi.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    const fullNameError = validatePersonName(fullName, 'Nama lengkap pemilik')
    if (fullNameError) newErrors.fullName = fullNameError

    const { error: phoneError } = validateIndonesianPhone(phone)
    if (phoneError) newErrors.phone = phoneError

    const businessNameError = validateBusinessName(businessName)
    if (businessNameError) newErrors.businessName = businessNameError

    const addressError = validateAddress(address)
    if (addressError) newErrors.address = addressError

    // Jenis Usaha
    if (!businessType) {
      newErrors.businessType = 'Pilih jenis usaha Anda.'
    }

    // Foto Tempat Usaha (Wajib)
    if (!businessPhotoFile) {
      newErrors.photo = 'Foto tempat usaha wajib diunggah.'
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
          console.error('Error saat mengambil sesi user (merchant):', {
            message: userError.message,
            name: userError.name,
          })
        }
        throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.')
      }

      // 1. Upload foto usaha ke Supabase Storage (bucket "business-photos")
      // Path: <user_id>/usaha.<ext>
      const fileExt =
        businessPhotoFile!.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user.id}/usaha.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('business-photos')
        .upload(filePath, businessPhotoFile!, {
          upsert: true,
          contentType: businessPhotoFile!.type,
        })

      if (uploadError) {
        console.error('Error upload foto usaha ke Storage:', {
          message: uploadError.message,
          name: uploadError.name,
        })
        throw new Error(
          `Gagal mengunggah foto usaha: ${uploadError.message}. Silakan coba lagi.`
        )
      }

      // Ambil URL publik dari bucket "business-photos"
      const {
        data: { publicUrl },
      } = supabase.storage.from('business-photos').getPublicUrl(filePath)

      // 2. Simpan nama lengkap dan nomor HP ke profiles
      // Role authenticated HANYA punya izin UPDATE pada kolom full_name dan phone
      const { clean: cleanPhone } = validateIndonesianPhone(phone)
      const cleanAddress = normalizeSpaces(address)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: normalizeSpaces(fullName),
          phone: cleanPhone,
        })
        .eq('id', user.id)

      if (profileError) {
        console.error('Error update profiles (merchant):', {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        })
        throw new Error(
          formatValidationConstraintError(
            profileError,
            `Gagal memperbarui profil: ${profileError.message}`
          )
        )
      }

      // 3. Simpan baris detail ke umkm_profiles
      // URL publik disimpan ke umkm_profiles.photo_url
      const { error: umkmProfileError } = await supabase
        .from('umkm_profiles')
        .upsert({
          id: user.id,
          business_name: normalizeSpaces(businessName),
          business_type: businessType,
          address: cleanAddress || null,
          lat: lat !== null ? Number(lat) : null,
          lng: lng !== null ? Number(lng) : null,
          photo_url: publicUrl,
        })

      if (umkmProfileError) {
        console.error('Error upsert umkm_profiles:', {
          message: umkmProfileError.message,
          details: umkmProfileError.details,
          hint: umkmProfileError.hint,
          code: umkmProfileError.code,
        })
        throw new Error(
          formatValidationConstraintError(
            umkmProfileError,
            `Gagal menyimpan profil usaha: ${umkmProfileError.message}`
          )
        )
      }

      // Berhasil
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/merchant')
        router.refresh()
      }
    } catch (err: unknown) {
      console.error('Terjadi kegagalan saat submit form onboarding merchant:', err)
      const message =
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan sistem yang tidak terduga.'
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

      {/* Card 1: Informasi Kontak Pemilik */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
        <h3 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
          <User className="w-4 h-4 text-[#FF6B00]" />
          <span>Informasi Pemilik Usaha</span>
        </h3>

        {/* Nama Lengkap Pemilik */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Nama Lengkap Pemilik <span className="text-[#FF6B00]">*</span>
          </label>
          <input
            type="text"
            maxLength={60}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Contoh: Pak Agus Subagio"
            disabled={submitting}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
              errors.fullName
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
            }`}
          />
          {errors.fullName && (
            <p className="text-[11px] text-red-500 font-medium">
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Nomor WhatsApp / HP */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Nomor WhatsApp / HP Usaha <span className="text-[#FF6B00]">*</span>
          </label>
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
          <span className="text-[10px] text-gray-500">
            Nomor yang dapat dihubungi oleh pekerja mahasiswa saat hari kerja gig.
          </span>
          {errors.phone && (
            <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>
          )}
        </div>
      </div>

      {/* Card 2: Detail Tempat Usaha */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
        <h3 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
          <Store className="w-4 h-4 text-[#FF6B00]" />
          <span>Profil Toko & Usaha</span>
        </h3>

        {/* Nama Usaha (Wajib) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Nama Usaha / Warung / Toko <span className="text-[#FF6B00]">*</span>
          </label>
          <input
            type="text"
            maxLength={60}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Contoh: Geprek Sarjana UNNES"
            disabled={submitting}
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

        {/* Jenis Usaha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#0B1C30]">
            Kategori / Jenis Usaha <span className="text-[#FF6B00]">*</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {BUSINESS_TYPES.map((type) => {
              const isSelected = businessType === type
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() => setBusinessType(type)}
                  disabled={submitting}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
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

        {/* Alamat Usaha (Teks) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C30]">
            Alamat Tempat Usaha
          </label>
          <textarea
            rows={2}
            maxLength={200}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Contoh: Jl. Taman Siswa No. 12, Sekaran, Gunungpati (depan gerbang barat)"
            disabled={submitting}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors resize-none ${
              errors.address
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
            }`}
          />
          {errors.address && (
            <p className="text-[11px] text-red-500 font-medium">
              {errors.address}
            </p>
          )}
        </div>

        {/* Tombol Gunakan Lokasi Saya (navigator.geolocation) */}
        <div className="pt-1">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-[#0B1C30] flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              <span className="truncate">Koordinat Lokasi (Opsional)</span>
            </span>
            {lat !== null && lng !== null && (
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                Terdeteksi
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={submitting || geoLoading}
            className="w-full py-2.5 px-3 rounded-xl border border-[#FF6B00]/40 bg-[#FFEDE0]/40 hover:bg-[#FFEDE0] text-[#FF6B00] text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-60"
          >
            {geoLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mendeteksi Lokasi GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5" />
                <span>Gunakan lokasi saya</span>
              </>
            )}
          </button>

          {/* Coordinate badge if detected */}
          {lat !== null && lng !== null && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">
                  Titik GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLat(null)
                  setLng(null)
                }}
                className="text-xs text-red-500 hover:underline shrink-0 ml-2"
              >
                Hapus
              </button>
            </div>
          )}

          {geoError && (
            <p className="text-[11px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{geoError}</span>
            </p>
          )}
        </div>
      </div>

      {/* Card 3: Upload Foto Usaha */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
        <ImageUploadField
          label="Foto Tempat Usaha / Toko"
          description="Foto tampak depan toko atau area kerja membantu mahasiswa menemukan tempat usaha Anda dengan mudah."
          required
          file={businessPhotoFile}
          onFileChange={setBusinessPhotoFile}
          disabled={submitting}
          error={errors.photo}
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
            <span>Menyimpan Profil Usaha...</span>
          </>
        ) : (
          <>
            <span>Selesaikan & Masuk ke Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-gray-500 pb-4">
        Data profil usaha Anda akan diverifikasi oleh tim admin Labor2Go.
      </p>
    </form>
  )
}
