import type { SupabaseClient } from '@supabase/supabase-js'

export const AVATAR_BUCKET = 'avatars'
export const AVATAR_MAX_BYTES = 1024 * 1024 // 1 MB (batas bucket avatars)
export const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024 // 5 MB sebelum kompresi
export const ALLOWED_AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

const MAX_AVATAR_DIMENSION = 512

export interface CompressedAvatarResult {
  blob: Blob
  contentType: 'image/webp' | 'image/jpeg'
  ext: 'webp' | 'jpg'
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/webp' | 'image/jpeg',
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => resolve({ img, revoke: () => URL.revokeObjectURL(url) })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('File gambar tidak dapat dibaca.'))
    }
    img.src = url
  })
}

/**
 * Validasi dasar file gambar avatar sebelum diproses.
 */
export function validateAvatarFile(file: File): string | null {
  if (
    !ALLOWED_AVATAR_TYPES.includes(
      file.type as (typeof ALLOWED_AVATAR_TYPES)[number]
    )
  ) {
    return 'Format foto harus JPG, PNG, atau WEBP.'
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    return 'Ukuran foto terlalu besar. Maksimal 5 MB sebelum kompresi.'
  }
  return null
}

/**
 * Mengecilkan dan mengompres gambar profil di browser menjadi maksimal 512x512 px
 * dengan ukuran hasil di bawah 1 MB agar sesuai batas bucket 'avatars'.
 */
export async function compressAvatarImage(
  file: File
): Promise<CompressedAvatarResult> {
  const validationError = validateAvatarFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const { img, revoke } = await loadImageFromFile(file)
  try {
    const srcW = img.naturalWidth || img.width
    const srcH = img.naturalHeight || img.height
    if (!srcW || !srcH) {
      throw new Error('Dimensi gambar tidak valid.')
    }

    const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(srcW, srcH))
    const targetW = Math.max(1, Math.round(srcW * scale))
    const targetH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Browser tidak mendukung pemrosesan gambar.')
    }
    ctx.drawImage(img, 0, 0, targetW, targetH)

    const attempts: Array<{
      type: 'image/webp' | 'image/jpeg'
      ext: 'webp' | 'jpg'
      quality: number
    }> = [
      { type: 'image/webp', ext: 'webp', quality: 0.85 },
      { type: 'image/webp', ext: 'webp', quality: 0.7 },
      { type: 'image/jpeg', ext: 'jpg', quality: 0.85 },
      { type: 'image/jpeg', ext: 'jpg', quality: 0.65 },
    ]

    for (const attempt of attempts) {
      const blob = await canvasToBlob(canvas, attempt.type, attempt.quality)
      if (blob && blob.type === attempt.type && blob.size <= AVATAR_MAX_BYTES) {
        return {
          blob,
          contentType: attempt.type,
          ext: attempt.ext,
        }
      }
    }

    throw new Error(
      'Ukuran foto setelah kompresi masih melebihi 1 MB. Gunakan foto lain yang lebih kecil.'
    )
  } finally {
    revoke()
  }
}

/**
 * Mengunggah foto profil ke bucket publik 'avatars' dan mengembalikan URL publik ber-versi.
 */
export async function uploadAvatarFile(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  const { blob, contentType, ext } = await compressAvatarImage(file)
  const filePath = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, blob, {
      upsert: true,
      contentType,
    })

  if (uploadError) {
    throw new Error(`Gagal mengunggah foto profil: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath)

  return `${publicUrl}?v=${Date.now()}`
}
