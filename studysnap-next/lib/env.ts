function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  googleApiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  mistralApiKey: process.env.MISTRAL_API_KEY ?? '',

  billingMode: (process.env.BILLING_MODE ?? 'mock') as 'mock' | 'live',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO ?? '',

  freeDailyUploadLimit: Number(process.env.FREE_DAILY_UPLOAD_LIMIT ?? 3),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 15),
};
