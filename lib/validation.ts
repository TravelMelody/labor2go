/**
 * Modul validasi input terpusat (selaras dengan constraint di supabase/19_validation.sql).
 */

const PERSON_NAME_REGEX = /^\p{L}[\p{L} .'-]{1,59}$/u
const INDONESIAN_PHONE_REGEX = /^(\+?62|0)8[0-9]{8,11}$/
const NIM_REGEX = /^[0-9]{6,20}$/
const UNIVERSITY_REGEX = /^\p{L}[\p{L}\p{N} .,&()'-]{2,79}$/u
const SKILL_REGEX = /^\p{L}[\p{L}\p{N} +/&.-]{1,29}$/u
const BUSINESS_NAME_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} .,&()'-]{1,59}$/u
const ADDRESS_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} .,/():'-]{4,199}$/u
const JOB_TITLE_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} .,&()/'-]{2,59}$/u
const CONTROL_CHARS_REGEX = /[\x01-\x08\x0B\x0C\x0E-\x1F]/
const WITHDRAWAL_ACCOUNT_REGEX = /^[0-9]{5,20}$/

export const MAX_SKILLS_COUNT = 10

/**
 * Merapikan spasi berlebih di awal, akhir, dan tengah teks.
 */
export function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Membersihkan spasi, tanda hubung, dan tanda kurung pada nomor telepon.
 */
export function cleanIndonesianPhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, '')
}

export function validatePersonName(
  value: string,
  label = 'Nama lengkap'
): string | null {
  const clean = normalizeSpaces(value)
  if (!clean) return `${label} wajib diisi.`
  if (clean.length < 2) return `${label} minimal 2 karakter.`
  if (clean.length > 60) return `${label} maksimal 60 karakter.`
  if (!PERSON_NAME_REGEX.test(clean)) {
    return `${label} harus diawali huruf dan hanya boleh berisi huruf, spasi, titik (.), apostrof ('), atau tanda hubung (-).`
  }
  return null
}

export function validateIndonesianPhone(value: string): {
  clean: string
  error: string | null
} {
  const clean = cleanIndonesianPhone(value)
  if (!clean) {
    return { clean, error: 'Nomor WhatsApp / HP wajib diisi.' }
  }
  if (!INDONESIAN_PHONE_REGEX.test(clean)) {
    return {
      clean,
      error:
        'Nomor HP tidak valid. Gunakan format 08xx atau +628xx (10–13 digit).',
    }
  }
  return { clean, error: null }
}

export function validateNim(value: string): string | null {
  const clean = value.trim()
  if (!clean) return 'NIM wajib diisi.'
  if (!NIM_REGEX.test(clean)) {
    return 'NIM harus berupa angka 6–20 digit tanpa spasi atau simbol.'
  }
  return null
}

export function validateUniversity(value: string): string | null {
  const clean = normalizeSpaces(value)
  if (!clean) return 'Nama kampus wajib diisi.'
  if (clean.length < 3) return 'Nama kampus minimal 3 karakter.'
  if (clean.length > 80) return 'Nama kampus maksimal 80 karakter.'
  if (!UNIVERSITY_REGEX.test(clean)) {
    return 'Nama kampus harus diawali huruf dan tidak boleh mengandung simbol acak.'
  }
  return null
}

export function validateSkill(value: string): string | null {
  const clean = normalizeSpaces(value)
  if (!clean) return 'Skill tidak boleh kosong.'
  if (clean.length < 2 || clean.length > 30) {
    return 'Setiap skill harus 2–30 karakter.'
  }
  if (!SKILL_REGEX.test(clean)) {
    return 'Skill harus diawali huruf dan hanya boleh berisi huruf, angka, spasi, serta simbol + / & . -'
  }
  return null
}

export function validateSkillsList(skills: string[]): string | null {
  if (!Array.isArray(skills) || skills.length === 0) {
    return 'Pilih atau ketik minimal 1 skill yang kamu miliki.'
  }
  if (skills.length > MAX_SKILLS_COUNT) {
    return `Maksimal ${MAX_SKILLS_COUNT} skill.`
  }
  for (const item of skills) {
    const err = validateSkill(item)
    if (err) return err
  }
  return null
}

export function validateBusinessName(value: string): string | null {
  const clean = normalizeSpaces(value)
  if (!clean) return 'Nama usaha wajib diisi.'
  if (clean.length < 2) return 'Nama usaha minimal 2 karakter.'
  if (clean.length > 60) return 'Nama usaha maksimal 60 karakter.'
  if (!BUSINESS_NAME_REGEX.test(clean)) {
    return 'Nama usaha harus diawali huruf/angka dan tidak boleh mengandung simbol acak.'
  }
  return null
}

export function validateAddress(value: string): string | null {
  const clean = normalizeSpaces(value)
  if (!clean) return null
  if (clean.length < 5) return 'Alamat minimal 5 karakter jika diisi.'
  if (clean.length > 200) return 'Alamat maksimal 200 karakter.'
  if (!ADDRESS_REGEX.test(clean)) {
    return 'Alamat harus diawali huruf/angka dan tidak boleh mengandung simbol acak.'
  }
  return null
}

export function validateJobTitle(value: string): string | null {
  const clean = normalizeSpaces(value)
  if (!clean) return 'Jenis bantuan / judul lowongan wajib diisi.'
  if (clean.length < 3) return 'Judul minimal 3 karakter.'
  if (clean.length > 60) return 'Judul maksimal 60 karakter.'
  if (!JOB_TITLE_REGEX.test(clean)) {
    return 'Judul lowongan harus diawali huruf/angka dan tidak boleh mengandung simbol acak.'
  }
  return null
}

export function validateJobDescription(value: string): string | null {
  const clean = value.trim()
  if (!clean) return null
  if (clean.length > 500) return 'Deskripsi pekerjaan maksimal 500 karakter.'
  if (CONTROL_CHARS_REGEX.test(clean)) {
    return 'Deskripsi mengandung karakter kontrol yang tidak diperbolehkan.'
  }
  return null
}

export function validateWithdrawalAccount(value: string): string | null {
  const clean = value.trim()
  if (!clean) return 'Nomor tujuan penarikan wajib diisi.'
  if (!WITHDRAWAL_ACCOUNT_REGEX.test(clean)) {
    return 'Nomor tujuan harus berupa angka 5–20 digit tanpa spasi atau simbol.'
  }
  return null
}

const CONSTRAINT_ERROR_MESSAGES: Array<[string, string]> = [
  [
    'profiles_full_name_chk',
    'Nama lengkap harus 2–60 karakter, diawali huruf, dan tidak boleh mengandung simbol acak.',
  ],
  [
    'profiles_phone_chk',
    'Nomor HP tidak valid. Gunakan format 08xx atau +628xx (10–13 digit).',
  ],
  [
    'student_nim_chk',
    'NIM harus berupa angka 6–20 digit tanpa spasi atau simbol.',
  ],
  [
    'student_university_chk',
    'Nama kampus harus 3–80 karakter, diawali huruf, dan tanpa simbol acak.',
  ],
  [
    'student_skills_chk',
    'Daftar skill maksimal 10 item (masing-masing 2–30 karakter) tanpa simbol acak.',
  ],
  [
    'umkm_business_name_chk',
    'Nama usaha harus 2–60 karakter dan tidak boleh mengandung simbol acak.',
  ],
  [
    'umkm_address_chk',
    'Alamat usaha harus 5–200 karakter dan tidak boleh mengandung simbol acak.',
  ],
  [
    'jobs_title_chk',
    'Judul lowongan harus 3–60 karakter dan tidak boleh mengandung simbol acak.',
  ],
  [
    'jobs_description_chk',
    'Deskripsi pekerjaan maksimal 500 karakter tanpa karakter kontrol.',
  ],
  [
    'jobs_location_chk',
    'Lokasi lowongan harus 5–200 karakter dan tanpa simbol acak.',
  ],
  [
    'withdrawals_account_chk',
    'Nomor tujuan penarikan harus berupa angka 5–20 digit tanpa spasi atau simbol.',
  ],
  [
    'profiles_avatar_url_chk',
    'URL foto profil tidak valid. Silakan unggah ulang foto profil Anda.',
  ],
]

/**
 * Mengubah error CHECK constraint Postgres (23514) menjadi pesan ramah berbahasa Indonesia.
 */
export function formatValidationConstraintError(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string
): string {
  const msg = error?.message || ''
  if (error?.code === '23514' || msg) {
    for (const [constraintName, friendlyMessage] of CONSTRAINT_ERROR_MESSAGES) {
      if (msg.includes(constraintName)) {
        return friendlyMessage
      }
    }
  }
  return msg || fallback
}
