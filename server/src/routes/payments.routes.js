import { Router } from 'express';
import { Payment } from '../models/Payment.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { paymentSchema, paymentUpdateSchema } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { toPaise } from '../utils/money.js';

const router = Router();
router.use(requireAuth);

const APPS = new Set(['GPAY', 'PHONEPE', 'SLICE', 'PAYTM', 'BANK', 'CASH', 'OTHER']);

function parseRange(from, to) {
  const range = {};
  if (from) {
    const value = new Date(from);
    if (Number.isNaN(value.getTime())) throw new ApiError(400, 'Invalid start date');
    range.$gte = value;
  }
  if (to) {
    const value = new Date(to);
    if (Number.isNaN(value.getTime())) throw new ApiError(400, 'Invalid end date');
    range.$lt = value;
  }
  return Object.keys(range).length ? range : null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const filter = { user: req.user._id };
    if (req.query.app && APPS.has(req.query.app)) filter.app = req.query.app;
    if (req.query.direction === 'OUT' || req.query.direction === 'IN') {
      filter.direction = req.query.direction;
    }
    const paidAt = parseRange(req.query.from, req.query.to);
    if (paidAt) filter.paidAt = paidAt;

    const [items, total] = await Promise.all([
      Payment.find(filter)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const requestedYear = Number(req.query.year);
    const year = Number.isInteger(requestedYear) && requestedYear > 1970 && requestedYear < 2200
      ? requestedYear
      : new Date().getFullYear();

    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const payments = await Payment.find({
      user: req.user._id,
      paidAt: { $gte: start, $lt: end },
    })
      .select('amountPaise app direction paidAt')
      .lean();

    const months = Array.from({ length: 12 }, (_, index) => ({
      month: `${year}-${String(index + 1).padStart(2, '0')}`,
      outPaise: 0,
      inPaise: 0,
      count: 0,
    }));
    const byApp = new Map();
    const totals = { outPaise: 0, inPaise: 0, count: 0 };

    for (const payment of payments) {
      const bucket = months[new Date(payment.paidAt).getMonth()];
      const isOut = payment.direction !== 'IN';
      if (isOut) bucket.outPaise += payment.amountPaise;
      else bucket.inPaise += payment.amountPaise;
      bucket.count += 1;

      const app = byApp.get(payment.app) || { app: payment.app, outPaise: 0, inPaise: 0, count: 0 };
      if (isOut) app.outPaise += payment.amountPaise;
      else app.inPaise += payment.amountPaise;
      app.count += 1;
      byApp.set(payment.app, app);

      if (isOut) totals.outPaise += payment.amountPaise;
      else totals.inPaise += payment.amountPaise;
      totals.count += 1;
    }

    res.json({
      year,
      totals,
      months,
      byApp: [...byApp.values()].sort((a, b) => b.outPaise - a.outPaise),
      currentMonth: months[new Date().getMonth()],
    });
  }),
);

router.post(
  '/',
  validate(paymentSchema),
  asyncHandler(async (req, res) => {
    const amountPaise = toPaise(req.body.amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new ApiError(400, 'Enter a valid payment amount');
    }

    const key = (req.get('Idempotency-Key') || '').trim() || null;
    if (key) {
      const existing = await Payment.findOne({ user: req.user._id, idempotencyKey: key });
      if (existing) return res.status(200).json({ payment: existing.toJSON(), duplicate: true });
    }

    const payload = {
      user: req.user._id,
      payee: req.body.payee,
      amountPaise,
      app: req.body.app,
      direction: req.body.direction,
      category: req.body.category,
      paidAt: req.body.paidAt || new Date(),
      note: req.body.note,
      receiptUrl: req.body.receiptUrl,
      idempotencyKey: key,
    };

    let payment;
    try {
      payment = await Payment.create(payload);
    } catch (error) {
      if (error.code === 11000 && key) {
        const existing = await Payment.findOne({ user: req.user._id, idempotencyKey: key });
        if (existing) return res.status(200).json({ payment: existing.toJSON(), duplicate: true });
      }
      throw error;
    }

    res.status(201).json({ payment: payment.toJSON() });
  }),
);

router.put(
  '/:id',
  validate(paymentUpdateSchema),
  asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id });
    if (!payment) throw new ApiError(404, 'Payment not found');

    if (req.body.payee !== undefined) payment.payee = req.body.payee;
    if (req.body.amount !== undefined) payment.amountPaise = toPaise(req.body.amount);
    if (req.body.app !== undefined) payment.app = req.body.app;
    if (req.body.direction !== undefined) payment.direction = req.body.direction;
    if (req.body.category !== undefined) payment.category = req.body.category;
    if (req.body.paidAt !== undefined) payment.paidAt = req.body.paidAt;
    if (req.body.note !== undefined) payment.note = req.body.note;
    if (req.body.receiptUrl !== undefined) payment.receiptUrl = req.body.receiptUrl;
    if (req.body.needsReview !== undefined) payment.needsReview = req.body.needsReview;

    await payment.save();
    res.json({ payment: payment.toJSON() });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const payment = await Payment.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!payment) throw new ApiError(404, 'Payment not found');
    res.json({ ok: true });
  }),
);

export default router;
