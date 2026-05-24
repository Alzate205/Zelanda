import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || undefined,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
});
