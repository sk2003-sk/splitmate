import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, demoLoginSchema } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again in a few minutes.' },
});

const publicUser = (user) => user.toJSON();

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email }).select('+passwordHash');

    if (existing?.hasAccount) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let user;
    if (existing) {
      // Claim a member profile that was added by a friend before sign-up.
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.hasAccount = true;
      existing.lastLoginAt = new Date();
      user = await existing.save();
    } else {
      user = await User.create({ name, email, passwordHash, hasAccount: true, lastLoginAt: new Date() });
    }

    setAuthCookie(res, signToken(user._id));
    res.status(201).json({ user: publicUser(user) });
  }),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!user || !user.hasAccount || !valid) {
      throw new ApiError(401, 'Invalid email or password');
    }
    user.lastLoginAt = new Date();
    await user.save();
    setAuthCookie(res, signToken(user._id));
    res.json({ user: publicUser(user) });
  }),
);

router.get(
  '/demo-users',
  asyncHandler(async (_req, res) => {
    if (!env.demoLoginEnabled) {
      throw new ApiError(404, 'Demo login is disabled');
    }
    const users = await User.find({ isDemo: true, hasAccount: true })
      .select('name email avatarColor avatarUrl')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ users });
  }),
);

router.post(
  '/demo',
  authLimiter,
  validate(demoLoginSchema),
  asyncHandler(async (req, res) => {
    if (!env.demoLoginEnabled) {
      throw new ApiError(404, 'Demo login is disabled');
    }
    const user = await User.findOne({ _id: req.body.userId, isDemo: true, hasAccount: true });
    if (!user) throw new ApiError(404, 'Demo account not found');
    user.lastLoginAt = new Date();
    await user.save();
    setAuthCookie(res, signToken(user._id));
    res.json({ user: publicUser(user) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  }),
);

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
