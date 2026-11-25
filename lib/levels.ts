/**
 * Pemetaan level mahasiswa -> nama tingkat di aplikasi Labor2Go.
 * Ubah label di sini jika nama tingkat perlu disesuaikan.
 */
export const STUDENT_LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula',
  2: 'Rintisan',
  3: 'Andalan',
  4: 'Pro Runner',
  5: 'Legend',
}

/**
 * Mengembalikan nama tingkat berdasarkan level mahasiswa.
 * Level 5 ke atas dipetakan ke 'Legend'.
 */
export function getStudentLevelName(level: number | null | undefined): string {
  const safeLevel = typeof level === 'number' && !Number.isNaN(level) ? level : 1
  if (safeLevel <= 1) return STUDENT_LEVEL_LABELS[1]
  if (safeLevel >= 5) return STUDENT_LEVEL_LABELS[5]
  return STUDENT_LEVEL_LABELS[safeLevel] ?? STUDENT_LEVEL_LABELS[1]
}
