/**
 * Koordinat kampus utama untuk perhitungan jarak pekerjaan mikro mahasiswa.
 * Perkiraan UNNES Sekaran, Gunungpati, Semarang (verifikasi di Google Maps).
 */
export const CAMPUS = {
  name: 'Universitas Negeri Semarang',
  campusName: 'UNNES Sekaran',
  lat: -7.0504, // perkiraan UNNES Sekaran (verifikasi di Google Maps)
  lng: 110.3998, // perkiraan UNNES Sekaran (verifikasi di Google Maps)
} as const

export type CampusLocation = typeof CAMPUS
