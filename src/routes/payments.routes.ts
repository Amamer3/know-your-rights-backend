import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { initializePaystack, verifyPaystackTransaction } from '../controllers/payments.controller.js';

const router = Router();

router.post('/initialize', authenticate, initializePaystack);
router.post('/verify', authenticate, verifyPaystackTransaction);

export default router;
