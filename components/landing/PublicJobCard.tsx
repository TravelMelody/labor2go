'use client'

import React from 'react'
import Image from 'next/image'
import { MapPin, Clock, Users, Star } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import { getInitials } from '@/components/account/AccountShared'
import type { PublicJobItem } from '@/lib/public-jobs'

interface PublicJobCardProps {
  job: PublicJobItem
  onSelect: (job: PublicJobItem) => void
}

export function PublicJobCard({ job, onSelect }: PublicJobCardProps) {
  const hasReviews = job.reviewCount > 0 && job.avgRating != null
  const locationLabel =
    job.locationName?.trim() || job.distanceText || 'Sekitar Kampus'

  return (
    <button
      type="button"
      onClick={() => onSelect(job)}
      className="w-[272px] sm:w-[300px] shrink-0 snap-start text-left bg-white rounded-2xl p-4 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between gap-3 group cursor-pointer"
    >
      <div className="flex flex-col gap-3 min-w-0">
        {/* Merchant Header */}
        <div className="flex items-center gap-3 min-w-0">
          {job.merchantPhoto ? (
            <Image
              src={job.merchantPhoto}
              alt={job.businessName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#FFEDE0] text-[#FF6B00] font-extrabold text-xs flex items-center justify-center shrink-0 border border-orange-200/70">
              {getInitials(job.businessName, 'UM')}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#0B1C30] truncate">
              {job.businessName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {job.businessType && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 truncate max-w-[110px]">
                  {job.businessType}
                </span>
              )}
              {hasReviews ? (
                <span className="inline-flex items-center gap-0.5 bg-orange-50 px-1.5 py-0.5 rounded-full text-[#FF6B00] text-[10px] font-bold">
                  <Star className="w-2.5 h-2.5 fill-[#FF6B00]" />
                  {Number(job.avgRating).toFixed(1)}
                </span>
              ) : (
                <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                  Baru
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Job Title & Pay */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm sm:text-[15px] font-bold text-[#0B1C30] group-hover:text-[#FF6B00] transition-colors line-clamp-2 leading-snug min-h-[2.5rem]">
            {job.title}
          </h3>
          <div>
            <span className="inline-block bg-[#FFEDE0] text-[#FF6B00] px-2.5 py-1 rounded-full font-extrabold text-xs sm:text-sm">
              {formatRupiah(job.payAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Location, Schedule, Slots */}
      <div className="flex flex-col gap-1.5 pt-2.5 border-t border-gray-100 text-[11px] sm:text-xs">
        <div className="flex items-center gap-1.5 text-gray-600 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
          <span className="truncate">
            {locationLabel}
            {job.locationName && job.distanceText ? ` · ${job.distanceText}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-500 min-w-0">
          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate">{job.scheduleText}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[#FF6B00] font-semibold">
          <Users className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
          <span>Tersisa {job.slotsLeft} slot</span>
        </div>
      </div>
    </button>
  )
}
