'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  User,
  Store,
  MapPin,
  Navigation,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageUploadField } from '@/components/onboarding/ImageUploadField'
import {
  AccountSubpageHeader,
  LockedFieldNotice,
  logSupabaseError,
} from '@/components/account/AccountShared'

const BUSINESS_TYPES = ['F&B', 'Retail', 'Event', 'Jasa', 'Lainnya'] as const

interface MerchantEditProfileFormProps {
  userId: string
  verified: boolean
  initialFullName: string
  initialPhone: string
  initialBusinessName: string
  initialBusinessType: string
  initialAddress: string
  initialLat: number | null
  initialLng: number | null
  initialPhotoUrl: string | null
}

export function MerchantEditProfileForm({
  userId,
  verified,
  initialFullName,
  initialPhone,
  initialBusinessName,
  initialBusinessType,
  initialAddress,
  initialLat,
  initialLng,
  initialPhotoUrl,
}: MerchantEditProfileFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [businessName, setBusinessName] = useState(initialBusinessName)
  const [businessType, setBusinessType] = useState(
    initialBusinessType || 'F&B'
  )
  const [address, setAddress] = useState(initialAddress)
  const [lat, setLat] = useState<number | null>(initialLat)
  const [lng, setLng] = useState<number | null>(initialLng)
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(
    initialPhotoUrl
  )
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)

  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

    if (!verified) {
      if (!fullName.trim()) {
        newErrors.fullName = 'Nama lengkap pemilik wajib diisi.'
      } else if (fullName.trim().length < 2) {
        newErrors.fullName = 'Nama minimal 2 karakter.'
      }

      if (!businessName.trim()) {
        newErrors.businessName = 'Nama usaha wajib diisi.'
      } else if (businessName.trim().length < 2) {
        newErrors.businessName = 'Nama usaha minimal 2 karakter.'
      }
    }

    const cleanPhone = phone.trim().replace(/[-\s]/g, '')
    if (!cleanPhone) {
      newErrors.phone = 'Nomor WhatsApp / HP usaha wajib diisi.'
    } else if (!/^[0-9+]{9,15}$/.test(cleanPhone)) {
      newErrors.phone = 'Nomor HP tidak valid (hanya angka, 9-15 digit).'
    }

    if (!businessType.trim()) {
      newErrors.businessType = 'Pilih jenis usaha Anda.'
    }

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
      // Trigger database mengunci full_name saat verified = true
      const profilePayload = verified
        ? { phone: phone.trim() }
        : { full_name: fullName.trim(), phone: phone.trim() }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', userId)

      if (profileError) {
        logSupabaseError('MerchantEditProfileForm.profiles', profileError)
        setServerError(profileError.message)
        return
      }

      let uploadedPhotoUrl: string | null = null
      if (!verified && newPhotoFile) {
        const ext = newPhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filePath = `${userId}/usaha.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('business-photos')
          .upload(filePath, newPhotoFile, {
            upsert: true,
            contentType: newPhotoFile.type,
          })

        if (uploadError) {
          logSupabaseError('MerchantEditProfileForm.uploadPhoto', uploadError)
          setServerError(`Gagal mengunggah foto usaha: ${uploadError.message}`)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('business-photos').getPublicUrl(filePath)
        uploadedPhotoUrl = `${publicUrl}?v=${Date.now()}`
      }

      // Jika verified = true, business_name dan photo_url terkunci dan TIDAK dikirim.
      const umkmPayload: {
        business_type: string
        address: string | null
        lat: number | null
        lng: number | null
        business_name?: string
        photo_url?: string
      } = {
        business_type: businessType,
        address: address.trim() || null,
        lat: lat !== null ? Number(lat) : null,
        lng: lng !== null ? Number(lng) : null,
      }

      if (!verified) {
        umkmPayload.business_name = businessName.trim()
        if (uploadedPhotoUrl) {
          umkmPayload.photo_url = uploadedPhotoUrl
        }
      }

      const { error: umkmError } = await supabase
        .from('umkm_profiles')
        .update(umkmPayload)
        .eq('id', userId)

      if (umkmError) {
        logSupabaseError('MerchantEditProfileForm.umkm_profiles', umkmError)
        setServerError(umkmError.message)
        return
      }

      if (uploadedPhotoUrl) {
        setCurrentPhotoUrl(uploadedPhotoUrl)
        setNewPhotoFile(null)
      }

      setSuccessMessage('Profil toko berhasil diperbarui.')
      router.refresh()
    } catch (err: unknown) {
      logSupabaseError('MerchantEditProfileForm.catch', err)
      setServerError(
        err instanceof Error ? err.message : 'Gagal memperbarui profil toko.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF] pb-28">
      <AccountSubpageHeader
        title="Edit Profil Toko"
        subtitle="Perbarui informasi pemilik, usaha, dan lokasi"
        backHref="/merchant/account"
      />

      <form onSubmit={handleSubmit} className="px-4 pt-4 flex flex-col gap-4">
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

        {/* Card 1: Informasi Pemilik Usaha */}
        <div className="bg-white p-4 rounded-3xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
          <h2 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <User className="w-4 h-4 text-[#FF6B00]" />
            <span>Informasi Pemilik Usaha</span>
          </h2>

          {/* Nama Pemilik */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C30] flex items-center justify-between">
              <span>
                Nama Lengkap Pemilik <span className="text-[#FF6B00]">*</span>
              </span>
              {verified && <Lock className="w-3.5 h-3.5 text-gray-400" />}
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                readOnly={verified}
                disabled={submitting || verified}
                placeholder="Contoh: Pak Agus Subagio"
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

          {/* No HP */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C30]">
              Nomor WhatsApp / HP Usaha <span className="text-[#FF6B00]">*</span>
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
            {errors.phone && (
              <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Card 2: Detail Tempat Usaha */}
        <div className="bg-white p-4 rounded-3xl shadow-xs border border-gray-100 flex flex-col gap-3.5">
          <h2 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <Store className="w-4 h-4 text-[#FF6B00]" />
            <span>Profil Toko &amp; Lokasi</span>
          </h2>

          {/* Nama Usaha */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C30] flex items-center justify-between">
              <span>
                Nama Usaha / Warung / Toko <span className="text-[#FF6B00]">*</span>
              </span>
              {verified && <Lock className="w-3.5 h-3.5 text-gray-400" />}
            </label>
            <div className="relative">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                readOnly={verified}
                disabled={submitting || verified}
                placeholder="Contoh: Geprek Sarjana UNNES"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border outline-hidden transition-colors ${
                  verified
                    ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed pr-9'
                    : errors.businessName
                      ? 'bg-white border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                      : 'bg-white border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
                }`}
              />
              {verified && (
                <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
            {verified && <LockedFieldNotice />}
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
            <div className="grid grid-cols-3 gap-2">
              {BUSINESS_TYPES.map((type) => {
                const isSelected = businessType === type
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setBusinessType(type)}
                    disabled={submitting}
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
              disabled={submitting}
              placeholder="Contoh: Jl. Taman Siswa No. 12, Sekaran, Gunungpati"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-hidden transition-colors resize-none"
            />
          </div>

          {/* Gunakan lokasi saya */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[#0B1C30] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Koordinat Lokasi (Opsional)</span>
              </span>
              {lat !== null && lng !== null && (
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                  Terdeteksi
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleGetLocation}
              disabled={submitting || geoLoading}
              className="w-full py-2.5 px-3 rounded-xl border border-[#FF6B00]/40 bg-[#FFEDE0]/40 hover:bg-[#FFEDE0] text-[#FF6B00] text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-60 cursor-pointer"
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

            {lat !== null && lng !== null && (
              <div className="mt-2 p-2 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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

        {/* Card 3: Foto Usaha */}
        <div className="bg-white p-4 rounded-3xl shadow-xs border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0B1C30]">Foto Tempat Usaha</h2>
            {verified && <Lock className="w-4 h-4 text-gray-400" />}
          </div>

          {currentPhotoUrl && (
            <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
              <Image
                src={currentPhotoUrl}
                alt={businessName || 'Foto Usaha'}
                fill
                className="object-cover"
                sizes="380px"
                unoptimized
              />
            </div>
          )}

          {verified ? (
            <LockedFieldNotice />
          ) : (
            <ImageUploadField
              label={currentPhotoUrl ? 'Ganti Foto Usaha (Opsional)' : 'Unggah Foto Usaha'}
              description="Foto baru akan menggantikan foto usaha saat ini (maks. 2 MB)."
              file={newPhotoFile}
              onFileChange={setNewPhotoFile}
              disabled={submitting}
              maxSizeBytes={2 * 1024 * 1024}
              accept="image/jpeg,image/png,image/webp"
            />
          )}
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
