import React, { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { FlashToast } from "@/components/shared/FlashToast";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Labor2Go",
  description:
    "Marketplace tenaga kerja mikro untuk mahasiswa dan UMKM sekitar kampus.",
  icons: {
    icon: "/icon-bebek.png",
    shortcut: "/icon-bebek.png",
    apple: "/icon-bebek.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FF6B00",
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
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
