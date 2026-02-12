import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import aiRoutes from './routes/ai.routes.js';
import legalRoutes from './routes/legal.routes.js';
import savedRoutes from './routes/saved.routes.js';
import adminRoutes from './routes/admin.routes.js';

dotenv.config();

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/assess', aiRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/admin', adminRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to KnowYourRights GH API' });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

export default app;
