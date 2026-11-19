/**
 * Konfigurasi tarif dan biaya aplikasi Labor2Go.
 */

// Biaya layanan aplikasi per mahasiswa
export const SERVICE_FEE_PER_WORKER = 5000

// Upah per jam minimum (komentar: harus disesuaikan dengan UMK Kota Semarang)
export const MIN_HOURLY_RATE = 15000

/**
 * Mengecek apakah upah per jam memenuhi atau melebihi standar UMR
 * @param payAmount Upah per mahasiswa (Rp)
 * @param durationHours Durasi kerja (jam)
 */
export const isAboveOrEqualUmr = (payAmount: number, durationHours: number): boolean => {
  if (durationHours <= 0) return false
  return payAmount / durationHours >= MIN_HOURLY_RATE
}
