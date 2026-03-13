import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant-garamond",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ARMA — Autonomous Repository Memory & Actions",
  description: "AI-powered code intelligence that fixes bugs and ships features automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${cormorantGaramond.variable} bg-[#F9F9F9] text-[#111] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
