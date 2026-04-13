import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';
import { pdfUpload } from '../middleware/multerUpload';
import { uploadFile } from '../controllers/uploadController';
import { processFile } from '../controllers/processController';

const router = Router();

router.post('/upload', authMiddleware, usageLimiter('UPLOAD'), pdfUpload.single('file'), uploadFile);
router.post('/process/:fileId', authMiddleware, processFile);

export default router;
