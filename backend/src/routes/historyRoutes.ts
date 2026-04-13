import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { listHistory, getResult } from '../controllers/historyController';
import { dashboard } from '../controllers/dashboardController';

const router = Router();
router.get('/history', authMiddleware, listHistory);
router.get('/results/:id', authMiddleware, getResult);
router.get('/dashboard', authMiddleware, dashboard);

export default router;
