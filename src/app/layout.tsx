import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Playfair_Display, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--nf-body", display: "swap" });
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--nf-display",
  display: "swap",
});
// La Voz del Rayo: letra de periódico (solo se descarga en las páginas que la usan)
const newsHead = Playfair_Display({ subsets: ["latin"], weight: ["700", "800", "900"], style: ["normal", "italic"], variable: "--nf-news-head", display: "swap", preload: false });
const newsBody = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--nf-news-body", display: "swap", preload: false });
import { RegisterSW } from "@/components/register-sw";
import { Splash } from "@/components/splash";

export const metadata: Metadata = {
  title: { default: "Rayo Vallecañas", template: "%s · Rayo Vallecañas" },
  description: "Plataforma integral de gestión del Rayo Vallecañas",
  applicationName: "Rayo Vallecañas",
  appleWebApp: { capable: true, title: "Rayo", statusBarStyle: "black-translucent" },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable} ${newsHead.variable} ${newsBody.variable}`}>
      <body className="min-h-dvh antialiased">
        <Splash />
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
