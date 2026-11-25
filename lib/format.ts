/**
 * Format angka ke format Rupiah standar Indonesia.
 * Contoh: 150000 -> "Rp 150.000"
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) {
    return 'Rp 0'
  }
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`
}

/**
 * Format tanggal/waktu ke jam WIB (Waktu Indonesia Barat / UTC+7).
 * Contoh: "09:00" atau dengan suffix "09:00 WIB"
 */
export function formatTimeWIB(
  dateInput: string | Date,
  options?: { includeSuffix?: boolean }
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return '-'

  const timeString = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date).replace('.', ':')

  return options?.includeSuffix ? `${timeString} WIB` : timeString
}

/**
 * Format tanggal dan jam transaksi ke WIB:
 * "Hari ini, 09:00 WIB", "Kemarin, 20:30 WIB", atau "15 Sep, 18:00 WIB".
 */
export function formatDateTimeWIB(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return '-'

  const timeWIB = formatTimeWIB(date, { includeSuffix: true })
  if (timeWIB === '-') return '-'

  const now = new Date()
  const toWibDateKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)

  const dateKey = toWibDateKey(date)
  const todayKey = toWibDateKey(now)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayKey = toWibDateKey(yesterday)

  let dayLabel = ''
  if (dateKey === todayKey) {
    dayLabel = 'Hari ini'
  } else if (dateKey === yesterdayKey) {
    dayLabel = 'Kemarin'
  } else {
    const sameYear = dateKey.slice(0, 4) === todayKey.slice(0, 4)
    dayLabel = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(date)
  }

  return `${dayLabel}, ${timeWIB}`
}

/**
 * Format rentang waktu mulai hingga selesai dalam WIB.
 * Contoh: "09:00 - 13:00 WIB"
 */
export function formatTimeRangeWIB(
  startInput: string | Date,
  endInput: string | Date
): string {
  const startTime = formatTimeWIB(startInput, { includeSuffix: false })
  const endTime = formatTimeWIB(endInput, { includeSuffix: false })

  if (startTime === '-' || endTime === '-') return '-'
  return `${startTime} - ${endTime} WIB`
}

/**
 * Format jadwal pekerjaan: "Hari ini / Besok / tanggal singkat, HH:mm - HH:mm WIB"
 * Contoh:
 * - "Hari ini, 20:48 - 22:48 WIB"
 * - "Besok, 09:00 - 12:00 WIB"
 * - "21 Nov, 14:00 - 17:00 WIB"
 */
export function formatJobScheduleWIB(
  startInput: string | Date,
  endInput: string | Date
): string {
  const start = typeof startInput === 'string' ? new Date(startInput) : startInput
  const end = typeof endInput === 'string' ? new Date(endInput) : endInput

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-'

  const timeRange = formatTimeRangeWIB(start, end)
  if (timeRange === '-') return '-'

  const now = new Date()

  // Format YYYY-MM-DD dalam zona waktu WIB (Asia/Jakarta)
  const toWibDateKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)

  const startDateKey = toWibDateKey(start)
  const todayKey = toWibDateKey(now)

  // Tanggal besok dalam WIB
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowKey = toWibDateKey(tomorrow)

  let dayLabel = ''
  if (startDateKey === todayKey) {
    dayLabel = 'Hari ini'
  } else if (startDateKey === tomorrowKey) {
    dayLabel = 'Besok'
  } else {
    dayLabel = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
    }).format(start)
  }

  return `${dayLabel}, ${timeRange}`
}

/**
 * Menghitung durasi jam antara waktu mulai dan selesai.
 * Contoh: 2 jam -> "2 Jam", 2.5 jam -> "2.5 Jam"
 */
export function formatDurationHours(
  startInput: string | Date,
  endInput: string | Date
): string {
  const start = typeof startInput === 'string' ? new Date(startInput) : startInput
  const end = typeof endInput === 'string' ? new Date(endInput) : endInput

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-'

  const diffMs = end.getTime() - start.getTime()
  if (diffMs <= 0) return '0 Jam'

  const hours = diffMs / (1000 * 60 * 60)
  // Tampilkan desimal hanya jika bukan bilangan bulat
  const formattedHours = hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)
  return `${formattedHours} Jam`
}

/**
 * Mengambil nama depan dari nama lengkap.
 * Contoh: "Bagas Pratama" -> "Bagas"
 */
export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return 'Mahasiswa'
  const first = fullName.trim().split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/**
 * Menentukan badge Shift berdasarkan jam mulai dalam zona waktu WIB (Asia/Jakarta):
 * - Jam < 12: "Shift Pagi"
 * - Jam 12 s/d 17: "Shift Siang"
 * - Jam >= 18: "Shift Malam"
 */
export function getShiftBadge(startInput: string | Date): string {
  const date = typeof startInput === 'string' ? new Date(startInput) : startInput
  if (isNaN(date.getTime())) return 'Shift Pagi'

  const hourWIB = parseInt(
    new Intl.DateTimeFormat('id-ID', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    }).format(date),
    10
  )

  if (hourWIB < 12) {
    return 'Shift Pagi'
  } else if (hourWIB >= 12 && hourWIB < 18) {
    return 'Shift Siang'
  } else {
    return 'Shift Malam'
  }
}

/**
 * Menentukan apakah pekerjaan mendesak (mulai kurang dari 60 menit dari sekarang).
 */
export function isUrgentJob(startInput: string | Date, nowMs?: number): boolean {
  const start = typeof startInput === 'string' ? new Date(startInput) : startInput
  if (isNaN(start.getTime())) return false

  const now = nowMs ?? Date.now()
  const diffMs = start.getTime() - now
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  return diffMinutes > 0 && diffMinutes <= 60
}

/**
 * Membuat tautan WhatsApp resmi (wa.me) dengan nomor yang diformat standar internasional (62).
 */
export function formatWhatsAppUrl(
  phone: string | null | undefined,
  message?: string
): string | null {
  if (!phone) return null

  // Bersihkan karakter non-digit
  let cleaned = phone.replace(/\D/g, '')

  // Konversi awalan 08xxx menjadi 628xxx
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned
  }

  // Validasi panjang minimum nomor telepon Indonesia yang valid (biasanya 10-15 digit)
  if (cleaned.length < 9) return null

  const baseUrl = `https://wa.me/${cleaned}`
  if (message && message.trim()) {
    return `${baseUrl}?text=${encodeURIComponent(message.trim())}`
  }

  return baseUrl
}

