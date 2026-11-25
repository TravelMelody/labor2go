'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  FileCheck2,
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

interface StudentVerificationViewProps {
  userId: string
  initialStatus: VerificationStatus
  initialNote: string | null
  initialNim: string
  university: string
  initialHasKtm: boolean
}

export function StudentVerificationView({
  userId,
  initialStatus,
  initialNote,
  initialNim,
  university,
  initialHasKtm,
}: StudentVerificationViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<VerificationStatus>(initialStatus)
  const [note, setNote] = useState<string | null>(initialNote)
  const [nim, setNim] = useState(initialNim)
  const [savedNim, setSavedNim] = useState(initialNim)
  const [hasKtm, setHasKtm] = useState(initialHasKtm)
  const [ktmFile, setKtmFile] = useState<File | null>(null)

  const [nimError, setNimError] = useState<string | null>(null)
  const [ktmError, setKtmError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)

  const validateFixForm = (requireKtm: boolean): boolean => {
    let valid = true
    setNimError(null)
    setKtmError(null)

    if (!nim.trim()) {
      setNimError('NIM wajib diisi.')
      valid = false
    } else if (!/^\d+$/.test(nim.trim())) {
      setNimError('NIM harus berupa angka saja tanpa spasi atau huruf.')
      valid = false
    }

    if (requireKtm && !hasKtm && !ktmFile) {
      setKtmError('Foto KTM wajib diunggah sebelum mengajukan verifikasi ulang.')
      valid = false
    }

    if (ktmFile) {
      if (!ktmFile.type.startsWith('image/')) {
        setKtmError('File KTM harus berupa gambar (JPG, PNG, atau WEBP).')
        valid = false
      } else if (ktmFile.size > 2 * 1024 * 1024) {
        setKtmError('Ukuran file KTM maksimal 2 MB.')
        valid = false
      }
    }

    return valid
  }

  const persistCorrectionData = async (): Promise<boolean> => {
    let uploadedPath: string | null = null

    if (ktmFile) {
      const ext = ktmFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${userId}/ktm.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('ktm')
        .upload(filePath, ktmFile, {
          upsert: true,
          contentType: ktmFile.type,
        })

      if (uploadError) {
        logSupabaseError('StudentVerificationView.uploadKtm', uploadError)
        setServerError(`Gagal mengunggah foto KTM: ${uploadError.message}`)
        return false
      }

      uploadedPath = filePath
    }

    const updatePayload: { nim: string; ktm_url?: string } = {
      nim: nim.trim(),
    }
    if (uploadedPath) {
      updatePayload.ktm_url = uploadedPath
    }

    const { error: updateError } = await supabase
      .from('student_profiles')
      .update(updatePayload)
      .eq('id', userId)

    if (updateError) {
      logSupabaseError('StudentVerificationView.updateStudent', updateError)
      setServerError(updateError.message)
      return false
    }

    setSavedNim(nim.trim())
    if (uploadedPath) {
      setHasKtm(true)
      setKtmFile(null)
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
          'Data perbaikan disimpan. Tekan "Ajukan Verifikasi Ulang" agar ditinjau admin.'
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

    setResubmitting(true)
    try {
      if (nim.trim() !== savedNim || ktmFile !== null) {
        const ok = await persistCorrectionData()
        if (!ok) return
      }

      const { error } = await supabase.rpc('request_reverification')
      if (error) {
        logSupabaseError('StudentVerificationView.request_reverification', error)
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
      logSupabaseError('StudentVerificationView.reverificationCatch', err)
      setServerError(
        err instanceof Error ? err.message : 'Gagal mengajukan verifikasi ulang.'
      )
    } finally {
      setResubmitting(false)
    }
  }

  const busy = saving || resubmitting

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FF]">
      <AccountSubpageHeader
        title="Keamanan & Verifikasi"
        subtitle="Status verifikasi identitas mahasiswa"
        backHref="/student/account"
      />

      <div className="px-4 pt-4 pb-8 flex flex-col gap-4">
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
                Identitas mahasiswa dan KTM kamu telah diverifikasi admin. Data nama, kampus, NIM, dan KTM dikunci untuk keamanan komunitas.
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
                Data mahasiswa dan foto KTM kamu sedang dalam proses peninjauan oleh admin Labor2Go.
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
                Alasan: {note?.trim() || 'Data belum sesuai ketentuan verifikasi.'}
              </p>
              <p className="text-[11px] text-red-700 mt-1.5">
                Silakan perbaiki NIM atau unggah ulang foto KTM di bawah ini, lalu ajukan verifikasi ulang.
              </p>
            </div>
          </section>
        )}

        {/* Ringkasan Data Verifikasi (foto KTM lama tidak ditampilkan) */}
        <section className="bg-white rounded-3xl p-4 shadow-xs border border-gray-100 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#0B1C30] flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />
            <span>Ringkasan Data Identitas</span>
          </h3>

          <div className="grid grid-cols-1 gap-2.5 text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-gray-500">Kampus</span>
              <span className="font-semibold text-[#0B1C30] text-right">
                {university}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-gray-50">
              <span className="text-gray-500">NIM</span>
              <span className="font-semibold text-[#0B1C30]">{savedNim || '-'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-gray-50">
              <span className="text-gray-500">Dokumen KTM</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{hasKtm ? 'KTM sudah diunggah' : 'Belum diunggah'}</span>
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
              Perbaikan Data Verifikasi
            </h3>

            {/* NIM */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0B1C30]">
                  Nomor Induk Mahasiswa (NIM) <span className="text-[#FF6B00]">*</span>
                </label>
                <span className="text-[10px] text-gray-500 font-medium">
                  Hanya angka
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={nim}
                onChange={(e) => setNim(e.target.value.replace(/[^\d]/g, ''))}
                disabled={busy}
                placeholder="Contoh: 5311420001"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white border outline-hidden transition-colors ${
                  nimError
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-gray-200 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]'
                }`}
              />
              {nimError && (
                <p className="text-[11px] text-red-500 font-medium">{nimError}</p>
              )}
            </div>

            {/* Upload KTM Baru */}
            <ImageUploadField
              label="Unggah Foto KTM Baru"
              description={
                hasKtm
                  ? 'KTM sudah diunggah. Pilih foto baru jika perlu mengganti KTM sebelumnya.'
                  : 'Unggah foto Kartu Tanda Mahasiswa yang jelas dan terbaca.'
              }
              required={!hasKtm}
              file={ktmFile}
              onFileChange={setKtmFile}
              disabled={busy}
              error={ktmError}
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
