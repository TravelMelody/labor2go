'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Trash2, AlertCircle } from 'lucide-react'
import { validateAvatarFile } from '@/lib/avatar'

interface AvatarUploadFieldProps {
  currentUrl: string | null
  pendingFile: File | null
  markedForRemoval?: boolean
  initials: string
  onFileSelect: (file: File | null) => void
  onRemove?: () => void
  disabled?: boolean
  label?: string
  helperText?: string
}

export function AvatarUploadField({
  currentUrl,
  pendingFile,
  markedForRemoval = false,
  initials,
  onFileSelect,
  onRemove,
  disabled = false,
  label = 'Foto Profil',
  helperText = 'Format JPG, PNG, atau WEBP. Otomatis diperkecil agar ringan.',
}: AvatarUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const pendingPreviewUrl = useMemo(() => {
    if (!pendingFile) return null
    return URL.createObjectURL(pendingFile)
  }, [pendingFile])

  useEffect(() => {
    if (!pendingPreviewUrl) return
    return () => {
      URL.revokeObjectURL(pendingPreviewUrl)
    }
  }, [pendingPreviewUrl])

  const displayUrl =
    pendingPreviewUrl || (!markedForRemoval ? currentUrl : null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null)
    const selected = e.target.files?.[0]
    if (!selected) return

    const err = validateAvatarFile(selected)
    if (err) {
      setErrorMsg(err)
      e.target.value = ''
      return
    }

    onFileSelect(selected)
    e.target.value = ''
  }

  const handleRemove = () => {
    setErrorMsg(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    if (pendingFile) {
      onFileSelect(null)
      return
    }
    onRemove?.()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#0B1C30]">{label}</span>
        <span className="text-[10px] text-gray-500 font-medium">
          Maks. 1 MB setelah kompresi
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        <div className="relative w-18 h-18 rounded-full overflow-hidden bg-[#FFEDE0] text-[#FF6B00] border border-orange-200/80 flex items-center justify-center font-extrabold text-xl shrink-0 shadow-inner">
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt={label}
              fill
              className="object-cover"
              sizes="72px"
              unoptimized
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFEDE0] hover:bg-[#FFE0C8] text-[#FF6B00] text-xs font-bold transition-colors active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{displayUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
            </button>

            {displayUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            )}
          </div>

          {helperText && (
            <p className="text-[11px] text-gray-500 leading-snug">{helperText}</p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
