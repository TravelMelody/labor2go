import React, { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Clock } from 'lucide-react'

export const metadata = {
  title: 'Kelola Pelamar – Labor2Go',
  description: 'Kelola pelamar lowongan UMKM Labor2Go',
}

async function MerchantManageApplicantsContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col px-4 pt-6 pb-8 shadow-xs">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/jobs/${id}`}
          className="w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-[#0B1C30] hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
          aria-label="Kembali ke detail lowongan"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-[#0B1C30]">Kelola Pelamar</h1>
          <p className="text-[11px] text-gray-500 truncate max-w-[240px]">
            ID Lowongan: {id}
          </p>
        </div>
      </div>

      {/* Placeholder Box */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-gray-100 shadow-xs my-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-4 shadow-inner">
          <Users className="w-8 h-8 stroke-[2]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-bold mb-3">
          <Clock className="w-3.5 h-3.5" />
          <span>Segera hadir</span>
        </div>

        <h2 className="text-base font-bold text-[#0B1C30] mb-2">
          Manajemen Pelamar Mahasiswa
        </h2>

        <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6">
          Fitur seleksi, persetujuan (accept), dan penolakan (reject) pelamar mahasiswa akan segera hadir untuk memudahkan pemilik usaha.
        </p>

        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Link
            href={`/jobs/${id}`}
            className="w-full py-2.5 bg-[#FF6B00] text-white rounded-full text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-transform text-center"
          >
            Lihat Tampilan Lowongan
          </Link>
          <Link
            href="/merchant"
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-bold active:scale-95 transition-colors text-center"
          >
            Kembali ke Dashboard Merchant
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function MerchantManageApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-xs text-gray-400">
            Memuat data...
          </div>
        }
      >
        <MerchantManageApplicantsContent params={params} />
      </Suspense>
    </div>
  )
}
