import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pasang Lowongan – Labor2Go',
  description:
    'Buat dan publikasikan lowongan kerja mikro untuk mahasiswa sekitar kampus',
}

export default function MerchantPostLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
