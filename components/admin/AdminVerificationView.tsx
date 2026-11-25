'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GraduationCap,
  Store,
  Phone,
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatFullDateTimeWIB } from '@/lib/format'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

type VerificationTab = 'pending' | 'approved' | 'rejected'

interface StudentProfileDetail {
  nim: string | null
  university: string | null
  skills: string[] | null
  ktm_url: string | null
}

interface UmkmProfileDetail {
  business_name: string
  business_type: string | null
  address: string | null
  lat: number | null
  lng: number | null
  photo_url: string | null
}

interface RawVerificationProfile {
  id: string
  role: 'student' | 'umkm'
  full_name: string | null
  phone: string | null
  verified: boolean
  verification_status: VerificationTab
  verification_note: string | null
  created_at: string
  student_profiles: StudentProfileDetail | StudentProfileDetail[] | null
  umkm_profiles: UmkmProfileDetail | UmkmProfileDetail[] | null
}

interface VerificationItem {
  id: string
  role: 'student' | 'umkm'
  full_name: string | null
  phone: string | null
  verification_status: VerificationTab
  verification_note: string | null
  created_at: string
  student_detail: StudentProfileDetail | null
  umkm_detail: UmkmProfileDetail | null
}

function pickOne<T>(val: T | T[] | null | undefined): T | null {
  if (Array.isArray(val)) return val[0] ?? null
  return val ?? null
}

const TABS: { key: VerificationTab; label: string }[] = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

export function AdminVerificationView() {
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<VerificationTab>('pending')
  const [items, setItems] = useState<VerificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Modal preview gambar (KTM signed URL on-demand atau foto usaha publik)
  const [previewState, setPreviewState] = useState<{
    open: boolean
    title: string
    subtitle: string
    url: string | null
    loading: boolean
    error: string | null
    zoom: number
  }>({
    open: false,
    title: '',
    subtitle: '',
    url: null,
    loading: false,
    error: null,
    zoom: 1,
  })

  // Dialog aksi Setujui / Tolak
  const [approveTarget, setApproveTarget] = useState<VerificationItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VerificationItem | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlightRef = useRef(false)

  // Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const closePreviewModal = useCallback(() => {
    setPreviewState({
      open: false,
      title: '',
      subtitle: '',
      url: null,
      loading: false,
      error: null,
      zoom: 1,
    })
  }, [])

  // Tutup modal preview dengan tombol ESC
  useEffect(() => {
    if (!previewState.open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePreviewModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewState.open, closePreviewModal])

  const queryVerificationItems = useCallback(
    async (tab: VerificationTab) => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, role, full_name, phone, verified, verification_status, verification_note, created_at, student_profiles(nim, university, skills, ktm_url), umkm_profiles(business_name, business_type, address, lat, lng, photo_url)'
        )
        .in('role', ['student', 'umkm'])
        .eq('verification_status', tab)
        .order('created_at', { ascending: tab === 'pending' })

      if (error) {
        return { data: null, error }
      }

      const rows = (data ?? []) as unknown as RawVerificationProfile[]
      const normalized: VerificationItem[] = []

      for (const row of rows) {
        const studentDetail = pickOne(row.student_profiles)
        const umkmDetail = pickOne(row.umkm_profiles)

        // Hanya tampilkan user yang SUDAH memiliki baris profil detail
        if (row.role === 'student' && !studentDetail) continue
        if (row.role === 'umkm' && !umkmDetail) continue

        normalized.push({
          id: row.id,
          role: row.role,
          full_name: row.full_name,
          phone: row.phone,
          verification_status: row.verification_status,
          verification_note: row.verification_note,
          created_at: row.created_at,
          student_detail: studentDetail,
          umkm_detail: umkmDetail,
        })
      }

      return { data: normalized, error: null }
    },
    [supabase]
  )

  const fetchItems = useCallback(
    async (tab: VerificationTab, silent = false) => {
      try {
        if (!silent) {
          setLoading(true)
        } else {
          setRefreshing(true)
        }
        setFetchError(null)

        const { data, error } = await queryVerificationItems(tab)

        if (error) {
          if (error.code === 'P0001') {
            console.warn('Peringatan saat memuat antrean verifikasi:', error.message)
          } else {
            console.error('Gagal memuat daftar verifikasi:', error)
          }
          setFetchError(error.message || 'Gagal memuat daftar verifikasi.')
          return
        }

        if (data) {
          setItems(data)
        }
      } catch (err) {
        console.error('Kesalahan tak terduga saat memuat verifikasi:', err)
        setFetchError('Terjadi kesalahan tak terduga saat memuat data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [queryVerificationItems]
  )

  useEffect(() => {
    let active = true
    const run = async () => {
      const { data, error } = await queryVerificationItems(activeTab)
      if (!active) return

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Peringatan saat memuat antrean verifikasi:', error.message)
        } else {
          console.error('Gagal memuat daftar verifikasi:', error)
        }
        setFetchError(error.message || 'Gagal memuat daftar verifikasi.')
        setLoading(false)
        return
      }

      setFetchError(null)
      setItems(data ?? [])
      setLoading(false)
    }

    void run().catch((err) => {
      if (!active) return
      console.error('Kesalahan tak terduga saat memuat verifikasi:', err)
      setFetchError('Terjadi kesalahan tak terduga saat memuat data.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [activeTab, queryVerificationItems])

  // Auto-refresh khusus tab Menunggu
  useAutoRefresh(() => {
    if (activeTab === 'pending') {
      fetchItems('pending', true)
    }
  }, 20000)

  const handleOpenKtm = async (item: VerificationItem) => {
    const ktmPath = item.student_detail?.ktm_url
    if (!ktmPath) {
      setToast({
        type: 'error',
        message: 'Path foto KTM tidak tersedia untuk mahasiswa ini.',
      })
      return
    }

    setPreviewState({
      open: true,
      title: `Foto KTM – ${item.full_name || 'Mahasiswa'}`,
      subtitle: `NIM: ${item.student_detail?.nim || '-'} • Tautan sementara berlaku 60 detik`,
      url: null,
      loading: true,
      error: null,
      zoom: 1,
    })

    try {
      const { data, error } = await supabase.storage
        .from('ktm')
        .createSignedUrl(ktmPath, 60)

      if (error || !data?.signedUrl) {
        if (error) {
          console.error('Gagal membuat signed URL KTM:', error.message)
        }
        setPreviewState((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || 'Gagal membuka foto KTM.',
        }))
        return
      }

      // Jangan simpan atau log signedUrl; simpan hanya di state sementara modal
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        url: data.signedUrl,
      }))
    } catch (err) {
      console.error('Kesalahan saat memuat foto KTM:', err)
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        error: 'Terjadi kesalahan saat mengambil foto KTM.',
      }))
    }
  }

  const handleOpenBusinessPhoto = (item: VerificationItem) => {
    const photoUrl = item.umkm_detail?.photo_url
    if (!photoUrl) return

    setPreviewState({
      open: true,
      title: `Foto Usaha – ${item.umkm_detail?.business_name || 'Merchant'}`,
      subtitle: `Pemilik: ${item.full_name || '-'}`,
      url: photoUrl,
      loading: false,
      error: null,
      zoom: 1,
    })
  }

  const handleConfirmApprove = async () => {
    if (!approveTarget || inFlightRef.current) return
    inFlightRef.current = true
    setSubmitting(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_set_verification', {
        p_user_id: approveTarget.id,
        p_approve: true,
        p_note: null,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Validasi verifikasi (setujui):', error.message)
        } else {
          console.error('Gagal menyetujui verifikasi:', error)
        }
        setActionError(error.message || 'Gagal menyetujui verifikasi.')
        return
      }

      const approvedName =
        approveTarget.role === 'umkm'
          ? approveTarget.umkm_detail?.business_name || approveTarget.full_name
          : approveTarget.full_name

      setItems((prev) => prev.filter((item) => item.id !== approveTarget.id))
      setApproveTarget(null)
      setToast({
        type: 'success',
        message: `Akun "${approvedName || 'Pengguna'}" berhasil disetujui.`,
      })
    } catch (err) {
      console.error('Kesalahan tak terduga saat menyetujui verifikasi:', err)
      setActionError('Terjadi kesalahan sistem saat memproses verifikasi.')
    } finally {
      inFlightRef.current = false
      setSubmitting(false)
    }
  }

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectTarget || inFlightRef.current) return

    const trimmedNote = rejectNote.trim()
    if (trimmedNote.length < 5) {
      setActionError('Alasan penolakan wajib diisi minimal 5 karakter.')
      return
    }

    inFlightRef.current = true
    setSubmitting(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_set_verification', {
        p_user_id: rejectTarget.id,
        p_approve: false,
        p_note: trimmedNote,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Validasi verifikasi (tolak):', error.message)
        } else {
          console.error('Gagal menolak verifikasi:', error)
        }
        setActionError(error.message || 'Gagal menolak verifikasi.')
        return
      }

      const rejectedName =
        rejectTarget.role === 'umkm'
          ? rejectTarget.umkm_detail?.business_name || rejectTarget.full_name
          : rejectTarget.full_name

      setItems((prev) => prev.filter((item) => item.id !== rejectTarget.id))
      setRejectTarget(null)
      setRejectNote('')
      setToast({
        type: 'success',
        message: `Verifikasi "${rejectedName || 'Pengguna'}" telah ditolak.`,
      })
    } catch (err) {
      console.error('Kesalahan tak terduga saat menolak verifikasi:', err)
      setActionError('Terjadi kesalahan sistem saat menolak verifikasi.')
    } finally {
      inFlightRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm p-3.5 rounded-2xl border shadow-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <p className="text-xs font-semibold flex-1 leading-relaxed">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1C30] tracking-tight">
            Verifikasi Pengguna
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Periksa KTM mahasiswa dan foto tempat usaha merchant sebelum menyetujui akun.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchItems(activeTab, true)}
          disabled={loading || refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#0B1C30] hover:bg-gray-50 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#FF6B00] ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Tabs Menunggu / Disetujui / Ditolak */}
      <div className="inline-flex p-1 bg-white rounded-2xl border border-gray-100 shadow-xs self-start">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (tab.key !== activeTab) {
                  setLoading(true)
                  setActiveTab(tab.key)
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'text-gray-600 hover:text-[#0B1C30]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* List Content */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-56 rounded-2xl bg-white border border-gray-100"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-gray-100 shadow-xs text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B1C30]">
            Tidak ada data pada tab {TABS.find((t) => t.key === activeTab)?.label}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            {activeTab === 'pending'
              ? 'Semua pendaftaran mahasiswa dan merchant yang telah melengkapi profil sudah ditinjau.'
              : 'Belum ada pengguna dengan status verifikasi ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => {
            const isStudent = item.role === 'student'
            const student = item.student_detail
            const umkm = item.umkm_detail
            const hasCoords =
              umkm?.lat !== null &&
              umkm?.lat !== undefined &&
              umkm?.lng !== null &&
              umkm?.lng !== undefined

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="flex flex-col gap-3">
                  {/* Card Top Meta */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isStudent
                            ? 'bg-[#FFEDE0] text-[#FF6B00]'
                            : 'bg-[#E5EEFF] text-[#0B1C30]'
                        }`}
                      >
                        {isStudent ? (
                          <GraduationCap className="w-5 h-5" />
                        ) : (
                          <Store className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isStudent
                                ? 'bg-[#FFEDE0] text-[#FF6B00]'
                                : 'bg-[#E5EEFF] text-[#0B1C30]'
                            }`}
                          >
                            {isStudent ? 'Mahasiswa' : 'Merchant UMKM'}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {formatFullDateTimeWIB(item.created_at)}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-[#0B1C30] truncate mt-0.5">
                          {isStudent
                            ? item.full_name || 'Tanpa Nama'
                            : umkm?.business_name || 'Tanpa Nama Usaha'}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Detail Fields */}
                  {isStudent && student ? (
                    <div className="flex flex-col gap-2 text-xs text-gray-600 bg-[#F8F9FF] rounded-xl p-3.5 border border-gray-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">No. HP / WA</span>
                        <span className="font-semibold text-[#0B1C30] flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[#FF6B00]" />
                          {item.phone || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">NIM</span>
                        <span className="font-semibold text-[#0B1C30]">
                          {student.nim || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Kampus</span>
                        <span className="font-semibold text-[#0B1C30] text-right">
                          {student.university || '-'}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-gray-200/70">
                        <span className="text-gray-500 block mb-1.5">
                          Keahlian / Skill
                        </span>
                        {student.skills && student.skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {student.skills.map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold text-[#0B1C30]"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  ) : umkm ? (
                    <div className="flex flex-col gap-2.5 text-xs text-gray-600 bg-[#F8F9FF] rounded-xl p-3.5 border border-gray-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Pemilik</span>
                        <span className="font-semibold text-[#0B1C30]">
                          {item.full_name || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">No. HP / WA</span>
                        <span className="font-semibold text-[#0B1C30] flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[#FF6B00]" />
                          {item.phone || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Jenis Usaha</span>
                        <span className="font-semibold text-[#0B1C30]">
                          {umkm.business_type || '-'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 pt-1 border-t border-gray-200/70">
                        <span className="text-gray-500">Alamat</span>
                        <span className="font-medium text-[#0B1C30] leading-relaxed">
                          {umkm.address || '-'}
                        </span>
                        {hasCoords && (
                          <a
                            href={`https://www.google.com/maps?q=${umkm.lat},${umkm.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#FF6B00] font-bold hover:underline mt-0.5 self-start"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Buka lokasi di Peta</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Foto KTM (on-demand signed URL) atau Foto Usaha (publik) */}
                  {isStudent ? (
                    <button
                      type="button"
                      onClick={() => handleOpenKtm(item)}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-[#EFF4FF] hover:bg-[#E5EEFF] text-[#0B1C30] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-[#FF6B00]" />
                      <span>Lihat Foto KTM (Signed URL 60 detik)</span>
                    </button>
                  ) : umkm?.photo_url ? (
                    <button
                      type="button"
                      onClick={() => handleOpenBusinessPhoto(item)}
                      className="group relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={umkm.photo_url}
                        alt={`Foto usaha ${umkm.business_name}`}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                      />
                      <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/65 to-transparent flex items-center justify-between text-white text-[11px] font-semibold">
                        <span>Foto Tempat Usaha</span>
                        <span className="inline-flex items-center gap-1">
                          <ZoomIn className="w-3.5 h-3.5" />
                          Perbesar
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="py-3 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 text-center">
                      Foto tempat usaha tidak tersedia.
                    </div>
                  )}

                  {/* Alasan penolakan pada tab Ditolak */}
                  {activeTab === 'rejected' && item.verification_note && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                      <span className="font-bold block mb-0.5">
                        Alasan Penolakan:
                      </span>
                      <span>{item.verification_note}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {(activeTab === 'pending' || activeTab === 'rejected') && (
                  <div className="pt-3 border-t border-gray-100 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null)
                        setApproveTarget(item)
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Setujui</span>
                    </button>

                    {activeTab === 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null)
                          setRejectNote('')
                          setRejectTarget(item)
                        }}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Tolak</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Preview Gambar dengan Zoom */}
      {previewState.open && (
        <div
          onClick={closePreviewModal}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0B1C30] truncate">
                  {previewState.title}
                </h3>
                <p className="text-[11px] text-gray-500 truncate">
                  {previewState.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewState((p) => ({
                      ...p,
                      zoom: Math.max(1, Number((p.zoom - 0.5).toFixed(1))),
                    }))
                  }
                  disabled={!previewState.url || previewState.zoom <= 1}
                  title="Perkecil"
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-[#0B1C30] min-w-[42px] text-center">
                  {Math.round(previewState.zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewState((p) => ({
                      ...p,
                      zoom: Math.min(3, Number((p.zoom + 0.5).toFixed(1))),
                    }))
                  }
                  disabled={!previewState.url || previewState.zoom >= 3}
                  title="Perbesar"
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewState((p) => ({ ...p, zoom: 1 }))}
                  disabled={!previewState.url || previewState.zoom === 1}
                  title="Reset zoom"
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={closePreviewModal}
                  aria-label="Tutup dialog gambar"
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 ml-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-4 min-h-[320px]">
              {previewState.loading ? (
                <div className="flex flex-col items-center gap-2 text-white/80">
                  <Loader2 className="w-7 h-7 animate-spin text-[#FF6B00]" />
                  <span className="text-xs">Mengambil tautan gambar aman...</span>
                </div>
              ) : previewState.error ? (
                <div className="p-4 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{previewState.error}</span>
                </div>
              ) : previewState.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewState.url}
                  alt={previewState.title}
                  onClick={() =>
                    setPreviewState((p) => ({
                      ...p,
                      zoom: p.zoom >= 2 ? 1 : 2,
                    }))
                  }
                  style={{
                    transform: `scale(${previewState.zoom})`,
                    transformOrigin: 'center center',
                  }}
                  className="max-h-[70vh] w-auto object-contain rounded-lg transition-transform duration-150 cursor-zoom-in"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Setujui */}
      {approveTarget && (
        <div
          onClick={() => !submitting && setApproveTarget(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B1C30]">
                  Setujui Verifikasi Akun?
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Akun{' '}
                  <span className="font-bold text-[#0B1C30]">
                    {approveTarget.role === 'umkm'
                      ? approveTarget.umkm_detail?.business_name ||
                        approveTarget.full_name
                      : approveTarget.full_name}
                  </span>{' '}
                  akan ditandai terverifikasi dan lencana Terverifikasi akan aktif.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setApproveTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmApprove}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Setujui</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Tolak dengan Alasan Wajib Min 5 Karakter */}
      {rejectTarget && (
        <div
          onClick={() => !submitting && setRejectTarget(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmReject}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B1C30]">
                  Tolak Verifikasi Akun
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Berikan alasan penolakan untuk{' '}
                  <span className="font-bold text-[#0B1C30]">
                    {rejectTarget.role === 'umkm'
                      ? rejectTarget.umkm_detail?.business_name ||
                        rejectTarget.full_name
                      : rejectTarget.full_name}
                  </span>
                  . Alasan ini akan tampil di halaman pengguna.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0B1C30] mb-1.5">
                Alasan Penolakan <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                disabled={submitting}
                placeholder="Contoh: Foto KTM buram dan NIM tidak terbaca dengan jelas."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-hidden text-xs sm:text-sm resize-none"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Minimal 5 karakter ({rejectNote.trim().length}/5)
              </p>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || rejectNote.trim().length < 5}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Kirim Penolakan</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
