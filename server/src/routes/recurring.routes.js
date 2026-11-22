import { Router } from 'express';
import { z } from 'zod';
import { RecurringExpense } from '../models/RecurringExpense.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recurringSchema } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { prepareExpense } from '../services/expense.service.js';
import { nextRunDate, runDueRecurrings } from '../services/recurring.service.js';
import { logActivity } from '../services/activity.service.js';
import { formatINR } from '../utils/money.js';

const router = Router();
router.use(requireAuth);

const populateConfig = [
  { path: 'category', select: 'name icon color' },
  { path: 'group', select: 'name emoji' },
  { path: 'paidBy.user', select: 'name avatarColor avatarUrl' },
  { path: 'splits.user', select: 'name avatarColor avatarUrl' },
  { path: 'createdBy', select: 'name avatarColor avatarUrl' },
];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await RecurringExpense.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate(populateConfig)
      .lean();
    res.json({ items });
  }),
);

router.post(
  '/',
  validate(recurringSchema),
  asyncHandler(async (req, res) => {
    const prepared = await prepareExpense({ ...req.body, idempotencyKey: null }, req.user);
    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();

    const recurring = await RecurringExpense.create({
      description: prepared.description,
      amountPaise: prepared.amountPaise,
      baseAmountPaise: prepared.baseAmountPaise,
      currency: prepared.currency,
      exchangeRate: prepared.exchangeRate,
      category: prepared.category,
      group: prepared.group,
      notes: prepared.notes,
      paidBy: prepared.paidBy.map((payer) => ({
        user: payer.user,
        amountPaise: payer.amountPaise,
        baseAmountPaise: payer.baseAmountPaise,
      })),
      splits: prepared.splits.map((split) => ({
        user: split.user,
        amountPaise: split.amountPaise,
        baseAmountPaise: split.baseAmountPaise,
      })),
      splitMethod: prepared.splitMethod,
      frequency: req.body.frequency,
      nextRunAt: startDate,
      createdBy: req.user._id,
    });

    await logActivity({
      actor: req.user._id,
      action: 'RECURRING_CREATED',
      entityType: 'recurring',
      entityId: recurring._id,
      group: recurring.group,
      amountPaise: recurring.baseAmountPaise,
      message: `${req.user.name} scheduled recurring “${recurring.description}” (${formatINR(recurring.baseAmountPaise)} ${recurring.frequency.toLowerCase()})`,
    });

    const populated = await recurring.populate(populateConfig);
    res.status(201).json({ recurring: populated.toJSON() });
  }),
);

router.put(
  '/:id',
  validate(
    z.object({
      active: z.boolean().optional(),
      frequency: z.enum(['WEEKLY', 'MONTHLY']).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const recurring = await RecurringExpense.findById(req.params.id);
    if (!recurring) throw new ApiError(404, 'Recurring expense not found');
    if (String(recurring.createdBy) !== String(req.user._id)) {
      throw new ApiError(403, 'You can only manage your own recurring expenses');
    }

    if (req.body.active !== undefined) recurring.active = req.body.active;
    if (req.body.frequency !== undefined) {
      recurring.frequency = req.body.frequency;
      if (recurring.active) {
        recurring.nextRunAt = nextRunDate(new Date(), recurring.frequency);
      }
    }
    await recurring.save();

    const populated = await recurring.populate(populateConfig);
    res.json({ recurring: populated.toJSON() });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const recurring = await RecurringExpense.findById(req.params.id);
    if (!recurring) throw new ApiError(404, 'Recurring expense not found');
    if (String(recurring.createdBy) !== String(req.user._id)) {
      throw new ApiError(403, 'You can only manage your own recurring expenses');
    }
    await recurring.deleteOne();
    res.json({ ok: true });
  }),
);

router.post(
  '/run',
  asyncHandler(async (req, res) => {
    const created = await runDueRecurrings({ userId: req.user._id });
    res.json({ created });
  }),
);

export default router;
