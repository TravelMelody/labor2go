import { CAMPUS, CampusLocation } from './campus'

/**
 * Menghitung jarak garis lurus antara dua titik koordinat bumi (latitude/longitude)
 * menggunakan rumus Haversine (hasil dalam satuan kilometer).
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Radius bumi dalam kilometer
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format jarak:
 * - Jika < 1 km: dalam meter, misal "500m" atau "300m"
 * - Jika >= 1 km: dalam km dengan 1 desimal, misal "1.2 km"
 */
export function formatDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || isNaN(distanceKm) || distanceKm < 0) {
    return null
  }

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000)
    return `${meters}m`
  }

  return `${distanceKm.toFixed(1)} km`
}

/**
 * Menghitung dan memformat jarak dari kampus ke lokasi lowongan.
 * Jika koordinat lat atau lng bernilai null/undefined, mengembalikan null.
 *
 * @param lat Latitude pekerjaan
 * @param lng Longitude pekerjaan
 * @param campus Koordinat acuan kampus (default CAMPUS UNNES)
 * @param withSuffix Menambahkan teks " dari kampus" (default true)
 */
export function getDistanceFromCampus(
  lat: number | null | undefined,
  lng: number | null | undefined,
  campus: CampusLocation = CAMPUS,
  withSuffix: boolean = true
): string | null {
  if (lat == null || lng == null) {
    return null
  }

  const distanceKm = calculateHaversineDistance(campus.lat, campus.lng, lat, lng)
  const formatted = formatDistance(distanceKm)

  if (!formatted) return null
  return withSuffix ? `${formatted} dari kampus` : formatted
}
