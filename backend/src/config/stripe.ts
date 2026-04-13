import Stripe from 'stripe';
import { env } from './env';

export const stripe = new Stripe(env.stripeSecretKey || 'sk_test_placeholder', {
  apiVersion: '2024-10-28.acacia' as any,
});
