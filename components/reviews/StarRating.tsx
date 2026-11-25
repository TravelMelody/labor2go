'use client'

import React, { useRef, useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  value: number
  onChange?: (rating: number) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  ariaLabel?: string
  className?: string
}

const ICON_SIZE_CLASS: Record<NonNullable<StarRatingProps['size']>, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-7 h-7',
}

const VALUE_TEXT_CLASS: Record<NonNullable<StarRatingProps['size']>, string> = {
  sm: 'text-[11px]',
  md: 'text-xs',
  lg: 'text-sm',
}

/**
 * Komponen bintang rating yang mendukung mode read-only (angka 1 desimal)
 * dan mode input interaktif (area ketuk >= 44px & aksesibel via keyboard).
 */
export function StarRating({
  value,
  onChange,
  disabled = false,
  size = 'md',
  showValue = true,
  ariaLabel,
  className = '',
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number>(0)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const clampedValue = Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0
  const iconClass = ICON_SIZE_CLASS[size]

  if (!onChange) {
    const filledCount = Math.round(clampedValue)
    const formattedValue = clampedValue.toFixed(1)

    return (
      <div
        role="img"
        aria-label={ariaLabel || `Rating ${formattedValue} dari 5`}
        className={`inline-flex items-center gap-1 ${className}`}
      >
        <div className="inline-flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= filledCount
            return (
              <Star
                key={star}
                aria-hidden="true"
                className={`${iconClass} shrink-0 ${
                  isFilled
                    ? 'fill-[#FF6B00] text-[#FF6B00]'
                    : 'fill-gray-100 text-gray-300'
                }`}
              />
            )
          })}
        </div>
        {showValue && (
          <span
            className={`${VALUE_TEXT_CLASS[size]} font-bold text-[#0B1C30] tabular-nums ml-0.5`}
          >
            {formattedValue}
          </span>
        )}
      </div>
    )
  }

  const activePreview = !disabled && hoverValue > 0 ? hoverValue : clampedValue

  const selectAndFocus = (nextRating: number) => {
    if (disabled) return
    onChange(nextRating)
    buttonRefs.current[nextRating - 1]?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, star: number) => {
    if (disabled) return

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const base = clampedValue > 0 ? clampedValue : star
      selectAndFocus(Math.min(5, base + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      const base = clampedValue > 0 ? clampedValue : star
      selectAndFocus(Math.max(1, base - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      selectAndFocus(1)
    } else if (e.key === 'End') {
      e.preventDefault()
      selectAndFocus(5)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChange(star)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel || 'Pilih rating bintang'}
      onMouseLeave={() => setHoverValue(0)}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {[1, 2, 3, 4, 5].map((star, index) => {
        const isChecked = clampedValue === star
        const isFilled = star <= activePreview
        const tabIndex =
          disabled
            ? -1
            : clampedValue > 0
              ? isChecked
                ? 0
                : -1
              : star === 1
                ? 0
                : -1

        return (
          <button
            key={star}
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={isChecked}
            aria-label={`${star} bintang`}
            tabIndex={tabIndex}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(star)
            }}
            onMouseEnter={() => {
              if (!disabled) setHoverValue(star)
            }}
            onKeyDown={(e) => handleKeyDown(e, star)}
            className="min-w-[44px] min-h-[44px] w-11 h-11 inline-flex items-center justify-center rounded-xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Star
              aria-hidden="true"
              className={`${iconClass} transition-colors ${
                isFilled
                  ? 'fill-[#FF6B00] text-[#FF6B00]'
                  : 'fill-gray-100 text-gray-300'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
