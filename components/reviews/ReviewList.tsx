'use client'

import React from 'react'
import { MessageSquareQuote } from 'lucide-react'
import { formatDateTimeWIB } from '@/lib/format'
import { StarRating } from '@/components/reviews/StarRating'

export const REVIEW_SELECT =
  'id, rating, comment, created_at, profiles!reviews_reviewer_id_fkey(full_name)'

export interface RawReviewRow {
  id: string
  rating: number
  comment: string | null
  created_at: string
  profiles?:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null
}

export interface ReviewItem {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_first_name: string
}

interface ReviewListProps {
  reviews: ReviewItem[]
  loading?: boolean
  emptyMessage?: string
}

/**
 * Mengambil nama depan pemberi ulasan tanpa menampilkan data pribadi lainnya.
 */
export function getReviewerFirstName(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return 'Pengguna'
  const first = fullName.trim().split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/**
 * Menormalkan hasil query tabel reviews dengan embed profiles!reviews_reviewer_id_fkey.
 */
export function normalizeReviewRows(
  rows: RawReviewRow[] | null | undefined
): ReviewItem[] {
  if (!rows || rows.length === 0) return []

  return rows.map((row) => {
    const profileObj = Array.isArray(row.profiles)
      ? row.profiles[0] || null
      : row.profiles || null

    return {
      id: row.id,
      rating: Number(row.rating),
      comment: row.comment?.trim() ? row.comment.trim() : null,
      created_at: row.created_at,
      reviewer_first_name: getReviewerFirstName(profileObj?.full_name),
    }
  })
}

/**
 * Daftar ulasan yang menampilkan bintang, nama depan pemberi, tanggal WIB, dan komentar.
 */
export function ReviewList({
  reviews,
  loading = false,
  emptyMessage = 'Belum ada ulasan',
}: ReviewListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5 animate-pulse">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-3.5 border border-gray-100 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-24 h-3.5 rounded bg-gray-200" />
              <div className="w-20 h-3.5 rounded bg-gray-200" />
            </div>
            <div className="w-32 h-3 rounded bg-gray-100" />
            <div className="w-full h-4 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100 text-center flex flex-col items-center justify-center gap-1.5">
        <MessageSquareQuote className="w-5 h-5 text-gray-400" />
        <p className="text-xs font-semibold text-gray-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0B1C30] truncate">
                {review.reviewer_first_name}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {formatDateTimeWIB(review.created_at)}
              </p>
            </div>
            <StarRating value={review.rating} size="sm" showValue />
          </div>

          {review.comment && (
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line break-words mt-2">
              {review.comment}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
