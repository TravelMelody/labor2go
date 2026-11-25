'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StarRating } from '@/components/reviews/StarRating'

interface ReviewDialogProps {
  open: boolean
  onClose: () => void
  applicationId: string
  targetName: string
  subtitle?: string
  onSuccess: (submitted: { rating: number; comment: string | null }) => void | Promise<void>
}

const RATING_LABELS: Record<number, string> = {
  1: 'Sangat kurang',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat baik',
}

/**
 * Bottom sheet dialog untuk mengirim ulasan melalui RPC submit_review.
 */
export function ReviewDialog({
  open,
  onClose,
  applicationId,
  targetName,
  subtitle,
  onSuccess,
}: ReviewDialogProps) {
  if (!open) return null

  return (
    <ReviewDialogSheet
      key={applicationId}
      onClose={onClose}
      applicationId={applicationId}
      targetName={targetName}
      subtitle={subtitle}
      onSuccess={onSuccess}
    />
  )
}

function ReviewDialogSheet({
  onClose,
  applicationId,
  targetName,
  subtitle,
  onSuccess,
}: Omit<ReviewDialogProps, 'open'>) {
  const supabase = useMemo(() => createClient(), [])

  const [rating, setRating] = useState<number>(0)
  const [comment, setComment] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const inFlightRef = useRef<boolean>(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inFlightRef.current) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleBackdropClick = () => {
    if (isSubmitting || inFlightRef.current) return
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (inFlightRef.current || isSubmitting) return

    if (rating < 1 || rating > 5) {
      setErrorMessage('Pilih jumlah bintang terlebih dahulu')
      return
    }

    const trimmedComment = comment.trim()
    if (trimmedComment.length > 500) {
      setErrorMessage('Komentar maksimal 500 karakter')
      return
    }

    inFlightRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const { error } = await supabase.rpc('submit_review', {
        p_application_id: applicationId,
        p_rating: rating,
        p_comment: trimmedComment || null,
      })

      if (error) {
        if (error.code === 'P0001') {
          console.warn('Validasi bisnis submit_review:', error.message)
        } else {
          console.error('Kesalahan tak terduga saat submit_review:', error)
        }
        setErrorMessage(error.message || 'Gagal mengirim ulasan')
        return
      }

      const submittedRating = rating
      const submittedComment = trimmedComment || null
      onClose()
      await onSuccess({ rating: submittedRating, comment: submittedComment })
    } catch (err) {
      console.error('Kesalahan tak terduga saat mengirim ulasan:', err)
      setErrorMessage('Terjadi kesalahan sistem saat mengirim ulasan')
    } finally {
      inFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#0B1C30]/50 backdrop-blur-[2px] flex items-end justify-center"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        className="w-full max-w-[420px] bg-white rounded-t-3xl p-5 pb-8 shadow-2xl border-t border-gray-100 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2
              id="review-dialog-title"
              className="text-base font-extrabold text-[#0B1C30] truncate"
            >
              Nilai {targetName}
            </h2>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleBackdropClick}
            disabled={isSubmitting}
            aria-label="Tutup dialog ulasan"
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Input Bintang */}
          <div className="bg-[#F8F9FF] rounded-2xl p-4 border border-gray-100 flex flex-col items-center gap-2">
            <StarRating
              value={rating}
              onChange={(nextRating) => {
                setRating(nextRating)
                setErrorMessage(null)
              }}
              size="lg"
              disabled={isSubmitting}
              ariaLabel={`Beri rating bintang untuk ${targetName}`}
            />
            <span className="text-xs font-semibold text-gray-600 min-h-[16px]">
              {rating > 0 ? RATING_LABELS[rating] : 'Ketuk bintang 1–5 untuk menilai'}
            </span>
          </div>

          {/* Input Komentar Opsional */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="review-comment-input"
                className="text-xs font-bold text-[#0B1C30]"
              >
                Komentar (opsional)
              </label>
              <span className="text-[11px] font-medium text-gray-400 tabular-nums">
                {comment.length}/500
              </span>
            </div>
            <textarea
              id="review-comment-input"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              placeholder="Ceritakan pengalamanmu (opsional)..."
              disabled={isSubmitting}
              className="w-full p-3 rounded-xl border border-gray-200 bg-[#F8F9FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 focus:border-[#FF6B00] text-xs font-medium text-[#0B1C30] resize-none disabled:opacity-60"
            />
          </div>

          <p className="text-[11px] text-gray-500 text-center">
            Ulasan tidak bisa diubah setelah dikirim.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-snug">{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_6px_16px_-4px_rgba(255,107,0,0.35)] active:scale-[0.99] transition-all"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSubmitting ? 'Mengirim...' : 'Kirim Ulasan'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
