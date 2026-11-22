import { Router } from 'express';
import { Types } from 'mongoose';
import { Expense } from '../models/Expense.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { expenseSchema, listQuerySchema } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { expenseAccessFilter, groupIdsForUser, assertGroupMember } from '../services/access.service.js';
import { prepareExpense, canAccessExpense, involvedUserIds } from '../services/expense.service.js';
import { logActivity, notifyUsers } from '../services/activity.service.js';
import { expensesToCsv } from '../services/csv.service.js';
import { formatINR } from '../utils/money.js';

const router = Router();
router.use(requireAuth);

const USER_FIELDS = 'name email avatarColor avatarUrl';

const populateConfig = [
  { path: 'paidBy.user', select: USER_FIELDS },
  { path: 'splits.user', select: USER_FIELDS },
  { path: 'category', select: 'name icon color' },
  { path: 'group', select: 'name emoji' },
  { path: 'createdBy', select: USER_FIELDS },
];

const populateExpense = (doc) => doc.populate(populateConfig);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

async function buildExpenseFilter(req) {
  const query = req.query;
  if (query.groupId) await assertGroupMember(query.groupId, req.user._id);

  const access = await expenseAccessFilter(req.user._id, { groupId: query.groupId || null });
  const parts = [access];

  if (query.q) {
    parts.push({ description: new RegExp(escapeRegex(query.q.trim()), 'i') });
  }
  if (query.categoryId) {
    parts.push({ category: new Types.ObjectId(query.categoryId) });
  }
  if (query.memberId) {
    const memberId = new Types.ObjectId(query.memberId);
    parts.push({ $or: [{ 'splits.user': memberId }, { 'paidBy.user': memberId }] });
  }
  const from = parseDate(query.from);
  const to = parseDate(query.to, true);
  if (from || to) {
    parts.push({ date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } });
  }

  return parts.length === 1 ? parts[0] : { $and: parts };
}

function sortFor(value) {
  switch (value) {
    case 'oldest':
      return { date: 1 };
    case 'amount':
      return { baseAmountPaise: -1 };
    case 'amount-asc':
      return { baseAmountPaise: 1 };
    default:
      return { date: -1 };
  }
}

router.get(
  '/export/csv',
  asyncHandler(async (req, res) => {
    const filter = await buildExpenseFilter(req);
    const expenses = await Expense.find(filter)
      .sort({ date: -1 })
      .limit(10_000)
      .populate(populateConfig)
      .lean();

    const csv = `\uFEFF${expensesToCsv(expenses)}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="splitmate-expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const filter = await buildExpenseFilter(req);
    const sort = sortFor(query.sort);

    const [items, total, totalRows] = await Promise.all([
      Expense.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate(populateConfig)
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([
        { $match: filter },
        { $group: { _id: null, totalPaise: { $sum: '$baseAmountPaise' } } },
      ]),
    ]);

    res.json({
      items: items.map((expense) => ({
        ...expense,
        mySharePaise: (expense.splits || [])
          .filter((split) => String(split.user?._id || split.user) === String(req.user._id))
          .reduce((sum, split) => sum + (split.baseAmountPaise ?? split.amountPaise ?? 0), 0),
      })),
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      totalPaise: totalRows[0]?.totalPaise || 0,
    });
  }),
);

router.post(
  '/',
  validate(expenseSchema),
  asyncHandler(async (req, res) => {
    const key = (req.get('Idempotency-Key') || req.body.idempotencyKey || '').trim() || null;

    if (key) {
      const existing = await Expense.findOne({ idempotencyKey: key });
      if (existing) {
        if (String(existing.createdBy) !== String(req.user._id)) {
          throw new ApiError(409, 'This idempotency key was already used');
        }
        const populated = await populateExpense(existing);
        return res.status(200).json({ expense: populated.toJSON(), duplicate: true });
      }
    }

    const data = await prepareExpense({ ...req.body, idempotencyKey: key }, req.user);

    let expense;
    try {
      expense = await Expense.create(data);
    } catch (error) {
      if (error.code === 11000 && key) {
        const existing = await Expense.findOne({ idempotencyKey: key });
        if (existing) {
          const populated = await populateExpense(existing);
          return res.status(200).json({ expense: populated.toJSON(), duplicate: true });
        }
      }
      throw error;
    }

    const recipients = involvedUserIds(expense);
    await notifyUsers(
      recipients,
      {
        type: 'EXPENSE_ADDED',
        title: 'New expense added',
        message: `${req.user.name} added “${expense.description}” (${formatINR(expense.baseAmountPaise)})`,
        link: `/expenses/${expense._id}`,
      },
      req.user._id,
    );
    await logActivity({
      actor: req.user._id,
      action: 'EXPENSE_CREATED',
      entityType: 'expense',
      entityId: expense._id,
      group: expense.group,
      amountPaise: expense.baseAmountPaise,
      message: `${req.user.name} added “${expense.description}” (${formatINR(expense.baseAmountPaise)})`,
    });

    const populated = await populateExpense(expense);
    res.status(201).json({ expense: populated.toJSON() });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw new ApiError(404, 'Expense not found');

    const groupIds = await groupIdsForUser(req.user._id);
    if (!canAccessExpense(req.user._id, expense, groupIds)) {
      throw new ApiError(403, 'You do not have access to this expense');
    }

    await populateExpense(expense);
    res.json({ expense: expense.toJSON() });
  }),
);

router.put(
  '/:id',
  validate(expenseSchema),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw new ApiError(404, 'Expense not found');
    if (String(expense.createdBy) !== String(req.user._id)) {
      throw new ApiError(403, 'Only the person who added this expense can edit it');
    }

    const previousRecipients = involvedUserIds(expense);
    const data = await prepareExpense(
      { ...req.body, idempotencyKey: expense.idempotencyKey },
      req.user,
    );

    expense.set(data);
    await expense.save();

    const recipients = [...new Set([...previousRecipients, ...involvedUserIds(expense)])];
    await notifyUsers(
      recipients,
      {
        type: 'EXPENSE_UPDATED',
        title: 'Expense updated',
        message: `${req.user.name} updated “${expense.description}”`,
        link: `/expenses/${expense._id}`,
      },
      req.user._id,
    );
    await logActivity({
      actor: req.user._id,
      action: 'EXPENSE_UPDATED',
      entityType: 'expense',
      entityId: expense._id,
      group: expense.group,
      amountPaise: expense.baseAmountPaise,
      message: `${req.user.name} updated “${expense.description}”`,
    });

    const populated = await populateExpense(expense);
    res.json({ expense: populated.toJSON() });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw new ApiError(404, 'Expense not found');
    if (String(expense.createdBy) !== String(req.user._id)) {
      throw new ApiError(403, 'Only the person who added this expense can delete it');
    }

    await expense.deleteOne();
    await logActivity({
      actor: req.user._id,
      action: 'EXPENSE_DELETED',
      entityType: 'expense',
      entityId: expense._id,
      group: expense.group,
      amountPaise: expense.baseAmountPaise,
      message: `${req.user.name} deleted “${expense.description}”`,
    });
    res.json({ ok: true });
  }),
);

export default router;
