import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistroSW } from "@/components/shared/RegistroSW";

export const metadata: Metadata = {
  title: {
    default: "La Zelanda",
    template: "%s · La Zelanda",
  },
  description: "Sistema de gestión integral para Hacienda La Zelanda",
  applicationName: "FincApp",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "La Zelanda",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3D5C42",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-zelanda-beige-50 text-zelanda-verde-900 antialiased">
        {children}
        <RegistroSW />
      </body>
    </html>
  );
}
