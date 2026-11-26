import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kelola Lowongan – Labor2Go',
  description:
    'Kelola lowongan aktif, pelamar, dan riwayat pekerjaan UMKM di Labor2Go',
}

export default function MerchantJobsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
