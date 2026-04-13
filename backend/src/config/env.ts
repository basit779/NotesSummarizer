import dotenv from 'dotenv';
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',

  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO ?? '',
  stripeSuccessUrl: process.env.STRIPE_SUCCESS_URL ?? 'http://localhost:5173/billing?success=1',
  stripeCancelUrl: process.env.STRIPE_CANCEL_URL ?? 'http://localhost:5173/billing?canceled=1',

  freeDailyUploadLimit: Number(process.env.FREE_DAILY_UPLOAD_LIMIT ?? 3),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 15),
};
