import { Router } from 'express';
import { Expense } from '../models/Expense.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/ApiError.js';
import { assertGroupMember, expenseAccessFilter } from '../services/access.service.js';
import {
  getSummary,
  getMonthly,
  getWeekly,
  getDaily,
  getCategories,
  getMembers,
  getGroups,
  getDashboardExtras,
} from '../services/analytics.service.js';
import { expensesToCsv } from '../services/csv.service.js';

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

async function scope(req) {
  const groupId = req.query.groupId || null;
  if (groupId) await assertGroupMember(groupId, req.user._id);
  return {
    groupId,
    from: parseDate(req.query.from),
    to: parseDate(req.query.to, true),
  };
}

const router = Router();
router.use(requireAuth);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(await getSummary(req.user._id));
  }),
);

router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const filters = await scope(req);
    const months = Number(req.query.months) || 6;
    res.json({ months: await getMonthly(req.user._id, { ...filters, months }) });
  }),
);

router.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const filters = await scope(req);
    const weeks = Number(req.query.weeks) || 8;
    res.json({ weeks: await getWeekly(req.user._id, { ...filters, weeks }) });
  }),
);

router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const filters = await scope(req);
    res.json({ days: await getDaily(req.user._id, filters) });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const filters = await scope(req);
    res.json({ categories: await getCategories(req.user._id, filters) });
  }),
);

router.get(
  '/members',
  asyncHandler(async (req, res) => {
    const filters = await scope(req);
    res.json({ members: await getMembers(req.user._id, filters) });
  }),
);

router.get(
  '/groups',
  asyncHandler(async (req, res) => {
    const filters = await scope(req);
    res.json({ groups: await getGroups(req.user._id, filters) });
  }),
);

router.get(
  '/recent',
  asyncHandler(async (req, res) => {
    res.json({ items: await getDashboardExtras(req.user._id) });
  }),
);

export default router;

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'month must use the YYYY-MM format' });
    }
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const filter = await expenseAccessFilter(req.user._id, { from: start, to: end });
    if (req.query.groupId) {
      await assertGroupMember(req.query.groupId, req.user._id);
      filter.group = req.query.groupId;
    }

    const expenses = await Expense.find(filter)
      .sort({ date: 1 })
      .populate([
        { path: 'paidBy.user', select: 'name' },
        { path: 'category', select: 'name' },
        { path: 'group', select: 'name' },
      ])
      .lean();

    const csv = `\uFEFF${expensesToCsv(expenses)}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="splitmate-report-${month}.csv"`,
    );
    return res.send(csv);
  }),
);
