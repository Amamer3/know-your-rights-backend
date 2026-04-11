import { Router } from 'express';
import { listPublicPlans } from '../controllers/subscription.controller.js';

const router = Router();

router.get('/plans', listPublicPlans);
router.get('/plans/', listPublicPlans);

export default router;
