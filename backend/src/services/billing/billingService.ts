/**
 * Billing facade. Routes through either a mock (no real payments) or the
 * existing Stripe service. Controlled by env.billingMode.
 *
 * TODO: Stripe — set BILLING_MODE=live + fill STRIPE_* env vars when ready.
 */

import { env } from '../../config/env';
import { prisma } from '../../config/db';
import { HttpError } from '../../utils/httpError';
import { createCheckoutSession as stripeCheckout, handleStripeEvent } from '../stripeService';

export interface CheckoutResult {
  url: string;
  id: string;
  mode: 'mock' | 'live';
}

export async function getUserPlan(userId: string): Promise<'FREE' | 'PRO'> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  return user.plan as 'FREE' | 'PRO';
}

export async function createCheckoutSession(userId: string, email: string, name: string): Promise<CheckoutResult> {
  if (env.billingMode === 'mock') {
    // Simulate successful upgrade without real payment
    await prisma.user.update({ where: { id: userId }, data: { plan: 'PRO' } });

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: `mock_sub_${userId.slice(0, 8)}_${Date.now()}`,
        priceId: 'mock_pro_monthly',
        status: 'active',
        currentPeriodEnd: periodEnd,
      },
      update: {
        status: 'active',
        currentPeriodEnd: periodEnd,
      },
    });

    // TODO: Stripe — replace this redirect with a real session.url when BILLING_MODE=live
    return {
      url: `${env.appUrl}/billing?mock=1`,
      id: `mock_${Date.now()}`,
      mode: 'mock',
    };
  }

  // live mode — delegate to real Stripe
  const session = await stripeCheckout(userId, email, name);
  return { url: session.url ?? env.stripeCancelUrl, id: session.id ?? '', mode: 'live' };
}

export async function handleWebhook(event: any): Promise<void> {
  if (env.billingMode === 'mock') {
    // no-op in mock mode
    return;
  }
  await handleStripeEvent(event);
}

export function isLive() {
  return env.billingMode === 'live';
}
