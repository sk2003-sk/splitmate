import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const jwtSecret =
  process.env.JWT_SECRET || (isProd ? '' : 'splitmate-development-secret-do-not-use-in-prod');

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set in production');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: Number(process.env.PORT || 5001),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/splitmate',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  cookieName: 'splitmate_token',
  demoLoginEnabled: isProd
    ? process.env.ALLOW_DEMO_LOGIN === 'true'
    : process.env.ALLOW_DEMO_LOGIN !== 'false',
  demoPassword: process.env.DEMO_PASSWORD || 'splitmate123',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadBytes: 5 * 1024 * 1024,
  inboundEmailDomain: (process.env.INBOUND_EMAIL_DOMAIN || '').trim().toLowerCase(),
  inboundEmailSecret: (process.env.INBOUND_EMAIL_SECRET || '').trim(),
};
