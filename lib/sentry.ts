import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const traces = process.env.SENTRY_TRACES_SAMPLE_RATE ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE) : 0;

export function initSentry() {
  if (!dsn) return;
  try {
    if (!Sentry.getCurrentHub().getClient()) {
      Sentry.init({
        dsn,
        tracesSampleRate: traces,
      });
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('Sentry init failed', e);
  }
}

export function captureException(e: unknown) {
  try {
    initSentry();
    Sentry.captureException(e);
  } catch {
    // noop
  }
}
