import type Stripe from 'stripe';
import { env } from './env';
import { prisma } from './prisma';
import { stripe } from './stripe';
import { HttpError } from './httpError';

export interface CheckoutResult {
  url: string;
  id: string;
  mode: 'mock' | 'live';
}

export async function createCheckoutSession(userId: string, email: string, name: string): Promise<CheckoutResult> {
  if (env.billingMode === 'mock') {
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
      update: { status: 'active', currentPeriodEnd: periodEnd },
    });
    return {
      url: `${env.appUrl}/billing?mock=1`,
      id: `mock_${Date.now()}`,
      mode: 'mock',
    };
  }

  // live mode
  if (!env.stripePriceIdPro) {
    throw new HttpError(500, 'STRIPE_NOT_CONFIGURED', 'STRIPE_PRICE_ID_PRO is not set.');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, name, metadata: { userId } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: env.stripePriceIdPro, quantity: 1 }],
    success_url: `${env.appUrl}/billing?success=1`,
    cancel_url: `${env.appUrl}/billing?canceled=1`,
    allow_promotion_codes: true,
  });
  return { url: session.url ?? `${env.appUrl}/billing?canceled=1`, id: session.id, mode: 'live' };
}

/** Set a user's plan, tolerating a deleted user. A Stripe webhook must not 500
 *  if the referenced user was removed — Stripe would retry the event forever.
 *  P2025 ("record to update not found") is logged and swallowed. */
async function setUserPlan(userId: string, plan: 'PRO' | 'FREE'): Promise<void> {
  try {
    await prisma.user.update({ where: { id: userId }, data: { plan } });
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2025') {
      console.warn(`[billing] user ${userId} not found for plan=${plan} — skipping (likely deleted).`);
      return;
    }
    throw err;
  }
}

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  if (env.billingMode !== 'live') return;
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.client_reference_id;
      const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
      if (!userId || !subId) break;
      const sub = await stripe.subscriptions.retrieve(subId);
      await setUserPlan(userId, 'PRO');
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeSubscriptionId: sub.id,
          priceId: sub.items.data[0]?.price.id ?? '',
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
        update: {
          stripeSubscriptionId: sub.id,
          priceId: sub.items.data[0]?.price.id ?? '',
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
      });
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
      if (!existing) break;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      await prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: { status: sub.status, currentPeriodEnd: new Date((sub as any).current_period_end * 1000) },
      });
      await setUserPlan(existing.userId, isActive ? 'PRO' : 'FREE');
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
      if (!existing) break;
      await prisma.subscription.update({ where: { stripeSubscriptionId: sub.id }, data: { status: 'canceled' } });
      await setUserPlan(existing.userId, 'FREE');
      break;
    }
  }
}

export function isLiveBilling() {
  return env.billingMode === 'live';
}
