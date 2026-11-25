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
  title: 'Syarat & Ketentuan – Labor2Go',
  description: 'Syarat dan Ketentuan penggunaan marketplace tenaga kerja mikro Labor2Go',
}

interface LegalSection {
  pasal: string
  title: string
  paragraphs: string[]
}

const TERMS_SECTIONS: LegalSection[] = [
  {
    pasal: 'Pasal 1',
    title: 'Definisi dan Ruang Lingkup Layanan',
    paragraphs: [
      `${APP_NAME} adalah platform marketplace tenaga kerja mikro yang mempertemukan pelaku Usaha Mikro, Kecil, dan Menengah (selanjutnya disebut "Merchant") dengan mahasiswa pencari kerja paruh waktu singkat (selanjutnya disebut "Mahasiswa").`,
      `${APP_NAME} berperan sebagai perantara teknologi dan pengelola alur transaksi di dalam aplikasi. ${APP_NAME} bukan pemberi kerja, bukan agen penyalur tenaga kerja tetap, dan tidak menciptakan hubungan kerja tetap (PKWT/PKWTT) antara ${APP_NAME}, Merchant, maupun Mahasiswa.`,
    ],
  },
  {
    pasal: 'Pasal 2',
    title: 'Pendaftaran Akun, Peran, dan Verifikasi',
    paragraphs: [
      'Setiap alamat email hanya dapat didaftarkan untuk satu peran pengguna, yaitu sebagai Mahasiswa atau Merchant.',
      'Akun Mahasiswa diverifikasi oleh admin menggunakan data diri serta foto Kartu Tanda Mahasiswa (KTM), sedangkan akun Merchant diverifikasi oleh admin menggunakan data usaha dan foto tempat usaha.',
      'Setelah akun berstatus terverifikasi oleh admin, data identitas utama—meliputi nama lengkap, NIM, kampus, dan foto KTM bagi Mahasiswa, serta nama usaha dan foto usaha bagi Merchant—terkunci secara otomatis di dalam sistem dan tidak dapat diubah secara mandiri.',
      'Jika pengajuan verifikasi ditolak, pengguna dapat meninjau catatan penolakan, memperbaiki data sesuai alasan yang diberikan, dan mengajukan verifikasi ulang melalui halaman Keamanan & Verifikasi.',
    ],
  },
  {
    pasal: 'Pasal 3',
    title: 'Biaya Layanan, Sistem Escrow, dan Pengembalian Dana',
    paragraphs: [
      'Merchant menanggung pembayaran upah Mahasiswa serta biaya layanan platform per pekerja sesuai nominal yang tertera saat memasang lowongan.',
      'Saldo Merchant sebesar upah pekerja ditambah biaya layanan per pekerja akan ditahan sementara dalam sistem escrow ketika Merchant menerima lamaran Mahasiswa.',
      'Dana escrow dicairkan menjadi saldo dompet Mahasiswa setelah Mahasiswa menyelesaikan pekerjaan dan Merchant menekan tombol Konfirmasi Selesai.',
      'Pengembalian dana penuh (100% upah beserta biaya layanan) ke saldo dompet Merchant berlaku apabila Merchant membatalkan lowongan sebelum pekerjaan dimulai (belum ada pekerja yang melakukan check-in) atau apabila Mahasiswa yang diterima dilaporkan tidak hadir.',
    ],
  },
  {
    pasal: 'Pasal 4',
    title: 'Kehadiran (Check-in/Check-out) dan Ketidakhadiran',
    paragraphs: [
      'Mahasiswa yang telah diterima wajib melakukan check-in melalui aplikasi yang dibuka mulai 30 menit sebelum jam mulai pekerjaan hingga sebelum jam selesai, serta melakukan check-out setelah tugas diselesaikan.',
      'Apabila Mahasiswa belum melakukan check-in lebih dari 30 menit setelah jam mulai pekerjaan, Merchant berhak melaporkan ketidakhadiran (tidak hadir) melalui halaman detail lowongan.',
      'Pelaporan ketidakhadiran secara otomatis mengembalikan dana escrow secara penuh ke saldo Merchant, membatalkan penugasan Mahasiswa pada lowongan tersebut, dan menambah catatan jumlah ketidakhadiran pada profil Mahasiswa.',
    ],
  },
  {
    pasal: 'Pasal 5',
    title: 'Pengisian Saldo dan Penarikan Dana',
    paragraphs: [
      'Pengisian saldo (top-up) dompet Merchant diproses melalui penyedia gerbang pembayaran Midtrans. Pada versi prototipe aplikasi ini, pembayaran top-up berjalan pada mode uji coba (sandbox).',
      'Penarikan saldo (withdrawal) oleh Mahasiswa memiliki batas minimal sebesar Rp 10.000 per pengajuan dan diproses oleh admin. Pada versi uji coba ini, pemrosesan penarikan dana oleh admin bersifat simulasi.',
    ],
  },
  {
    pasal: 'Pasal 6',
    title: 'Ulasan dan Penilaian',
    paragraphs: [
      'Merchant dan Mahasiswa hanya dapat memberikan ulasan setelah pekerjaan selesai dan dana upah dinyatakan telah dibayarkan.',
      'Penilaian diberikan dalam rentang 1 sampai 5 bintang beserta komentar opsional. Ulasan yang telah dikirimkan bersifat final dan tidak dapat diedit maupun dihapus oleh pengirim.',
    ],
  },
  {
    pasal: 'Pasal 7',
    title: 'Larangan Penggunaan',
    paragraphs: [
      `Pengguna dilarang melakukan kesepakatan atau transaksi pembayaran di luar aplikasi ${APP_NAME} dengan tujuan menghindari biaya layanan platform.`,
      'Pengguna dilarang mendaftarkan identitas, KTM, foto usaha, atau informasi lowongan yang palsu maupun menyesatkan.',
      'Merchant dilarang memasang lowongan dan Mahasiswa dilarang menerima pekerjaan yang melanggar hukum, bersifat ilegal, menipu, atau membahayakan keselamatan.',
    ],
  },
  {
    pasal: 'Pasal 8',
    title: 'Kontak dan Perubahan Ketentuan',
    paragraphs: [
      `Ketentuan ini dapat diperbarui seiring pengembangan proyek prototipe ${APP_NAME}. Untuk pertanyaan atau pelaporan terkait Syarat & Ketentuan, hubungi kami melalui email: ${SUPPORT_EMAIL}.`,
    ],
  },
]

export default function LegalTermsPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col">
        <PublicBackHeader title="Syarat & Ketentuan" subtitle={APP_NAME} />

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
            {TERMS_SECTIONS.map((section) => (
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
              href="/legal/privacy"
              className="text-[#FF6B00] hover:underline"
            >
              Kebijakan Privasi
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
