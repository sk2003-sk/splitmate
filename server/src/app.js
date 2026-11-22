import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { uploadDirectory } from './middleware/upload.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { ApiError } from './utils/ApiError.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import groupsRoutes from './routes/groups.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import balancesRoutes from './routes/balances.routes.js';
import settlementsRoutes from './routes/settlements.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import { captureRouter, inboundEmailRouter, inboundSmsRouter } from './routes/capture.routes.js';
import analyticsRoutes, { reportsRouter } from './routes/analytics.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import activityRoutes from './routes/activity.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import recurringRoutes from './routes/recurring.routes.js';
import uploadsRoutes from './routes/uploads.routes.js';
import publicSplitsRoutes from './routes/public-splits.routes.js';

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

const allowedOrigins = new Set(
  [
    ...env.clientUrl.split(',').map((value) => value.trim()),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new ApiError(403, 'This origin is not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDirectory, { maxAge: '7d' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down and try again shortly.' },
  }),
);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/balances', balancesRoutes);
app.use('/api/settlements', settlementsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/capture', captureRouter);
app.use('/api/inbound/email', inboundEmailRouter);
app.use('/api/inbound/sms', inboundSmsRouter);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/reports', reportsRouter);
app.use('/api/public/splits', publicSplitsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
