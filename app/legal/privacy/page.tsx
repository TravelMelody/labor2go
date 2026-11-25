import React from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import {
  APP_NAME,
  APP_VERSION,
  LEGAL_LAST_UPDATED,
  SUPPORT_EMAIL,
} from '@/lib/config'
import { PublicBackHeader } from '@/components/shared/PublicBackHeader'

export const metadata = {
  title: 'Kebijakan Privasi – Labor2Go',
  description: 'Kebijakan Privasi dan Pelindungan Data Pribadi pengguna Labor2Go',
}

interface PrivacySection {
  pasal: string
  title: string
  paragraphs: string[]
}

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    pasal: 'Pasal 1',
    title: 'Komitmen dan Acuan Hukum',
    paragraphs: [
      `${APP_NAME} berkomitmen melindungi privasi dan data pribadi pengguna. Kebijakan Privasi ini disusun dengan mengacu pada prinsip-prinsip dalam Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).`,
    ],
  },
  {
    pasal: 'Pasal 2',
    title: 'Data Pribadi yang Dikumpulkan',
    paragraphs: [
      'Data akun dan profil umum: nama lengkap, alamat email, nomor HP, serta peran pengguna (Mahasiswa atau Merchant).',
      'Data khusus Mahasiswa: Nomor Induk Mahasiswa (NIM), nama kampus/universitas, keahlian, dan foto Kartu Tanda Mahasiswa (KTM).',
      'Data khusus Merchant: nama usaha, kategori usaha, foto usaha, serta alamat dan koordinat lokasi usaha.',
      'Data aktivitas dan transaksi: riwayat lowongan, lamaran, waktu check-in/check-out, saldo dan mutasi dompet, pembayaran melalui gerbang pembayaran, pengajuan penarikan saldo, serta ulasan dan rating.',
    ],
  },
  {
    pasal: 'Pasal 3',
    title: 'Tujuan Pemrosesan Data',
    paragraphs: [
      'Operasional layanan: menampilkan lowongan kepada mahasiswa yang relevan, memproses lamaran, mencatat kehadiran kerja, serta mengelola pencairan upah dan ulasan.',
      'Verifikasi dan keamanan: memeriksa keaslian identitas Mahasiswa (KTM) dan keabsahan usaha Merchant oleh admin, mencegah penyalahgunaan akun, serta menjaga transparansi penahanan dana escrow.',
      'Dukungan pengguna: menindaklanjuti pertanyaan, laporan ketidakhadiran, atau permintaan bantuan melalui kontak resmi tim.',
    ],
  },
  {
    pasal: 'Pasal 4',
    title: 'Penyimpanan Privat Foto KTM dan Data Terkunci',
    paragraphs: [
      'Foto KTM Mahasiswa disimpan pada penyimpanan privat (private storage) dan hanya dapat diakses oleh pemilik akun yang bersangkutan serta admin untuk keperluan verifikasi melalui tautan sementara berbatas waktu.',
      'Setelah akun terverifikasi oleh admin, data identitas utama (nama, NIM, kampus, foto KTM bagi Mahasiswa; nama usaha dan foto usaha bagi Merchant) dikunci agar keabsahan identitas tetap terjaga.',
    ],
  },
  {
    pasal: 'Pasal 5',
    title: 'Penyimpanan Cloud, Mitra Pembayaran, dan Larangan Penjualan Data',
    paragraphs: [
      'Data aplikasi disimpan pada layanan infrastruktur cloud Supabase dengan kontrol akses berbasis peran (Row Level Security).',
      'Pemrosesan transaksi pengisian saldo (top-up) Merchant diteruskan kepada penyedia layanan pembayaran Midtrans (berjalan pada mode sandbox/uji coba pada versi prototipe).',
      `${APP_NAME} tidak menjual, menyewakan, atau memperdagangkan data pribadi pengguna kepada pihak ketiga mana pun.`,
    ],
  },
  {
    pasal: 'Pasal 6',
    title: 'Hak Pengguna atas Data Pribadi',
    paragraphs: [
      'Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, pengguna berhak memperoleh informasi serta akses terhadap data pribadinya, mengajukan koreksi atau pembaruan data profil yang tidak akurat, dan mengajukan permohonan penghapusan data pribadi atau akun.',
      `Untuk data yang berstatus terkunci setelah verifikasi maupun permintaan akses, koreksi, atau penghapusan data, pengguna dapat menghubungi kami melalui email: ${SUPPORT_EMAIL}.`,
    ],
  },
]

export default function LegalPrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col">
        <PublicBackHeader title="Kebijakan Privasi" subtitle={APP_NAME} />

        <main className="flex-1 px-4 pt-4 pb-10 flex flex-col gap-4">
          {/* Disclaimer & Last Updated Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5">
            <Info className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed font-medium">
              Draft untuk keperluan proyek kuliah Technopreneurship, bukan
              nasihat hukum. Terakhir diperbarui: {LEGAL_LAST_UPDATED}
            </p>
          </div>

          {/* Articles */}
          <div className="flex flex-col gap-3">
            {PRIVACY_SECTIONS.map((section) => (
              <section
                key={section.pasal}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col gap-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B00]">
                    {section.pasal}
                  </span>
                  <h2 className="text-sm font-bold text-[#0B1C30] leading-snug">
                    {section.title}
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {section.paragraphs.map((text, idx) => (
                    <p
                      key={idx}
                      className="text-xs text-gray-600 leading-relaxed"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Bottom Navigation Links */}
          <div className="flex items-center justify-center gap-4 pt-2 text-xs font-semibold">
            <Link
              href="/legal/terms"
              className="text-[#FF6B00] hover:underline"
            >
              Syarat &amp; Ketentuan
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/help" className="text-[#FF6B00] hover:underline">
              Pusat Bantuan
            </Link>
          </div>

          <p className="text-center text-[11px] font-medium text-gray-400">
            {APP_NAME} v{APP_VERSION}
          </p>
        </main>
      </div>
    </div>
  )
}
