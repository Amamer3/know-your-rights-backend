import { Router } from 'express';
import { signup, login, logout, refresh, forgotPassword, googleLogin, googleCallback } from '../controllers/auth.controller.js';
import { getProfile } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);

// Google Auth
router.get('/google', googleLogin);
router.get('/callback', googleCallback);

// Alias for convenience
router.get('/profile', authenticate, getProfile);

export default router;
