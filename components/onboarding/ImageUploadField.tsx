'use client'

import React, { useMemo, useRef, useState, ChangeEvent, DragEvent } from 'react'
import Image from 'next/image'
import { UploadCloud, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ImageUploadFieldProps {
  label: string
  description?: string
  required?: boolean
  file: File | null
  onFileChange: (file: File | null) => void
  disabled?: boolean
  error?: string | null
  maxSizeBytes?: number
  accept?: string
}

export function ImageUploadField({
  label,
  description,
  required = false,
  file,
  onFileChange,
  disabled = false,
  error = null,
  maxSizeBytes = 2 * 1024 * 1024, // 2MB
  accept = 'image/jpeg,image/png,image/webp,image/jpg',
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)

  const previewUrl = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])

  React.useEffect(() => {
    if (!previewUrl) return
    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const validateAndSelectFile = (selectedFile: File) => {
    setInternalError(null)

    // Validasi tipe file
    if (!selectedFile.type.startsWith('image/')) {
      setInternalError('Format file tidak didukung. Harap pilih gambar (JPG, PNG, atau WEBP).')
      return
    }

    // Validasi ukuran file (maks 2MB)
    if (selectedFile.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024))
      setInternalError(`Ukuran foto terlalu besar (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB). Maksimal ${maxMb} MB.`)
      return
    }

    onFileChange(selectedFile)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0])
    }
  }

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0])
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFileChange(null)
    setInternalError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const activeError = error || internalError

  return (
    <div className="w-full flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs sm:text-sm font-bold text-[#0B1C30]">
          {label} {required && <span className="text-[#FF6B00]">*</span>}
        </label>
        <span className="text-[11px] text-gray-500 font-medium">Maks. 2 MB</span>
      </div>

      {description && <p className="text-[11px] text-gray-500">{description}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />

      {file && previewUrl ? (
        // Preview State
        <div className="relative w-full rounded-2xl border border-gray-200 bg-white p-3 flex items-center gap-3 shadow-xs">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
            <Image
              src={previewUrl}
              alt={label}
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1C30] truncate">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{file.name}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="text-xs font-semibold text-[#FF6B00] hover:underline"
              >
                Ganti Foto
              </button>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="text-xs font-semibold text-red-500 hover:underline"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Upload Dropzone
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`w-full cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all flex flex-col items-center justify-center gap-2 ${
            dragActive
              ? 'border-[#FF6B00] bg-[#FFEDE0]/40 scale-[1.01]'
              : activeError
              ? 'border-red-300 bg-red-50/40'
              : 'border-gray-200 bg-white hover:border-[#FF6B00]/70 hover:bg-[#FFEDE0]/20'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <div className="w-12 h-12 rounded-full bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs sm:text-sm font-bold text-[#0B1C30]">
              Sentuh untuk unggah foto
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Format JPG, PNG, atau WEBP (maks. 2 MB)
            </p>
          </div>
        </div>
      )}

      {activeError && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium mt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  )
}
