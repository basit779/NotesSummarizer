import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import uploadRoutes from './routes/uploadRoutes';
import historyRoutes from './routes/historyRoutes';
import billingRoutes from './routes/billingRoutes';
import { webhook } from './controllers/billingController';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Stripe webhook MUST be mounted with raw body BEFORE express.json
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), webhook);

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'studysnap-api' }));

  app.use('/api/auth', authRoutes);
  app.use('/api', uploadRoutes);
  app.use('/api', historyRoutes);
  app.use('/api/stripe', billingRoutes);

  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);

  return app;
}
