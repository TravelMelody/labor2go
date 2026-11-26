import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lengkapi Profil – Labor2Go',
  description:
    'Lengkapi data profil Mahasiswa atau Usaha UMKM untuk mulai menggunakan Labor2Go',
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
