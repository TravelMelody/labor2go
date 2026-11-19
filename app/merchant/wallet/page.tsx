import React from 'react'
import Link from 'next/link'
import { Wallet, ArrowLeft, Clock } from 'lucide-react'

export const metadata = {
  title: 'Dana & Dompet Mitra – Labor2Go',
  description: 'Kelola saldo escrow dan pembayaran pekerja mikro UMKM Labor2Go',
}

export default function MerchantWalletPage() {
  return (
    <div className="flex-1 flex flex-col px-4 pt-6 pb-24">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/merchant"
          className="w-9 h-9 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-xs"
          aria-label="Kembali ke Beranda"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#0B1C30]">Dana & Dompet Mitra</h1>
          <p className="text-xs text-gray-500">Kelola saldo escrow dan pembayaran tugas</p>
        </div>
      </div>

      {/* Placeholder Box */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-gray-100 shadow-xs my-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center mb-4 shadow-inner">
          <Wallet className="w-8 h-8 stroke-[2]" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6B00] text-xs font-bold mb-2">
          <Clock className="w-3.5 h-3.5" />
          <span>Segera hadir</span>
        </div>
        <h2 className="text-base font-bold text-[#0B1C30] mb-2">
          Dompet Saldo & Escrow UMKM
        </h2>
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6">
          Fitur top-up saldo via QRIS / Virtual Account, pemantauan dana tertahan (escrow), pengembalian otomatis saat batal, dan bukti potong pajak/nota pembayaran sedang disiapkan.
        </p>
        <Link
          href="/merchant"
          className="px-5 py-2.5 bg-[#FF6B00] text-white rounded-full text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-transform"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}
