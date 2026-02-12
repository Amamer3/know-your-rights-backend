import { Router } from 'express';
import {
  getConstitution,
  getArticleById,
  getEmergencyActions,
  searchLegalResources,
} from '../controllers/legal.controller.js';

const router = Router();

router.get('/constitution', getConstitution);
router.get('/articles/:id', getArticleById);
router.get('/emergency-actions', getEmergencyActions);
router.get('/search', searchLegalResources);

export default router;
