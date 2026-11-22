import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Types } from 'mongoose';
import { PublicSplit } from '../models/PublicSplit.js';
import { validate } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { toPaise } from '../utils/money.js';
import {
  createSplitSchema,
  updateSplitSchema,
  addExpenseSchema,
} from '../validation/public.schemas.js';
import {
  newPersonKey,
  newSplitCode,
  summarizePublicSplit,
} from '../services/public-split.service.js';

const router = Router();

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many changes from this device. Wait a moment and try again.' },
});

const loadSplit = asyncHandler(async (req, _res, next) => {
  const split = await PublicSplit.findOne({ code: String(req.params.code || '').toLowerCase() });
  if (!split) throw new ApiError(404, 'This split does not exist or was removed');
  req.split = split;
  next();
});

async function createWithUniqueCode(data) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = newSplitCode();
    try {
      const split = await PublicSplit.create({ ...data, code });
      return split;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new ApiError(503, 'Could not create a split right now. Please try again.');
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await PublicSplit.find({})
      .sort({ updatedAt: -1 })
      .limit(40)
      .select('code title people expenses updatedAt createdAt')
      .lean();

    res.json({
      splits: rows.map((row) => ({
        code: row.code,
        title: row.title,
        peopleCount: row.people.length,
        expenseCount: row.expenses.length,
        totalPaise: row.expenses.reduce((sum, expense) => sum + expense.amountPaise, 0),
        updatedAt: row.updatedAt,
      })),
    });
  }),
);

router.post(
  '/',
  writeLimiter,
  validate(createSplitSchema),
  asyncHandler(async (req, res) => {
    const split = await createWithUniqueCode({
      title: req.body.title,
      people: req.body.people.map((name) => ({ key: newPersonKey(), name })),
      expenses: [],
    });
    res.status(201).json(summarizePublicSplit(split));
  }),
);

router.get(
  '/:code',
  loadSplit,
  asyncHandler(async (req, res) => {
    res.json(summarizePublicSplit(req.split));
  }),
);

router.patch(
  '/:code',
  writeLimiter,
  loadSplit,
  validate(updateSplitSchema),
  asyncHandler(async (req, res) => {
    if (req.body.title) req.split.title = req.body.title;
    if (req.body.addPeople) {
      req.split.people.push(
        ...req.body.addPeople.map((name) => ({ key: newPersonKey(), name })),
      );
    }
    await req.split.save();
    res.json(summarizePublicSplit(req.split));
  }),
);

router.delete(
  '/:code/people/:personKey',
  writeLimiter,
  loadSplit,
  asyncHandler(async (req, res) => {
    const person = req.split.people.find((entry) => entry.key === req.params.personKey);
    if (!person) throw new ApiError(404, 'Person not found');
    const inUse = req.split.expenses.some(
      (expense) =>
        expense.paidBy?.personKey === person.key ||
        (expense.participantKeys || []).includes(person.key),
    );
    if (inUse) {
      throw new ApiError(409, 'Remove their expenses first, then remove the person');
    }
    req.split.people = req.split.people.filter((entry) => entry.key !== person.key);
    await req.split.save();
    res.json(summarizePublicSplit(req.split));
  }),
);

router.post(
  '/:code/expenses',
  writeLimiter,
  loadSplit,
  validate(addExpenseSchema),
  asyncHandler(async (req, res) => {
    const { description, amount, paidBy, participants, date } = req.body;
    const keys = new Set(req.split.people.map((person) => person.key));

    if (!keys.has(paidBy)) throw new ApiError(400, 'Choose who paid from the people on this split');
    const uniqueParticipants = [...new Set(participants)];
    const strangers = uniqueParticipants.filter((key) => !keys.has(key));
    if (strangers.length) {
      throw new ApiError(400, 'Everyone sharing the bill must be on this split');
    }

    let when = new Date();
    if (date) {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) throw new ApiError(400, 'Enter a valid date');
      when = parsed;
    }

    req.split.expenses.push({
      description,
      amountPaise: toPaise(amount),
      paidBy: { personKey: paidBy, amountPaise: toPaise(amount) },
      participantKeys: uniqueParticipants,
      date: when,
    });
    await req.split.save();
    res.status(201).json(summarizePublicSplit(req.split));
  }),
);

router.delete(
  '/:code/expenses/:expenseId',
  writeLimiter,
  loadSplit,
  asyncHandler(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.expenseId)) {
      throw new ApiError(404, 'Expense not found');
    }
    const before = req.split.expenses.length;
    req.split.expenses = req.split.expenses.filter(
      (expense) => String(expense._id) !== req.params.expenseId,
    );
    if (req.split.expenses.length === before) throw new ApiError(404, 'Expense not found');
    await req.split.save();
    res.json(summarizePublicSplit(req.split));
  }),
);

router.delete(
  '/:code',
  writeLimiter,
  loadSplit,
  asyncHandler(async (req, res) => {
    await req.split.deleteOne();
    res.json({ ok: true });
  }),
);

export default router;
