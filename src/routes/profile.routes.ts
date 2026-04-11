import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { getProfile, updateProfile, deleteAccount } from '../controllers/user.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getProfile);
router.put('/', updateProfile);
router.delete('/account', deleteAccount);

export default router;
