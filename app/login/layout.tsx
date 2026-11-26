import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Masuk – Labor2Go',
  description: 'Masuk atau daftar sebagai Mahasiswa atau Mitra UMKM di Labor2Go',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
