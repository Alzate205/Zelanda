import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'La Zelanda',
    template: '%s · La Zelanda',
  },
  description:
    'Gestión integral de la Hacienda La Zelanda: lotes, árboles, tareas del campo, equipo, cosecha, ventas y finanzas. Funciona sin conexión.',
  applicationName: 'La Zelanda',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'La Zelanda',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#3D5C42',
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
        <Script id="zelanda-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').catch(function (err) {
                  console.warn('SW registration failed', err);
                });
              });
              // Cuando un SW nuevo toma control (deploy nuevo), recargar una
              // vez: evita quedar con HTML viejo pidiendo chunks que ya no
              // existen, que dejaba la app a medio renderizar. En la primera
              // instalación (no había controlador) NO se recarga, para no
              // cortar flujos como la suscripción a notificaciones.
              var zelandaTeniaControlador = !!navigator.serviceWorker.controller;
              var zelandaRecargado = false;
              navigator.serviceWorker.addEventListener('controllerchange', function () {
                if (!zelandaTeniaControlador) {
                  zelandaTeniaControlador = true;
                  return;
                }
                if (zelandaRecargado) return;
                zelandaRecargado = true;
                window.location.reload();
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
