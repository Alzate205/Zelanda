import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['gyburlhzvisgmdmfkqhx.supabase.co', 'lh3.googleusercontent.com'],
  },

  // ← Muy importante para generar sourcemaps en producción
  productionBrowserSourceMaps: true,
};

export default withSentryConfig(nextConfig, {
  org: 'zelanda',
  project: 'javascript-nextjs',
  silent: !process.env.CI,

  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',

  // ← Nueva sección recomendada
  sourcemaps: {
    deleteSourcemapsAfterUpload: true, // Elimina los .map del cliente después de subirlos
  },
});
