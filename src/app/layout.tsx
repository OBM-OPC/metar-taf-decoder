import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "METAR & TAF Decoder",
  description: "Decodieren Sie METAR- und TAF-Wettermeldungen in lesbare Informationen",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${inter.className} ${robotoMono.variable}`}>{children}</body>
    </html>
  );
}
