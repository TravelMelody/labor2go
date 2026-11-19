import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Labor2Go – Solusi Kerja Mikro Mahasiswa & UMKM",
  description: "Marketplace tenaga kerja mikro untuk mahasiswa dan UMKM sekitar kampus",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F8F9FF] text-[#0B1C30]">
        {children}
      </body>
    </html>
  );
}
