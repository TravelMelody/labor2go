import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { CAMPUS } from '@/lib/campus'
import { getDistanceFromCampus } from '@/lib/geo'
import { formatJobScheduleWIB } from '@/lib/format'

export interface PublicJobItem {
  id: string
  title: string
  locationName: string | null
  distanceText: string | null
  scheduleText: string
  payAmount: number
  slotsLeft: number
  businessName: string
  businessType: string | null
  merchantPhoto: string | null
  avgRating: number | null
  reviewCount: number
}

interface PublicJobsFeedRow {
  id: string
  title: string
  location_name: string | null
  lat: number | null
  lng: number | null
  start_at: string
  end_at: string
  pay_amount: number
  slots_left: number
  business_name: string | null
  business_type: string | null
  merchant_photo: string | null
  avg_rating: number | null
  review_count: number | null
}

export async function getPublicLatestJobs(
  limit = 10
): Promise<PublicJobItem[]> {
  try {
    const supabase = await createClient()

    const { data: rows, error } = await supabase
      .from('public_jobs_feed')
      .select(
        'id, title, location_name, lat, lng, start_at, end_at, pay_amount, slots_left, business_name, business_type, merchant_photo, avg_rating, review_count'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn(
        'Peringatan saat memuat lowongan publik:',
        error.message || 'Gagal memuat data lowongan'
      )
      return []
    }

    const feedRows = (rows ?? []) as PublicJobsFeedRow[]
    if (feedRows.length === 0) {
      return []
    }

    return feedRows.map((row) => ({
      id: row.id,
      title: row.title,
      locationName: row.location_name,
      distanceText: getDistanceFromCampus(row.lat, row.lng, CAMPUS),
      scheduleText: formatJobScheduleWIB(row.start_at, row.end_at),
      payAmount: Number(row.pay_amount ?? 0),
      slotsLeft: Number(row.slots_left ?? 0),
      businessName: row.business_name?.trim() || 'Usaha Mitra',
      businessType: row.business_type,
      merchantPhoto: row.merchant_photo || null,
      avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
      reviewCount: Number(row.review_count ?? 0),
    }))
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Kesalahan tidak terduga'
    console.warn('Peringatan saat memuat lowongan publik:', message)
    return []
  }
}
