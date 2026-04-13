import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { checkout, subscriptionStatus } from '../controllers/billingController';

const router = Router();
router.post('/checkout', authMiddleware, checkout);
router.get('/subscription-status', authMiddleware, subscriptionStatus);

export default router;
