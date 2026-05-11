import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "La Zelanda",
    template: "%s · La Zelanda",
  },
  description: "Sistema de gestión integral para Hacienda La Zelanda",
  applicationName: "FincApp",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2d4a35",
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
      </body>
    </html>
  );
}
