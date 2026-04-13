import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { isLiveBilling, handleStripeWebhook } from '@/lib/billing';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!isLiveBilling()) {
    return NextResponse.json({ received: true, skipped: 'mock mode' });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig || !env.stripeWebhookSecret) {
    return NextResponse.json({ error: { code: 'BAD_WEBHOOK', message: 'Missing signature or secret' } }, { status: 400 });
  }
  try {
    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, sig, env.stripeWebhookSecret);
    await handleStripeWebhook(event);
    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: { code: 'WEBHOOK_FAILED', message: err.message } }, { status: 400 });
  }
}
