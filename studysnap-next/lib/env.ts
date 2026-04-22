const DEV_JWT_FALLBACK = 'dev-secret-change-me';

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

const rawJwtSecret = process.env.JWT_SECRET ?? '';
const isProd = process.env.NODE_ENV === 'production';

// Soft warning at module-load. Actual enforcement happens at request time
// (see assertJwtSecretReady below) so `next build` never fails the whole
// deploy when the env var is forgotten — the auth endpoints will throw a
// clear runtime error instead.
if (isProd) {
  if (!rawJwtSecret) {
    // eslint-disable-next-line no-console
    console.error(
      '[env] JWT_SECRET is NOT set in production. Auth endpoints will fail at runtime. Set a fixed 32+ byte random string on Vercel.',
    );
  } else if (rawJwtSecret === DEV_JWT_FALLBACK) {
    // eslint-disable-next-line no-console
    console.error('[env] JWT_SECRET equals the dev fallback in production. Replace with a real random string on Vercel.');
  } else if (rawJwtSecret.length < 32) {
    // eslint-disable-next-line no-console
    console.warn(`[env] JWT_SECRET is only ${rawJwtSecret.length} chars — consider using 32+ bytes of entropy.`);
  }
}

const resendKey = process.env.RESEND_API_KEY ?? '';
if (isProd && !resendKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] RESEND_API_KEY is not set — password-reset emails will NOT be sent. Reset links will only be logged server-side.',
  );
}

/**
 * Call this from auth endpoints before signing/verifying tokens. Throws a
 * 500-level error the client can surface when JWT_SECRET is missing or a
 * known insecure default in production. Keeps `next build` healthy while
 * still failing loudly when real requests hit bad config.
 */
export function assertJwtSecretReady(): void {
  if (!isProd) return;
  if (!rawJwtSecret) {
    throw new Error(
      'Server misconfiguration: JWT_SECRET is not set in production. Set it on Vercel and redeploy.',
    );
  }
  if (rawJwtSecret === DEV_JWT_FALLBACK) {
    throw new Error(
      'Server misconfiguration: JWT_SECRET is the dev fallback in production. Set a real random string on Vercel.',
    );
  }
}

export const env = {
  isProd,

  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: rawJwtSecret || DEV_JWT_FALLBACK,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  googleApiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
  githubToken: process.env.GITHUB_MODELS_TOKEN ?? process.env.GITHUB_TOKEN ?? '',

  resendApiKey: resendKey,
  resendFrom: process.env.RESEND_FROM ?? 'StudySnap <onboarding@resend.dev>',

  billingMode: (process.env.BILLING_MODE ?? 'mock') as 'mock' | 'live',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO ?? '',

  freeDailyUploadLimit: Number(process.env.FREE_DAILY_UPLOAD_LIMIT ?? 10),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 15),

  // Allowlist of emails that may bypass PdfCache / user-dedup on upload by
  // passing ?fresh=1. Used for testing new AI pipeline output on PDFs that
  // already have a cached pack — without wiping the cache for other users.
  // Comma-separated list in TEST_USER_EMAILS env var. basitraja334411+1@gmail.com
  // is always included for the project owner's QA account.
  testUserEmails: new Set(
    (process.env.TEST_USER_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .concat(['basitraja334411+1@gmail.com']),
  ),
};

export function isTestUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.testUserEmails.has(email.trim().toLowerCase());
}
