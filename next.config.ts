import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'gyburlhzvisgmdmfkqhx.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  productionBrowserSourceMaps: true,
};

export default withSentryConfig(nextConfig, {
  org: 'zelanda',
  project: 'javascript-nextjs',

  // Silencia errores de Sentry para que no falle el build
  silent: true,

  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Configuración para evitar errores de release
  release: {
    create: false,
    finalize: false,
  },
});
