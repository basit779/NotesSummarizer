import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';
import type { AuthedRequest } from '../middleware/authMiddleware';
import { createCheckoutSession, handleWebhook, isLive } from '../services/billing/billingService';
import { logger } from '../utils/logger';

export async function checkout(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
    const session = await createCheckoutSession(req.user.id, req.user.email, req.user.name);
    res.json(session);
  } catch (err) {
    next(err);
  }
}

export async function subscriptionStatus(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Not authenticated');
    const sub = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
    res.json({ plan: req.user.plan, subscription: sub, billingMode: env.billingMode });
  } catch (err) {
    next(err);
  }
}

// Raw-body webhook — mounted before express.json()
// TODO: Stripe — only relevant when BILLING_MODE=live.
export async function webhook(req: Request, res: Response) {
  if (!isLive()) {
    return res.json({ received: true, skipped: 'mock mode' });
  }
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig || !env.stripeWebhookSecret) {
    return res.status(400).json({ error: { code: 'BAD_WEBHOOK', message: 'Missing signature or secret' } });
  }
  try {
    const { stripe } = await import('../config/stripe');
    const event = stripe.webhooks.constructEvent(req.body, sig, env.stripeWebhookSecret);
    await handleWebhook(event);
    res.json({ received: true });
  } catch (err: any) {
    logger.error('Webhook error:', err.message);
    res.status(400).json({ error: { code: 'WEBHOOK_FAILED', message: err.message } });
  }
}
