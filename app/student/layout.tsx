import React from 'react'
import { StudentBottomNav } from '@/components/student/StudentBottomNav'

export const metadata = {
  title: 'Beranda Mahasiswa – Labor2Go',
  description: 'Area Mahasiswa Labor2Go - Kerja Mikro Fleksibel Sekitar Kampus',
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col relative pb-24 shadow-xs">
        {children}
        <StudentBottomNav />
      </div>
    </div>
  )
}
