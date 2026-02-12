import { Router } from 'express';
import { submitAssessment, getAssessmentHistory, getAssessmentById } from '../controllers/ai.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// All AI assessment routes require authentication
router.use(authenticate);

router.post('/', upload.single('audio'), submitAssessment);
router.get('/history', getAssessmentHistory);
router.get('/:id', getAssessmentById);

export default router;
