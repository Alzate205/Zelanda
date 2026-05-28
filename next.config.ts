import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['gyburlhzvisgmdmfkqhx.supabase.co', 'lh3.googleusercontent.com'],
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
