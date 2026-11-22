import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { EmailCapture } from '../models/EmailCapture.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parseBankEmail } from '../services/email-parser.service.js';

const configured = () => Boolean(env.inboundEmailDomain && env.inboundEmailSecret);
const addressFor = (token) => (token ? `u-${token}@${env.inboundEmailDomain}` : null);
const newToken = () => crypto.randomBytes(16).toString('hex');
const newSmsToken = () => crypto.randomBytes(32).toString('hex');
const hashSmsToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function createSmsToken(userId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = newSmsToken();
    try {
      const result = await User.updateOne(
        { _id: userId, smsIngestTokenHash: { $exists: false } },
        { $set: { smsIngestTokenHash: hashSmsToken(token) } },
      );
      return result.modifiedCount === 1 ? token : null;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new ApiError(500, 'Could not create an SMS token. Please try again.');
}

async function createToken(userId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const token = newToken();
      await User.updateOne(
        { _id: userId, emailIngestToken: { $exists: false } },
        { $set: { emailIngestToken: token } },
      );
      const user = await User.findById(userId).select('+emailIngestToken');
      if (user?.emailIngestToken) return user.emailIngestToken;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new ApiError(500, 'Could not create an email address. Please try again.');
}

export const captureRouter = Router();
captureRouter.use(requireAuth);

captureRouter.get(
  '/email',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+emailIngestToken');
    res.json({
      configured: configured(),
      domain: env.inboundEmailDomain || null,
      address: configured() ? addressFor(user?.emailIngestToken) : null,
      enabled: Boolean(user?.emailIngestToken),
    });
  }),
);

captureRouter.post(
  '/email',
  asyncHandler(async (req, res) => {
    if (!configured()) throw new ApiError(503, 'Email capture is not configured on this server');
    const existing = await User.findById(req.user._id).select('+emailIngestToken');
    if (existing?.emailIngestToken) {
      return res.json({ address: addressFor(existing.emailIngestToken), created: false });
    }
    const token = await createToken(req.user._id);
    res.status(201).json({ address: addressFor(token), created: true });
  }),
);

captureRouter.post(
  '/email/rotate',
  asyncHandler(async (req, res) => {
    if (!configured()) throw new ApiError(503, 'Email capture is not configured on this server');
    const token = newToken();
    await User.updateOne({ _id: req.user._id }, { $set: { emailIngestToken: token } });
    res.json({ address: addressFor(token), rotated: true });
  }),
);

captureRouter.delete(
  '/email',
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $unset: { emailIngestToken: 1 } });
    res.json({ ok: true, enabled: false });
  }),
);

captureRouter.get(
  '/email/captures',
  asyncHandler(async (req, res) => {
    const captures = await EmailCapture.find({ user: req.user._id, channel: { $ne: 'SMS' } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('status reason subject payee amountPaise direction createdAt payment')
      .lean();
    res.json({ captures });
  }),
);

captureRouter.get(
  '/sms',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+smsIngestTokenHash');
    res.json({ enabled: Boolean(user?.smsIngestTokenHash), endpoint: '/api/inbound/sms' });
  }),
);

captureRouter.post(
  '/sms',
  asyncHandler(async (req, res) => {
    const existing = await User.findById(req.user._id).select('+smsIngestTokenHash');
    if (existing?.smsIngestTokenHash) {
      return res.json({ created: false, enabled: true, endpoint: '/api/inbound/sms' });
    }
    const token = await createSmsToken(req.user._id);
    if (!token) return res.json({ created: false, enabled: true, endpoint: '/api/inbound/sms' });
    res.status(201).json({ token, created: true, endpoint: '/api/inbound/sms' });
  }),
);

captureRouter.post(
  '/sms/rotate',
  asyncHandler(async (req, res) => {
    const token = newSmsToken();
    await User.updateOne(
      { _id: req.user._id },
      { $set: { smsIngestTokenHash: hashSmsToken(token) } },
    );
    res.json({ token, rotated: true, endpoint: '/api/inbound/sms' });
  }),
);

captureRouter.delete(
  '/sms',
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $unset: { smsIngestTokenHash: 1 } });
    res.json({ ok: true, enabled: false });
  }),
);

captureRouter.get(
  '/sms/captures',
  asyncHandler(async (req, res) => {
    const captures = await EmailCapture.find({ user: req.user._id, channel: 'SMS' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('status reason sender payee amountPaise direction createdAt payment')
      .lean();
    res.json({ captures });
  }),
);

const multipart = multer({ limits: { fieldSize: 1024 * 1024, files: 0 } }).none();

function requireIngestSecret(req, _res, next) {
  if (!configured()) return next(new ApiError(503, 'Email capture is not configured'));
  let provided = String(req.get('x-splitmate-secret') || '').trim();
  if (!provided) {
    const auth = String(req.get('authorization') || '');
    if (/^Basic /i.test(auth)) {
      try {
        const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
        const index = decoded.indexOf(':');
        provided = (index >= 0 ? decoded.slice(index + 1) : decoded).trim();
      } catch {
        provided = '';
      }
    }
  }
  const given = Buffer.from(provided);
  const expected = Buffer.from(env.inboundEmailSecret);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return next(new ApiError(401, 'Invalid email ingest secret'));
  }
  return next();
}

function parseMultipart(req, res, next) {
  if (req.is('multipart/form-data')) return multipart(req, res, next);
  return next();
}

const inboundLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many inbound emails. Please slow down.' },
});

const HEADER_KEYS = ['message-id', 'date'];
const ADDRESS_RE = /[^\s,;<"]+@[^\s,;>"]+/g;

function addressesFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(addressesFrom);
  return String(value).match(ADDRESS_RE) || [];
}

function parseEnvelope(value) {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function headerMap(payload) {
  const raw = payload.headers || payload.Headers;
  const map = {};
  if (typeof raw !== 'string') return map;
  for (const line of raw.split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index > 0) {
      const key = line.slice(0, index).trim().toLowerCase();
      if (HEADER_KEYS.includes(key)) map[key] = line.slice(index + 1).trim();
    }
  }
  return map;
}

function firstValue(payload, keys) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) {
      const joined = value.filter((entry) => typeof entry === 'string' && entry.trim()).join(', ');
      if (joined) return joined;
    }
  }
  return '';
}

function matchesDomain(address) {
  const lower = String(address || '').toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 0) return null;
  const local = lower.slice(0, at);
  const host = lower.slice(at + 1);
  if (host !== env.inboundEmailDomain) return null;
  if (!/^u-[a-f0-9]{24,64}$/.test(local)) return null;
  return local.slice(2);
}

function inboxToken(payload) {
  const candidates = [
    ...addressesFrom(payload.to),
    ...addressesFrom(payload.To),
    ...addressesFrom(payload.recipient),
    ...addressesFrom(payload.Recipient),
  ];
  for (const key of ['envelope', 'envelope_json']) {
    const envelope = parseEnvelope(payload[key]);
    if (envelope) candidates.push(...addressesFrom(envelope.to));
  }
  for (const candidate of candidates) {
    const token = matchesDomain(candidate);
    if (token) return token;
  }
  return null;
}

function fingerprintFor(userId, messageId, from, subject, date, text) {
  const seed = messageId
    ? `msg:${messageId.trim()}`
    : `body:${from}|${subject}|${date}|${String(text).slice(0, 2000)}`;
  return crypto.createHash('sha256').update(`${userId}:${seed}`).digest('hex');
}

async function handleInbound(req, res) {
  const payload = req.body || {};
  const token = inboxToken(payload);
  if (!token) return res.status(404).json({ ok: false, reason: 'unknown-recipient' });

  const user = await User.findOne({ emailIngestToken: token });
  if (!user) return res.status(404).json({ ok: false, reason: 'unknown-recipient' });

  const headers = headerMap(payload);
  const envelope = parseEnvelope(payload.envelope) || {};
  const from = firstValue(payload, ['from', 'From', 'sender']) || String(envelope.from || '');
  const subject = firstValue(payload, ['subject', 'Subject']);
  const html = firstValue(payload, ['html', 'HtmlBody', 'body-html', 'bodyHtml', 'stripped-html']);
  const text =
    firstValue(payload, ['text', 'TextBody', 'body-plain', 'bodyPlain', 'plain', 'stripped-text']) || html;
  const messageId =
    firstValue(payload, ['messageId', 'message-id', 'Message-Id', 'MessageID', 'message_id']) ||
    headers['message-id'] ||
    '';
  const rawDate =
    firstValue(payload, ['date', 'Date']) ||
    headers.date ||
    (payload.timestamp ? new Date(Number(payload.timestamp) * 1000).toISOString() : '');

  const fingerprint = fingerprintFor(user._id, messageId, from, subject, rawDate, text);

  let capture;
  try {
    capture = await EmailCapture.create({
      user: user._id,
      fingerprint,
      sender: from.slice(0, 200),
      subject: subject.slice(0, 300),
      status: 'PROCESSING',
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await EmailCapture.findOne({ user: user._id, fingerprint }).lean();
      return res.json({
        ok: true,
        duplicate: true,
        status: existing?.status === 'CREATED' ? 'duplicate' : existing?.status || 'duplicate',
        paymentId: existing?.payment || null,
      });
    }
    throw error;
  }

  const parsed = parseBankEmail({ subject, text, html, date: rawDate });
  if (parsed.status !== 'CREATED') {
    capture.status = 'IGNORED';
    capture.reason = parsed.reason;
    await capture.save();
    return res.status(202).json({ ok: true, status: 'ignored', reason: parsed.reason });
  }

  const externalId = messageId ? messageId.trim().slice(0, 500) : undefined;
  let payment;
  try {
    payment = await Payment.create({
      user: user._id,
      ...parsed.payment,
      source: 'EMAIL',
      needsReview: parsed.needsReview,
      externalId,
    });
  } catch (error) {
    if (error.code === 11000 && externalId) {
      payment = await Payment.findOne({ user: user._id, externalId });
      capture.status = 'DUPLICATE';
      capture.reason = 'same-message';
      capture.payment = payment?._id || null;
      await capture.save();
      return res.json({ ok: true, duplicate: true, status: 'duplicate', paymentId: payment?._id || null });
    }
    capture.status = 'FAILED';
    capture.reason = 'save-failed';
    await capture.save();
    throw error;
  }

  capture.status = 'CREATED';
  capture.payee = parsed.payment.payee;
  capture.amountPaise = parsed.payment.amountPaise;
  capture.direction = parsed.payment.direction;
  capture.confidence = parsed.confidence;
  capture.payment = payment._id;
  await capture.save();

  return res.status(201).json({
    ok: true,
    status: 'created',
    paymentId: payment._id,
    needsReview: parsed.needsReview,
  });
}

export const inboundEmailRouter = Router();
inboundEmailRouter.post(
  '/',
  inboundLimiter,
  requireIngestSecret,
  parseMultipart,
  asyncHandler(handleInbound),
);

const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many bank SMS updates. Please slow down.' },
});

const SMS_TOKEN_RE = /^[a-f0-9]{64}$/;

async function handleInboundSms(req, res) {
  const payload = req.body || {};
  const token = String(payload.token || req.get('x-splitmate-token') || '')
    .trim()
    .toLowerCase();
  if (!SMS_TOKEN_RE.test(token)) return res.status(401).json({ ok: false, reason: 'invalid-token' });

  const text = String(payload.text || payload.message || '').trim();
  if (!text) return res.status(400).json({ ok: false, reason: 'missing-text' });
  if (text.length > 2000) return res.status(413).json({ ok: false, reason: 'too-long' });

  const sender = String(payload.sender || payload.from || '').trim().slice(0, 200);
  const rawDate = String(payload.date || '').trim();

  const user = await User.findOne({ smsIngestTokenHash: hashSmsToken(token) }).select('_id');
  if (!user) return res.status(401).json({ ok: false, reason: 'invalid-token' });

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${user._id}:sms:${sender}|${text.slice(0, 2000)}`)
    .digest('hex');

  let capture;
  try {
    capture = await EmailCapture.create({
      user: user._id,
      channel: 'SMS',
      fingerprint,
      sender,
      status: 'PROCESSING',
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await EmailCapture.findOne({ user: user._id, fingerprint }).lean();
      return res.json({
        ok: true,
        duplicate: true,
        status: existing?.status === 'CREATED' ? 'duplicate' : existing?.status || 'duplicate',
        paymentId: existing?.payment || null,
      });
    }
    throw error;
  }

  const parsed = parseBankEmail({ text, date: rawDate });
  if (parsed.status !== 'CREATED') {
    capture.status = 'IGNORED';
    capture.reason = parsed.reason;
    await capture.save();
    return res.status(202).json({ ok: true, status: 'ignored', reason: parsed.reason });
  }

  const externalId = `sms:${fingerprint}`;
  let payment;
  try {
    payment = await Payment.create({
      user: user._id,
      ...parsed.payment,
      note: 'Auto-captured from a bank SMS',
      source: 'SMS',
      needsReview: parsed.needsReview,
      externalId,
    });
  } catch (error) {
    if (error.code === 11000) {
      payment = await Payment.findOne({ user: user._id, externalId });
      capture.status = 'DUPLICATE';
      capture.reason = 'same-message';
      capture.payment = payment?._id || null;
      await capture.save();
      return res.json({ ok: true, duplicate: true, status: 'duplicate', paymentId: payment?._id || null });
    }
    capture.status = 'FAILED';
    capture.reason = 'save-failed';
    await capture.save();
    throw error;
  }

  capture.status = 'CREATED';
  capture.payee = parsed.payment.payee;
  capture.amountPaise = parsed.payment.amountPaise;
  capture.direction = parsed.payment.direction;
  capture.confidence = parsed.confidence;
  capture.payment = payment._id;
  await capture.save();

  return res.status(201).json({
    ok: true,
    status: 'created',
    paymentId: payment._id,
    needsReview: parsed.needsReview,
  });
}

export const inboundSmsRouter = Router();
inboundSmsRouter.post('/', smsLimiter, asyncHandler(handleInboundSms));
