import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Eksplor Lowongan – Labor2Go',
  description: 'Cari dan filter lowongan kerja mikro fleksibel sekitar kampus',
}

export default function StudentExploreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
