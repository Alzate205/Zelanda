import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistroSW } from "@/components/shared/RegistroSW";

export const metadata: Metadata = {
  title: {
    default: "La Zelanda",
    template: "%s · La Zelanda",
  },
  description:
    "Gestión integral de la Hacienda La Zelanda: lotes, árboles, tareas del campo, equipo, cosecha, ventas y finanzas. Funciona sin conexión.",
  applicationName: "La Zelanda",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "La Zelanda",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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
