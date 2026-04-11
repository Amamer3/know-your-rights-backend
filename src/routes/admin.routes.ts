import { Router, Request, Response } from 'express';
import multer from 'multer';
import { processConstitutionPDF } from '../utils/pdf-processor.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import {
  bootstrapAdmin,
  createConstitutionArticleAdmin,
  createEmergencyActionAdmin,
  deleteAssessmentAdmin,
  deleteConstitutionArticleAdmin,
  deleteEmergencyActionAdmin,
  deleteUserByAdmin,
  getAdminDashboardStats,
  getUserAdminDetails,
  listAssessmentsAdmin,
  listConstitutionArticlesAdmin,
  listEmergencyActionsAdmin,
  listUsers,
  updateConstitutionArticleAdmin,
  updateEmergencyActionAdmin,
  updateUserByAdmin,
} from '../controllers/admin.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// One-time admin bootstrap route (authenticated user + bootstrap secret).
router.post('/bootstrap', authenticate, bootstrapAdmin);

router.use(authenticate, requireAdmin);

router.get('/stats', getAdminDashboardStats);

// User management
router.get('/users', listUsers);
router.get('/users/:userId', getUserAdminDetails);
router.patch('/users/:userId', updateUserByAdmin);
router.delete('/users/:userId', deleteUserByAdmin);

// Assessment management
router.get('/assessments', listAssessmentsAdmin);
router.delete('/assessments/:assessmentId', deleteAssessmentAdmin);

// Constitution management
router.get('/articles', listConstitutionArticlesAdmin);
router.post('/articles', createConstitutionArticleAdmin);
router.patch('/articles/:articleId', updateConstitutionArticleAdmin);
router.delete('/articles/:articleId', deleteConstitutionArticleAdmin);

// Emergency actions management
router.get('/emergency-actions', listEmergencyActionsAdmin);
router.post('/emergency-actions', createEmergencyActionAdmin);
router.patch('/emergency-actions/:actionId', updateEmergencyActionAdmin);
router.delete('/emergency-actions/:actionId', deleteEmergencyActionAdmin);

import { rateLimit } from 'express-rate-limit';
const uploadLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  limit: 5, // Limit each IP to 5 requests per windowMs
});
router.post('/upload', uploadLimiter, upload.single('pdf'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const result = await processConstitutionPDF(req.file.buffer);

    res.status(200).json({
      message: 'PDF processed successfully. Note: Automatic article parsing logic should be refined for production.',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
