const DEV_JWT_FALLBACK = 'dev-secret-change-me';

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

const rawJwtSecret = process.env.JWT_SECRET ?? '';
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  if (!rawJwtSecret) {
    throw new Error(
      'JWT_SECRET is required in production. Set a fixed 32+ byte random string on Vercel — otherwise every deploy invalidates all existing user sessions.',
    );
  }
  if (rawJwtSecret === DEV_JWT_FALLBACK) {
    throw new Error(
      'JWT_SECRET equals the dev fallback in production. Replace with a real 32+ byte random string on Vercel.',
    );
  }
  if (rawJwtSecret.length < 32) {
    throw new Error(
      `JWT_SECRET is too short (${rawJwtSecret.length} chars). Use 32+ bytes of entropy.`,
    );
  }
}

const resendKey = process.env.RESEND_API_KEY ?? '';
if (isProd && !resendKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] RESEND_API_KEY is not set — password-reset emails will NOT be sent. Reset links will only be logged server-side.',
  );
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
};
