'use client'

import React, { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  Users,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Info,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  BookmarkCheck,
  Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  SERVICE_FEE_PER_WORKER,
  MIN_HOURLY_RATE,
  isAboveOrEqualUmr,
} from '@/lib/pricing'

const QUICK_TITLES = ['Cuci Loyang', 'Bantu Kasir', 'Packing'] as const
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface UmkmLocationData {
  business_name: string | null
  address: string | null
  lat: number | null
  lng: number | null
}

function MerchantPostSkeleton() {
  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col bg-[#F8F9FF] animate-pulse">
      <div className="h-14 px-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="w-40 h-5 rounded bg-gray-200" />
        <div className="w-9" />
      </div>
      <div className="px-4 pt-4 pb-28 flex flex-col gap-4">
        <div className="h-44 rounded-2xl bg-white border border-gray-100" />
        <div className="h-44 rounded-2xl bg-white border border-gray-100" />
        <div className="h-24 rounded-2xl bg-white border border-gray-100" />
        <div className="h-52 rounded-2xl bg-white border border-gray-100" />
      </div>
    </div>
  )
}

function MerchantPostJobContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateIdParam = searchParams.get('template')
  const supabase = createClient()

  // Auth & Profile state
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [umkmLocation, setUmkmLocation] = useState<UmkmLocationData | null>(null)
  const [serviceFee, setServiceFee] = useState<number>(SERVICE_FEE_PER_WORKER)
  const [appliedTemplateTitle, setAppliedTemplateTitle] = useState<string | null>(
    null
  )

  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Date & Time states (Asia/Jakarta, +07:00)
  const [startDateStr, setStartDateStr] = useState<string>('')
  const [startTimeStr, setStartTimeStr] = useState<string>('')
  const [todayDateStr, setTodayDateStr] = useState<string>('')
  const [durationHours, setDurationHours] = useState<number>(2)

  // Slots & Pay states
  const [slots, setSlots] = useState<number>(1)
  const [payAmountInput, setPayAmountInput] = useState<string>('50.000')
  const [payAmount, setPayAmount] = useState<number>(50000)

  // Template checkbox
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(false)

  // Validation & Submit states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const submittingRef = useRef<boolean>(false)

  // Proteksi Route & ambil data profil UMKM + template (jika ?template=<id>)
  useEffect(() => {
    async function checkAuthAndLoadProfile() {
      const now = new Date()
      const todayFormatted = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
      setTodayDateStr(todayFormatted)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.replace('/login?redirectTo=/merchant/post')
          return
        }

        // Cek role di profiles
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          console.error('Error membaca tabel profiles:', {
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            code: profileError.code,
          })
        }

        const role = profile?.role || user.user_metadata?.role
        if (role !== 'umkm') {
          router.replace('/student')
          return
        }

        // Cek kelengkapan onboarding di umkm_profiles & biaya layanan di platform_settings
        const [umkmRes, settingsRes] = await Promise.all([
          supabase
            .from('umkm_profiles')
            .select('business_name, address, lat, lng')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('platform_settings')
            .select('int_value')
            .eq('key', 'service_fee_per_worker')
            .maybeSingle(),
        ])

        if (umkmRes.error) {
          console.error('Error membaca tabel umkm_profiles:', {
            message: umkmRes.error.message,
            details: umkmRes.error.details,
            hint: umkmRes.error.hint,
            code: umkmRes.error.code,
          })
        }

        const umkmProfile = umkmRes.data
        if (!umkmProfile) {
          // Belum melengkapi onboarding
          router.replace('/onboarding')
          return
        }

        if (settingsRes.data?.int_value != null) {
          setServiceFee(Number(settingsRes.data.int_value))
        }

        setUserId(user.id)
        setUmkmLocation({
          business_name: umkmProfile.business_name || null,
          address: umkmProfile.address || null,
          lat: umkmProfile.lat ?? null,
          lng: umkmProfile.lng ?? null,
        })

        // Cek ?template=<id> (hanya milik user; jika tidak valid abaikan)
        let appliedTemplate = false
        if (templateIdParam && UUID_REGEX.test(templateIdParam)) {
          const { data: tpl, error: tplError } = await supabase
            .from('job_templates')
            .select('id, title, description, duration_hours, pay_amount, slots')
            .eq('id', templateIdParam)
            .eq('umkm_id', user.id)
            .maybeSingle()

          if (tplError) {
            console.warn('Gagal membaca template lowongan:', tplError.message)
          } else if (tpl) {
            appliedTemplate = true
            setAppliedTemplateTitle(tpl.title)
            setTitle(tpl.title)
            setDescription(tpl.description || '')

            const parsedDuration = Math.min(
              12,
              Math.max(1, Math.round(Number(tpl.duration_hours) || 2))
            )
            setDurationHours(parsedDuration)

            const parsedSlots = Math.min(
              10,
              Math.max(1, Math.round(Number(tpl.slots) || 1))
            )
            setSlots(parsedSlots)

            const parsedPay = Math.max(10000, Number(tpl.pay_amount) || 50000)
            setPayAmount(parsedPay)
            setPayAmountInput(parsedPay.toLocaleString('id-ID'))

            // Tanggal dan jam mulai tetap harus diisi oleh user
            setStartDateStr('')
            setStartTimeStr('')
          }
        }

        if (!appliedTemplate) {
          // Inisialisasi waktu default (1 jam dari sekarang di Asia/Jakarta)
          const target = new Date(now.getTime() + 60 * 60 * 1000)

          const dateFormatted = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(target)

          const timeFormatted = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(target)

          setStartDateStr(dateFormatted)
          setStartTimeStr(timeFormatted)
        }
      } catch (err: unknown) {
        console.error('Terjadi kesalahan saat memverifikasi akses merchant:', err)
        router.replace('/login')
      } finally {
        setLoadingProfile(false)
      }
    }

    checkAuthAndLoadProfile()
  }, [router, supabase, templateIdParam])

  // Hitung rentang jam live (WIB)
  const getTimeRangePreview = (): string => {
    if (!startDateStr || !startTimeStr) return ''
    try {
      const start = new Date(`${startDateStr}T${startTimeStr}:00+07:00`)
      if (isNaN(start.getTime())) return ''
      const end = new Date(start.getTime() + durationHours * 3600 * 1000)

      const startFormatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(start)

      const endFormatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(end)

      return `(${startFormatted} - ${endFormatted} WIB)`
    } catch {
      return ''
    }
  }

  // Format input upah
  const handlePayAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '')
    if (!rawVal) {
      setPayAmountInput('')
      setPayAmount(0)
      return
    }
    const num = parseInt(rawVal, 10)
    setPayAmount(num)
    setPayAmountInput(num.toLocaleString('id-ID'))
  }

  // Steppers
  const handleDurationMinus = () => {
    setDurationHours((prev) => Math.max(1, prev - 1))
  }

  const handleDurationPlus = () => {
    setDurationHours((prev) => Math.min(12, prev + 1))
  }

  const handleSlotsMinus = () => {
    setSlots((prev) => Math.max(1, prev - 1))
  }

  const handleSlotsPlus = () => {
    setSlots((prev) => Math.min(10, prev + 1))
  }

  // Perhitungan Estimasi Biaya
  const totalWage = payAmount * slots
  const totalServiceFee = serviceFee * slots
  const totalEstimasi = totalWage + totalServiceFee

  // Status kesesuaian UMR
  const meetsUmr = isAboveOrEqualUmr(payAmount, durationHours)

  // Validasi Form di Client
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 1. Jenis Bantuan / Judul
    if (!title.trim()) {
      newErrors.title = 'Jenis bantuan / judul lowongan wajib diisi.'
    } else if (title.trim().length < 3) {
      newErrors.title = 'Judul minimal 3 karakter.'
    }

    // 2. Waktu & Tanggal
    if (!startDateStr) {
      newErrors.startDate = 'Tanggal pelaksanaan wajib dipilih.'
    }
    if (!startTimeStr) {
      newErrors.startTime = 'Jam mulai pekerjaan wajib diisi.'
    }

    if (startDateStr && startTimeStr) {
      const startDateTime = new Date(`${startDateStr}T${startTimeStr}:00+07:00`)
      if (isNaN(startDateTime.getTime())) {
        newErrors.startTime = 'Format tanggal atau jam tidak valid.'
      } else {
        // Validasi: Mulai minimal 30 menit dari sekarang
        const minAllowedTime = Date.now() + 30 * 60 * 1000
        if (startDateTime.getTime() < minAllowedTime) {
          newErrors.startTime =
            'Waktu mulai pekerjaan minimal 30 menit dari sekarang.'
        }
      }
    }

    // 3. Durasi
    if (durationHours < 1 || durationHours > 12) {
      newErrors.durationHours = 'Durasi kerja harus antara 1 sampai 12 jam.'
    }

    // 4. Slots
    if (slots < 1 || slots > 10) {
      newErrors.slots = 'Jumlah mahasiswa harus antara 1 sampai 10 orang.'
    }

    // 5. Upah
    if (payAmount < 10000) {
      newErrors.payAmount = 'Upah per mahasiswa minimal Rp 10.000.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || submittingRef.current) return
    setServerError(null)

    if (!validate()) {
      return
    }

    if (!userId) {
      setServerError('Sesi Anda telah kedaluwarsa. Silakan muat ulang halaman.')
      return
    }

    submittingRef.current = true
    setSubmitting(true)

    try {
      const startDateTime = new Date(`${startDateStr}T${startTimeStr}:00+07:00`)
      const endDateTime = new Date(
        startDateTime.getTime() + durationHours * 3600 * 1000
      )

      // 1. Insert ke tabel jobs
      // Sesuai schema: umkm_id, title, description, location_name, lat, lng, start_at, end_at, pay_amount, slots, status
      const { error: jobError } = await supabase.from('jobs').insert({
        umkm_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        location_name:
          umkmLocation?.address || umkmLocation?.business_name || null,
        lat: umkmLocation?.lat ?? null,
        lng: umkmLocation?.lng ?? null,
        start_at: startDateTime.toISOString(),
        end_at: endDateTime.toISOString(),
        pay_amount: payAmount,
        slots: slots,
        status: 'open',
      })

      if (jobError) {
        console.error('Error insert jobs:', {
          message: jobError.message,
          details: jobError.details,
          hint: jobError.hint,
          code: jobError.code,
        })
        throw new Error(
          `Gagal mempublikasikan lowongan: ${jobError.message}`
        )
      }

      // 2. Simpan sebagai template jika dicentang
      // Sesuai schema: umkm_id, title, description, duration_hours, pay_amount, slots
      if (saveAsTemplate) {
        const { error: templateError } = await supabase
          .from('job_templates')
          .insert({
            umkm_id: userId,
            title: title.trim(),
            description: description.trim() || null,
            duration_hours: durationHours,
            pay_amount: payAmount,
            slots: slots,
          })

        if (templateError) {
          // Log error template tapi jangan membatalkan job yang sudah terbit
          console.error('Error insert job_templates:', {
            message: templateError.message,
            details: templateError.details,
            hint: templateError.hint,
            code: templateError.code,
          })
        }
      }

      // Redirect ke dashboard merchant dengan notifikasi sukses
      router.push('/merchant?posted=true')
    } catch (err: unknown) {
      console.error('Terjadi kegagalan saat submit lowongan baru:', err)
      const message =
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan sistem yang tidak terduga saat mempublikasikan lowongan.'
      setServerError(message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (loadingProfile) {
    return <MerchantPostSkeleton />
  }

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-screen flex flex-col bg-[#F8F9FF] text-[#0B1C30]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between">
          <Link
            href="/merchant"
            aria-label="Kembali ke Dashboard"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#0B1C30] hover:bg-gray-100 transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold text-[#0B1C30] tracking-tight">
            Pasang Lowongan Baru
          </h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Main Content Form */}
      <main className="flex-1 px-4 pt-4 pb-28 flex flex-col gap-4">
        {appliedTemplateTitle && (
          <div className="p-3.5 rounded-2xl bg-[#EFF4FF] border border-blue-200 text-[#0B1C30] text-xs flex items-start gap-2.5">
            <BookmarkCheck className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              Diisi dari template{' '}
              <span className="font-bold">&ldquo;{appliedTemplateTitle}&rdquo;</span>.
              Silakan pilih tanggal dan jam mulai lowongan.
            </div>
          </div>
        )}

        {serverError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Gagal Menyimpan: </span>
              {serverError}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* SECTION 1: JENIS BANTUAN */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[#0B1C30] flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#FF6B00]" />
                <span>Jenis Bantuan</span>
              </label>
              <span className="text-[11px] font-semibold text-[#FF6B00]">
                Bisa lebih dari 1 pos
              </span>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_TITLES.map((pill) => {
                const isSelected = title === pill
                return (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => {
                      setTitle(pill)
                      if (errors.title) {
                        setErrors((prev) => ({ ...prev, title: '' }))
                      }
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#0B1C30] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pill}
                  </button>
                )
              })}
            </div>

            {/* Free Text Input */}
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) {
                    setErrors((prev) => ({ ...prev, title: '' }))
                  }
                }}
                placeholder="Atau tulis jenis bantuan lainnya (misal: Angkut Barang)..."
                className={`w-full bg-[#F8F9FF] text-[#0B1C30] text-xs font-medium px-3.5 py-2.5 rounded-xl border transition-all placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 ${
                  errors.title
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-200 focus:border-[#FF6B00]'
                }`}
              />
              {errors.title && (
                <p className="text-[11px] text-red-600 mt-0.5">{errors.title}</p>
              )}
            </div>

            {/* Optional Description */}
            <div className="flex flex-col gap-1 pt-1">
              <label className="text-xs font-semibold text-gray-700">
                Deskripsi Pekerjaan <span className="font-normal text-gray-400">(Opsional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Jelaskan instruksi spesifik, pakaian kerja yang disarankan, atau catatan penting untuk pelamar..."
                className="w-full bg-[#F8F9FF] text-[#0B1C30] text-xs font-medium p-3 rounded-xl border border-gray-200 transition-all placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] resize-none"
              />
            </div>
          </div>

          {/* SECTION 2: WAKTU & DURASI */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[#0B1C30] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#FF6B00]" />
                <span>Jadwal & Durasi Kerja</span>
              </label>
              <span className="text-[11px] text-gray-500">Zona Waktu WIB</span>
            </div>

            {/* Tanggal & Jam Mulai */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>Tanggal</span>
                </label>
                <input
                  type="date"
                  value={startDateStr}
                  min={todayDateStr}
                  onChange={(e) => {
                    setStartDateStr(e.target.value)
                    if (errors.startDate || errors.startTime) {
                      setErrors((prev) => ({
                        ...prev,
                        startDate: '',
                        startTime: '',
                      }))
                    }
                  }}
                  className={`w-full min-w-0 bg-[#F8F9FF] text-[#0B1C30] text-xs font-medium px-2.5 py-2.5 rounded-xl border transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 ${
                    errors.startDate
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-200 focus:border-[#FF6B00]'
                  }`}
                />
                {errors.startDate && (
                  <p className="text-[10px] text-red-600 mt-0.5">
                    {errors.startDate}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Jam Mulai</span>
                </label>
                <input
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => {
                    setStartTimeStr(e.target.value)
                    if (errors.startTime) {
                      setErrors((prev) => ({ ...prev, startTime: '' }))
                    }
                  }}
                  className={`w-full min-w-0 bg-[#F8F9FF] text-[#0B1C30] text-xs font-medium px-2.5 py-2.5 rounded-xl border transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 ${
                    errors.startTime
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-200 focus:border-[#FF6B00]'
                  }`}
                />
              </div>
            </div>

            {errors.startTime && (
              <p className="text-[11px] text-red-600 -mt-1 font-medium">
                {errors.startTime}
              </p>
            )}

            {/* Stepper Durasi */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">
                  Durasi Kerja
                </span>
                <span className="text-[11px] font-medium text-gray-500">
                  Maksimal 12 jam
                </span>
              </div>

              <div className="flex items-center justify-between bg-[#F8F9FF] rounded-xl p-1.5 border border-gray-200">
                <button
                  type="button"
                  aria-label="Kurangi durasi"
                  disabled={durationHours <= 1}
                  onClick={handleDurationMinus}
                  className="w-10 h-10 rounded-lg bg-white text-[#0B1C30] flex items-center justify-center shadow-xs hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 text-center min-w-0 px-1">
                  <span className="text-lg font-bold text-[#0B1C30]">
                    {durationHours}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">
                    Jam
                  </span>
                  {getTimeRangePreview() && (
                    <span className="text-[11px] text-gray-500 font-medium">
                      {getTimeRangePreview()}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  aria-label="Tambah durasi"
                  disabled={durationHours >= 12}
                  onClick={handleDurationPlus}
                  className="w-10 h-10 rounded-lg bg-white text-[#0B1C30] flex items-center justify-center shadow-xs hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: JUMLAH MAHASISWA */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[#0B1C30] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#FF6B00]" />
                <span>Jumlah Mahasiswa Dibutuhkan</span>
              </label>
              <span className="text-[11px] font-semibold text-gray-500">
                1 - 10 orang
              </span>
            </div>

            <div className="flex items-center justify-between bg-[#F8F9FF] rounded-xl p-1.5 border border-gray-200">
              <button
                type="button"
                aria-label="Kurangi mahasiswa"
                disabled={slots <= 1}
                onClick={handleSlotsMinus}
                className="w-10 h-10 rounded-lg bg-white text-[#0B1C30] flex items-center justify-center shadow-xs hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-[#0B1C30]">{slots}</span>
                <span className="text-xs font-semibold text-gray-600">
                  Mahasiswa
                </span>
              </div>

              <button
                type="button"
                aria-label="Tambah mahasiswa"
                disabled={slots >= 10}
                onClick={handleSlotsPlus}
                className="w-10 h-10 rounded-lg bg-white text-[#0B1C30] flex items-center justify-center shadow-xs hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SECTION 4: UPAH & BIAYA */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[#0B1C30]">
                  Upah per Mahasiswa
                </label>
                {meetsUmr && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sesuai UMR</span>
                  </span>
                )}
              </div>

              {/* Rupiah Input */}
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none">
                  <span className="text-base font-bold text-[#0B1C30]">Rp</span>
                </div>
                <input
                  type="text"
                  value={payAmountInput}
                  onChange={handlePayAmountChange}
                  placeholder="50.000"
                  className={`w-full bg-[#F8F9FF] text-[#0B1C30] font-bold text-base pl-11 pr-4 py-3 rounded-xl border transition-all placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 ${
                    errors.payAmount
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-200 focus:border-[#FF6B00]'
                  }`}
                />
              </div>

              {errors.payAmount ? (
                <p className="text-[11px] text-red-600 font-medium">
                  {errors.payAmount}
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                  <span>Minimal Rp 10.000 per orang</span>
                  <span>(Standar UMK: Rp {MIN_HOURLY_RATE.toLocaleString('id-ID')}/jam)</span>
                </div>
              )}

              {/* Bonus Lembur Button (Disabled / Segera Hadir) */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold cursor-not-allowed opacity-80"
                  title="Fitur ini akan segera tersedia"
                >
                  <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                  <span>+ Tambah Bonus Lembur</span>
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-medium ml-0.5">
                    Segera hadir
                  </span>
                </button>
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            {/* Ringkasan Biaya ESTIMASI */}
            <div className="flex flex-col gap-2 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">
                  Ringkasan Biaya
                </span>
                <span className="text-[10px] font-bold text-[#FF6B00] bg-[#FFEDE0] px-2 py-0.5 rounded-full">
                  ESTIMASI
                </span>
              </div>

              {/* Item: Upah Mahasiswa */}
              <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <span className="min-w-0">
                  Upah ({slots} mhs × Rp {payAmount.toLocaleString('id-ID')})
                </span>
                <span className="font-semibold text-[#0B1C30] shrink-0">
                  Rp {totalWage.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Item: Biaya Layanan */}
              <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-1 min-w-0">
                  <span>
                    Biaya Layanan ({slots} mhs × Rp{' '}
                    {serviceFee.toLocaleString('id-ID')})
                  </span>
                  <Info className="w-3 h-3 text-gray-400 shrink-0" />
                </div>
                <span className="font-semibold text-[#0B1C30] shrink-0">
                  + Rp {totalServiceFee.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Total Estimasi */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 mt-1">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#0B1C30]">
                    Total Estimasi Pembayaran
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Upah + Biaya Layanan Platform
                  </span>
                </div>
                <span className="text-base font-bold text-[#FF6B00] tracking-tight shrink-0">
                  Rp {totalEstimasi.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5: LOKASI PEKERJAAN */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[#0B1C30] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#FF6B00]" />
                <span>Lokasi Pekerjaan</span>
              </label>
              <span className="text-[11px] text-gray-500">
                Otomatis dari profil
              </span>
            </div>

            <div className="p-3 bg-[#F8F9FF] rounded-xl border border-gray-100 flex flex-col gap-1">
              <span className="text-xs font-bold text-[#0B1C30]">
                {umkmLocation?.business_name || 'Tempat Usaha Anda'}
              </span>
              <p className="text-xs text-gray-600 leading-relaxed">
                {umkmLocation?.address ||
                  'Alamat belum disetel pada profil usaha. Pelamar akan diarahkan sesuai titik koordinat terdaftar.'}
              </p>
            </div>
          </div>

          {/* SECTION 6: JAMINAN DANA */}
          <div className="p-3.5 rounded-2xl bg-[#E5EEFF]/60 border border-blue-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <ShieldCheck className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#0B1C30]">
                Jaminan Perlindungan Dana
              </span>
              <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5">
                Dana baru ditahan saat kamu menerima pelamar, dan dicairkan
                setelah tugas dikonfirmasi selesai.
              </p>
            </div>
          </div>

          {/* SECTION 7: SIMPAN SEBAGAI TEMPLATE */}
          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="saveTemplateCheckbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="w-4 h-4 rounded text-[#FF6B00] focus:ring-[#FF6B00] border-gray-300 cursor-pointer"
            />
            <label
              htmlFor="saveTemplateCheckbox"
              className="flex-1 cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <BookmarkCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="text-xs font-bold text-[#0B1C30]">
                  Simpan sebagai template (Panggil Ulang Cepat)
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Bisa dipublikasikan kembali dengan satu klik di lain waktu.
              </p>
            </label>
          </div>

          {/* STICKY FOOTER */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_24px_0_rgba(26,43,76,0.08)] px-4 py-3">
            <div className="max-w-[420px] mx-auto flex flex-col gap-1.5">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-full bg-[#FF6B00] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(255,107,0,0.4)] hover:bg-[#E05E00] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mempublikasikan Lowongan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Publikasikan Lowongan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

export default function MerchantPostJobPage() {
  return (
    <Suspense fallback={<MerchantPostSkeleton />}>
      <MerchantPostJobContent />
    </Suspense>
  )
}
