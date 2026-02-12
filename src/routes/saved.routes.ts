import { Router } from 'express';
import { getSavedItems, saveItem, removeSavedItem } from '../controllers/saved.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// All saved resources routes require authentication
router.use(authenticate);

router.get('/', getSavedItems);
router.post('/', saveItem);
router.delete('/:id', removeSavedItem);

export default router;
