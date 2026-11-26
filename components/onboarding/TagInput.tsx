'use client'

import React, { useState, KeyboardEvent } from 'react'
import { Plus, X, Tag } from 'lucide-react'
import { MAX_SKILLS_COUNT, normalizeSpaces, validateSkill } from '@/lib/validation'

interface TagInputProps {
  tags: string[]
  onChange: (newTags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
  error?: string | null
  maxTags?: number
}

export function TagInput({
  tags,
  onChange,
  suggestions = ['F&B', 'Kasir', 'Packing', 'Event', 'Admin', 'Desain'],
  placeholder = 'Ketik skill lalu tekan Enter...',
  disabled = false,
  error = null,
  maxTags = MAX_SKILLS_COUNT,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [internalError, setInternalError] = useState<string | null>(null)

  const addTag = (tagToAdd: string) => {
    const cleanTag = normalizeSpaces(tagToAdd)
    if (!cleanTag) return

    const exists = tags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())
    if (exists) {
      setInternalError(null)
      setInputValue('')
      return
    }

    if (tags.length >= maxTags) {
      setInternalError(`Maksimal ${maxTags} skill.`)
      return
    }

    const skillError = validateSkill(cleanTag)
    if (skillError) {
      setInternalError(skillError)
      return
    }

    setInternalError(null)
    onChange([...tags, cleanTag])
    setInputValue('')
  }

  const removeTag = (tagToRemove: string) => {
    setInternalError(null)
    onChange(tags.filter((t) => t !== tagToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const toggleSuggestion = (suggestion: string) => {
    const exists = tags.some((t) => t.toLowerCase() === suggestion.toLowerCase())
    if (exists) {
      setInternalError(null)
      onChange(tags.filter((t) => t.toLowerCase() !== suggestion.toLowerCase()))
    } else {
      if (tags.length >= maxTags) {
        setInternalError(`Maksimal ${maxTags} skill.`)
        return
      }
      setInternalError(null)
      onChange([...tags, suggestion])
    }
  }

  const activeError = internalError || error

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Box Input & Active Tags */}
      <div
        className={`w-full min-h-[46px] p-2 rounded-xl bg-white border transition-colors flex flex-wrap items-center gap-1.5 ${
          activeError
            ? 'border-red-400 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-400'
            : 'border-gray-200 focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]'
        } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFEDE0] text-[#FF6B00] text-xs font-semibold animate-in fade-in zoom-in-95 duration-150"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-red-600 transition-colors focus:outline-hidden p-0.5 rounded-full"
              aria-label={`Hapus ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="flex-1 min-w-[120px] flex items-center gap-1">
          <input
            type="text"
            value={inputValue}
            maxLength={30}
            onChange={(e) => {
              setInputValue(e.target.value)
              if (internalError) setInternalError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : 'Tambah lagi...'}
            disabled={disabled}
            className="w-full bg-transparent text-xs sm:text-sm text-[#0B1C30] placeholder:text-gray-400 focus:outline-hidden px-1 py-1"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={() => addTag(inputValue)}
              className="p-1 text-[#FF6B00] hover:bg-[#FFEDE0] rounded-md transition-colors shrink-0"
              title="Tambah tag"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Selection Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-0.5">
          <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
            <Tag className="w-3 h-3 text-[#FF6B00]" />
            Pilihan cepat (maks. {maxTags}):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => {
              const isSelected = tags.some(
                (t) => t.toLowerCase() === suggestion.toLowerCase()
              )
              return (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => toggleSuggestion(suggestion)}
                  disabled={disabled}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    isSelected
                      ? 'bg-[#FF6B00] text-white shadow-xs font-semibold'
                      : 'bg-gray-100 hover:bg-[#FFEDE0] text-gray-600 hover:text-[#FF6B00]'
                  }`}
                >
                  {isSelected ? `✓ ${suggestion}` : `+ ${suggestion}`}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activeError && (
        <p className="text-[11px] text-red-500 font-medium mt-0.5">{activeError}</p>
      )}
    </div>
  )
}
