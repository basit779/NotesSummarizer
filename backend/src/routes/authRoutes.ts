import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, me } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.get('/me', authMiddleware, me);

export default router;
