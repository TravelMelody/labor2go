import React from 'react'
import Link from 'next/link'
import { HelpCircle, Mail, FileText, Shield, ChevronRight } from 'lucide-react'
import { APP_NAME, APP_VERSION, SUPPORT_EMAIL } from '@/lib/config'
import { PublicBackHeader } from '@/components/shared/PublicBackHeader'
import { HelpFaqAccordion, type FaqItem } from '@/components/help/HelpFaqAccordion'

export const metadata = {
  title: 'Pusat Bantuan – Labor2Go',
  description: 'Pertanyaan umum (FAQ) dan informasi kontak dukungan Labor2Go',
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'cara-melamar',
    question: 'Bagaimana cara melamar lowongan?',
    answer:
      'Masuk sebagai Mahasiswa, lalu pilih lowongan yang masih berstatus terbuka di halaman Beranda atau Eksplorasi. Periksa jadwal kerja, lokasi usaha, dan upah per orang, kemudian tekan tombol "Lamar Sekarang". Lamaran Anda akan berstatus menunggu hingga diterima atau ditolak oleh pemilik usaha (merchant). Selama masih menunggu, Anda dapat membatalkan lamaran kapan saja.',
  },
  {
    id: 'kapan-upah-cair',
    question: 'Kapan upah pekerjaan cair?',
    answer:
      'Saat hari pelaksanaan, mahasiswa melakukan check-in mulai 30 menit sebelum jam mulai melalui aplikasi dan check-out setelah tugas selesai. Setelah Anda check-out, merchant akan menekan tombol "Konfirmasi Selesai" di halaman detail lowongan. Begitu dikonfirmasi, upah langsung masuk ke saldo dompet mahasiswa Anda.',
  },
  {
    id: 'apa-itu-escrow',
    question: 'Apa itu escrow (dana ditahan)?',
    answer:
      'Escrow adalah sistem penahanan dana sementara oleh Labor2Go untuk melindungi merchant dan mahasiswa. Ketika merchant menerima seorang pelamar, saldo dompet merchant sebesar upah pekerja ditambah biaya layanan per pekerja langsung ditahan di escrow. Dana tersebut hanya akan dicairkan kepada mahasiswa setelah pekerjaan selesai, atau dikembalikan penuh ke merchant jika dibatalkan atau mahasiswa tidak hadir.',
  },
  {
    id: 'akun-belum-terverifikasi',
    question: 'Kenapa akun saya belum terverifikasi?',
    answer:
      'Setiap akun baru — baik mahasiswa (menggunakan foto KTM, NIM, dan kampus) maupun merchant (menggunakan data dan foto usaha) — ditinjau secara manual oleh admin. Jika status masih menunggu, harap tunggu proses pemeriksaan admin. Jika status ditolak, lihat catatan penolakan di menu Akun -> Keamanan & Verifikasi, perbaiki data atau foto yang diminta, lalu ajukan verifikasi ulang.',
  },
  {
    id: 'cara-batalkan-lowongan',
    question: 'Bagaimana cara membatalkan lowongan?',
    answer:
      'Merchant dapat membatalkan lowongan yang masih berstatus Terbuka atau Terisi (selama belum ada pekerja yang melakukan check-in) melalui menu Kelola Tugas atau halaman Detail Lowongan dengan menekan tombol "Batalkan". Seluruh dana escrow yang sudah ditahan untuk lowongan tersebut akan dikembalikan 100% (termasuk biaya layanan) ke saldo dompet merchant.',
  },
  {
    id: 'mahasiswa-tidak-hadir',
    question: 'Apa yang terjadi jika mahasiswa tidak hadir?',
    answer:
      'Apabila mahasiswa yang sudah diterima belum melakukan check-in lebih dari 30 menit setelah jam mulai pekerjaan, merchant dapat menekan tombol laporkan "Tidak Hadir" di halaman detail lowongan. Dana escrow (upah + biaya layanan) akan dikembalikan penuh ke saldo dompet merchant, dan catatan ketidakhadiran (no-show) mahasiswa akan bertambah.',
  },
  {
    id: 'cara-tarik-saldo',
    question: 'Bagaimana cara tarik saldo?',
    answer:
      'Mahasiswa dapat mengajukan penarikan saldo melalui menu Dana (Dompet) -> Tarik Saldo dengan memilih tujuan pencairan, memasukkan nomor rekening/e-wallet, dan nominal minimal Rp 10.000. Permintaan penarikan diproses oleh admin. Pada versi uji coba/prototipe ini, proses pencairan oleh admin bersifat simulasi.',
  },
]

export default function HelpPage() {
  const isMailtoAvailable = SUPPORT_EMAIL.includes('@')

  return (
    <div className="min-h-screen bg-[#F8F9FF] text-[#0B1C30] flex flex-col items-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F8F9FF] flex flex-col">
        <PublicBackHeader
          title="Pusat Bantuan"
          subtitle="FAQ & kontak dukungan"
        />

        <main className="flex-1 px-4 pt-4 pb-10 flex flex-col gap-5">
          {/* Hero Intro */}
          <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-extrabold text-[#0B1C30]">
                Ada yang bisa kami bantu?
              </h2>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Temukan jawaban seputar alur lamaran, penahanan dana escrow,
                verifikasi akun, dan penarikan saldo di {APP_NAME}.
              </p>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="flex flex-col gap-2.5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Pertanyaan Umum (FAQ)
            </h2>
            <HelpFaqAccordion items={FAQ_ITEMS} />
          </section>

          {/* Contact Card */}
          <section className="flex flex-col gap-2.5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Kontak Bantuan
            </h2>
            <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] text-[#0B1C30] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#0B1C30]">
                    Email Dukungan Tim {APP_NAME}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Untuk kendala verifikasi, komplain pekerjaan, atau pertanyaan
                    lainnya, hubungi kami melalui email berikut:
                  </p>
                  {isMailtoAvailable ? (
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="inline-block mt-2 text-xs font-bold text-[#FF6B00] hover:underline break-all"
                    >
                      {SUPPORT_EMAIL}
                    </a>
                  ) : (
                    <p className="mt-2 inline-block px-2.5 py-1 rounded-lg bg-[#F8F9FF] border border-gray-200 text-xs font-bold text-[#0B1C30] break-all">
                      {SUPPORT_EMAIL}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Legal Links */}
          <section className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_-2px_rgba(26,43,76,0.06)] overflow-hidden divide-y divide-gray-100">
            <Link
              href="/legal/terms"
              className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F8F9FF] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <span className="text-xs font-bold text-[#0B1C30]">
                  Syarat &amp; Ketentuan
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </Link>
            <Link
              href="/legal/privacy"
              className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F8F9FF] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFEDE0] text-[#FF6B00] flex items-center justify-center shrink-0">
                  <Shield className="w-4.5 h-4.5" />
                </div>
                <span className="text-xs font-bold text-[#0B1C30]">
                  Kebijakan Privasi
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </Link>
          </section>

          <p className="text-center text-[11px] font-medium text-gray-400 pt-1">
            {APP_NAME} v{APP_VERSION}
          </p>
        </main>
      </div>
    </div>
  )
}
