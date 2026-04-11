import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import profileRoutes from './routes/profile.routes.js';
import assessRoutes from './routes/assess.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import recordingsRoutes from './routes/recordings.routes.js';
import legalRoutes from './routes/legal.routes.js';
import savedRoutes from './routes/saved.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import billingRoutes from './routes/billing.routes.js';
import { redirectRootOAuthToApp } from './controllers/auth.controller.js';
import { paystackWebhook } from './controllers/payments.controller.js';
import { listPublicPlans } from './controllers/subscription.controller.js';
import { apiReference } from '@scalar/express-api-reference';
import { openApiDocument } from './docs/openapi.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Render (and similar) sit behind a reverse proxy. Required so express-rate-limit and req.ip
// use X-Forwarded-For correctly; otherwise ERL throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', process.env.TRUST_PROXY === '0' ? false : 1);

// Paystack webhook must see the raw body for HMAC verification (before express.json).
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    void paystackWebhook(req, res).catch(next);
  },
);

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        "style-src": ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        "img-src": ["'self'", 'data:', 'https:'],
        "connect-src": ["'self'", 'https:'],
      },
    },
  }),
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  }),
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/billing', billingRoutes);
// Alias: easier if EXPO_PUBLIC_API_URL already ends with /api (use /plans, not /api/plans).
app.get('/api/plans', listPublicPlans);
app.use('/api/assess', assessRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/admin', adminRoutes);
app.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});
app.get('/docs', apiReference({ content: openApiDocument }));

// Root route (OAuth may land here if Supabase Site URL is this host without /api/auth/callback)
app.get('/', (req, res) => {
  if (redirectRootOAuthToApp(req, res)) {
    return;
  }
  res.json({ message: 'Welcome to KnowYourRights GH API' });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.use(globalErrorHandler);

export default app;
