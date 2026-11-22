import { Expense } from '../models/Expense.js';
import { Settlement } from '../models/Settlement.js';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { expenseAccessFilter } from './access.service.js';
import { computePairwise, summarizeForUser } from './balance.service.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function fetchExpenses(userId, { groupId = null, from = null, to = null } = {}) {
  const filter = await expenseAccessFilter(userId, { groupId, from, to });
  return Expense.find(filter)
    .select(
      'description baseAmountPaise amountPaise currency date group category paidBy splits splitMethod createdBy',
    )
    .populate('group', 'name emoji')
    .populate('category', 'name icon color')
    .lean();
}

function sumShares(expense, userId) {
  if (!userId) return 0;
  return (expense.splits || [])
    .filter((split) => String(split.user) === String(userId))
    .reduce((total, split) => total + split.baseAmountPaise, 0);
}

export async function getSummary(userId) {
  const [expenses, settlements, pairwise, groupCount] = await Promise.all([
    fetchExpenses(userId),
    Settlement.find({ status: 'COMPLETED', $or: [{ fromUser: userId }, { toUser: userId }] }).lean(),
    computePairwise({ userId }),
    Group.countDocuments({ members: userId }),
  ]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const totalExpensesPaise = expenses.reduce((sum, expense) => sum + expense.baseAmountPaise, 0);
  const mySharePaise = expenses.reduce((sum, expense) => sum + sumShares(expense, userId), 0);
  const monthly = expenses.filter((expense) => new Date(expense.date) >= monthStart);
  const settledPaise = settlements.reduce((sum, settlement) => sum + settlement.amountPaise, 0);
  const balance = summarizeForUser(pairwise, userId);

  const participantIds = new Set();
  for (const expense of expenses) {
    for (const split of expense.splits || []) participantIds.add(String(split.user));
    for (const payer of expense.paidBy || []) participantIds.add(String(payer.user));
  }

  return {
    totalExpensesPaise,
    mySharePaise,
    expenseCount: expenses.length,
    youOwePaise: balance.youOwePaise,
    youAreOwedPaise: balance.youAreOwedPaise,
    netPaise: balance.netPaise,
    settledPaise,
    monthlySpendPaise: monthly.reduce((sum, expense) => sum + expense.baseAmountPaise, 0),
    monthlyMySharePaise: monthly.reduce((sum, expense) => sum + sumShares(expense, userId), 0),
    groupCount,
    memberCount: participantIds.size,
    month: monthKey(now),
  };
}

export async function getMonthly(userId, { months = 6, from = null, to = null, groupId = null } = {}) {
  const expenses = await fetchExpenses(userId, { groupId, from, to });

  let start;
  let end;
  if (from || to) {
    start = startOfMonth(from || new Date(Math.min(...expenses.map((e) => new Date(e.date).getTime()), Date.now())));
    end = startOfMonth(to || new Date());
  } else {
    end = startOfMonth(new Date());
    start = addMonths(end, -(Math.max(1, Math.min(36, months)) - 1));
  }

  const buckets = new Map();
  for (let cursor = new Date(start); cursor <= end; cursor = addMonths(cursor, 1)) {
    buckets.set(monthKey(cursor), {
      key: monthKey(cursor),
      label: `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
      totalPaise: 0,
      mySharePaise: 0,
      count: 0,
    });
  }

  for (const expense of expenses) {
    const key = monthKey(new Date(expense.date));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.totalPaise += expense.baseAmountPaise;
    bucket.mySharePaise += sumShares(expense, userId);
    bucket.count += 1;
  }

  return [...buckets.values()];
}

export async function getWeekly(userId, { weeks = 8, groupId = null, from = null, to = null } = {}) {
  const expenses = await fetchExpenses(userId, { groupId, from, to });
  const end = startOfWeek(to || new Date());
  const start = from ? startOfWeek(from) : addDays(end, -7 * (Math.max(1, Math.min(26, weeks)) - 1));

  const buckets = new Map();
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 7)) {
    buckets.set(cursor.toISOString().slice(0, 10), {
      key: cursor.toISOString().slice(0, 10),
      label: `${cursor.getDate()} ${MONTH_LABELS[cursor.getMonth()]}`,
      totalPaise: 0,
      count: 0,
    });
  }

  for (const expense of expenses) {
    const week = startOfWeek(new Date(expense.date)).toISOString().slice(0, 10);
    const bucket = buckets.get(week);
    if (!bucket) continue;
    bucket.totalPaise += expense.baseAmountPaise;
    bucket.count += 1;
  }

  return [...buckets.values()];
}

export async function getDaily(userId, { groupId = null, from = null, to = null } = {}) {
  const rangeTo = to || new Date();
  let rangeFrom = from || addDays(rangeTo, -89);
  if (rangeFrom > rangeTo) return [];
  const maxSpan = 400 * 24 * 60 * 60 * 1000;
  if (rangeTo.getTime() - rangeFrom.getTime() > maxSpan) {
    rangeFrom = addDays(rangeTo, -399);
  }

  const expenses = await fetchExpenses(userId, { groupId, from: rangeFrom, to: rangeTo });
  const buckets = new Map();
  const cursor = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), rangeFrom.getDate());
  const last = new Date(rangeTo.getFullYear(), rangeTo.getMonth(), rangeTo.getDate());
  for (; cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    buckets.set(dayKey(cursor), {
      date: dayKey(cursor),
      totalPaise: 0,
      mySharePaise: 0,
      count: 0,
    });
  }

  for (const expense of expenses) {
    const bucket = buckets.get(dayKey(new Date(expense.date)));
    if (!bucket) continue;
    bucket.totalPaise += expense.baseAmountPaise;
    bucket.mySharePaise += sumShares(expense, userId);
    bucket.count += 1;
  }

  return [...buckets.values()];
}

export async function getCategories(userId, { groupId = null, from = null, to = null } = {}) {  const expenses = await fetchExpenses(userId, { groupId, from, to });
  const map = new Map();
  for (const expense of expenses) {
    const category = expense.category;
    const id = category?._id ? String(category._id) : 'uncategorized';
    if (!map.has(id)) {
      map.set(id, {
        categoryId: id,
        name: category?.name || 'Uncategorized',
        icon: category?.icon || 'Receipt',
        color: category?.color || '#6366f1',
        totalPaise: 0,
        mySharePaise: 0,
        count: 0,
      });
    }
    const row = map.get(id);
    row.totalPaise += expense.baseAmountPaise;
    row.mySharePaise += sumShares(expense, userId);
    row.count += 1;
  }
  return [...map.values()].sort((a, b) => b.totalPaise - a.totalPaise);
}

export async function getMembers(userId, { groupId = null, from = null, to = null } = {}) {
  const expenses = await fetchExpenses(userId, { groupId, from, to });
  const map = new Map();
  const ensure = (id) => {
    if (!map.has(id)) map.set(id, { userId: id, paidPaise: 0, sharePaise: 0, count: 0 });
    return map.get(id);
  };
  for (const expense of expenses) {
    const seen = new Set();
    for (const payer of expense.paidBy || []) {
      ensure(String(payer.user)).paidPaise += payer.baseAmountPaise;
    }
    for (const split of expense.splits || []) {
      const row = ensure(String(split.user));
      row.sharePaise += split.baseAmountPaise;
      if (!seen.has(String(split.user))) {
        row.count += 1;
        seen.add(String(split.user));
      }
    }
  }
  const users = await User.find({ _id: { $in: [...map.keys()] } })
    .select('name email avatarColor avatarUrl')
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));

  return [...map.values()]
    .filter((row) => byId.has(row.userId))
    .map((row) => {
      const user = byId.get(row.userId);
      return {
        ...row,
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        netPaise: row.paidPaise - row.sharePaise,
        isCurrentUser: String(row.userId) === String(userId),
      };
    })
    .sort((a, b) => b.paidPaise - a.paidPaise);
}

export async function getGroups(userId, { from = null, to = null } = {}) {
  const expenses = await fetchExpenses(userId, { from, to });
  const map = new Map();
  for (const expense of expenses) {
    const group = expense.group;
    const id = group?._id ? String(group._id) : 'personal';
    if (!map.has(id)) {
      map.set(id, {
        groupId: id,
        name: group?.name || 'No group',
        emoji: group?.emoji || '🏠',
        totalPaise: 0,
        mySharePaise: 0,
        count: 0,
      });
    }
    const row = map.get(id);
    row.totalPaise += expense.baseAmountPaise;
    row.mySharePaise += sumShares(expense, userId);
    row.count += 1;
  }
  return [...map.values()].sort((a, b) => b.totalPaise - a.totalPaise);
}

export async function getDashboardExtras(userId) {
  const expenses = await fetchExpenses(userId);
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = sorted.slice(0, 6);
  const users = await User.find({
    _id: { $in: recent.flatMap((e) => (e.paidBy || []).map((p) => p.user)) },
  })
    .select('name avatarColor avatarUrl')
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  return recent.map((expense) => ({
    ...expense,
    paidBy: (expense.paidBy || []).map((payer) => ({
      ...payer,
      user: byId.get(String(payer.user)) || payer.user,
    })),
    mySharePaise: sumShares(expense, userId),
  }));
}
