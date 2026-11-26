import React, { Suspense } from 'react'
import { MerchantBottomNav } from '@/components/merchant/MerchantBottomNav'

export const metadata = {
  title: 'Beranda Mitra UMKM – Labor2Go',
  description: 'Area Mitra UMKM Labor2Go - Pasang Lowongan & Kelola Pekerja Mikro',
}

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col relative shadow-xs">
        {children}
        <Suspense fallback={null}>
          <MerchantBottomNav />
        </Suspense>
      </div>
    </div>
  )
}
