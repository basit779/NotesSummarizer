import type { Request, Response, NextFunction } from 'express';
import { stripe } from '../config/stripe';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { HttpError } from '../utils/httpError';
import type { AuthedRequest } from '../middleware/authMiddleware';
import { createCheckoutSession, handleStripeEvent } from '../services/stripeService';
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
    res.json({ plan: req.user.plan, subscription: sub });
  } catch (err) {
    next(err);
  }
}

// Raw-body webhook — mounted before express.json()
export async function webhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig || !env.stripeWebhookSecret) {
    return res.status(400).json({ error: { code: 'BAD_WEBHOOK', message: 'Missing signature or secret' } });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.stripeWebhookSecret);
  } catch (err: any) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (err: any) {
    logger.error('Webhook handler error:', err);
    res.status(500).json({ error: { code: 'WEBHOOK_HANDLER_FAILED', message: err.message } });
  }
}
