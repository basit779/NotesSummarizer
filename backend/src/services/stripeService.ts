import { stripe } from '../config/stripe';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';

export async function ensureStripeCustomer(userId: string, email: string, name: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(userId: string, email: string, name: string) {
  if (!env.stripePriceIdPro) {
    throw new HttpError(500, 'STRIPE_NOT_CONFIGURED', 'STRIPE_PRICE_ID_PRO is not set.');
  }
  const customerId = await ensureStripeCustomer(userId, email, name);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: env.stripePriceIdPro, quantity: 1 }],
    success_url: env.stripeSuccessUrl,
    cancel_url: env.stripeCancelUrl,
    allow_promotion_codes: true,
  });

  return { url: session.url, id: session.id };
}

export async function handleStripeEvent(event: import('stripe').Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as import('stripe').Stripe.Checkout.Session;
      const userId = s.client_reference_id;
      const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
      if (!userId || !subId) break;

      const sub = await stripe.subscriptions.retrieve(subId);
      await prisma.user.update({ where: { id: userId }, data: { plan: 'PRO' } });
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
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
      if (!existing) break;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      await prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
      });
      await prisma.user.update({
        where: { id: existing.userId },
        data: { plan: isActive ? 'PRO' : 'FREE' },
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
      if (!existing) break;
      await prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: { status: 'canceled' },
      });
      await prisma.user.update({ where: { id: existing.userId }, data: { plan: 'FREE' } });
      break;
    }
  }
}
