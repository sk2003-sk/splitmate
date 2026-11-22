import { Types } from 'mongoose';
import { Expense } from '../models/Expense.js';
import { Settlement } from '../models/Settlement.js';
import { User } from '../models/User.js';
import { groupIdsForUser } from './access.service.js';
import { allocate } from '../utils/money.js';

const pairKey = (from, to) => `${from}|${to}`;

async function visibleExpenses({ userId, groupId = null }) {
  const match = {};
  if (groupId) match.group = new Types.ObjectId(groupId);
  if (userId) {
    const uid = new Types.ObjectId(userId);
    const groups = await groupIdsForUser(uid);
    match.$or = [
      { createdBy: uid },
      { 'paidBy.user': uid },
      { 'splits.user': uid },
      { group: { $in: groups } },
    ];
  }
  return Expense.find(match)
    .select('description baseAmountPaise currency date group category paidBy splits createdBy')
    .populate('group', 'name emoji')
    .populate('category', 'name icon color')
    .lean();
}

async function visibleSettlements({ userId, groupId = null }) {
  const match = { status: 'COMPLETED' };
  if (groupId) match.group = new Types.ObjectId(groupId);
  if (userId) {
    const uid = new Types.ObjectId(userId);
    const groups = await groupIdsForUser(uid);
    match.$or = [{ fromUser: uid }, { toUser: uid }, { createdBy: uid }, { group: { $in: groups } }];
  }
  return Settlement.find(match).select('fromUser toUser amountPaise group createdAt').lean();
}

/** Pairwise debts: debtor -> creditor, net of settlements. */
export async function computePairwise({ userId = null, groupId = null } = {}) {
  const expenses = await visibleExpenses({ userId, groupId });
  const settlements = await visibleSettlements({ userId, groupId });

  const map = new Map();
  const add = (from, to, amount) => {
    if (!amount || from === to) return;
    const key = pairKey(from, to);
    map.set(key, (map.get(key) || 0) + amount);
  };

  for (const expense of expenses) {
    const payers = expense.paidBy || [];
    if (!payers.length) continue;
    const weights = payers.map((p) => p.baseAmountPaise);
    for (const split of expense.splits || []) {
      if (!split.baseAmountPaise) continue;
      const parts = allocate(split.baseAmountPaise, weights);
      payers.forEach((payer, index) => {
        add(String(split.user), String(payer.user), parts[index]);
      });
    }
  }

  for (const settlement of settlements) {
    add(String(settlement.fromUser), String(settlement.toUser), -settlement.amountPaise);
  }

  const seen = new Set();
  const rows = [];
  for (const [key, value] of map) {
    const [a, b] = key.split('|');
    const canonical = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const net = value + (map.get(pairKey(b, a)) || 0) * -1;
    if (!net) continue;
    rows.push(
      net > 0
        ? { from: a, to: b, amountPaise: net }
        : { from: b, to: a, amountPaise: Math.abs(net) },
    );
  }

  const ids = [...new Set(rows.flatMap((row) => [row.from, row.to]))];
  const users = await User.find({ _id: { $in: ids } })
    .select('name email avatarColor avatarUrl upiId')
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));

  return rows
    .filter((row) => byId.has(row.from) && byId.has(row.to))
    .map((row) => ({
      from: byId.get(row.from),
      to: byId.get(row.to),
      amountPaise: row.amountPaise,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
}

export function netPositions(pairwise) {
  const positions = new Map();
  for (const row of pairwise) {
    const from = String(row.from._id || row.from);
    const to = String(row.to._id || row.to);
    positions.set(from, (positions.get(from) || 0) - row.amountPaise);
    positions.set(to, (positions.get(to) || 0) + row.amountPaise);
  }
  return positions;
}

/** Greedy debt simplification from net positions. */
export function simplifyDebts(pairwise) {
  const positions = netPositions(pairwise);
  const debtors = [];
  const creditors = [];
  for (const [userId, amount] of positions) {
    if (amount < 0) debtors.push({ userId, amount: -amount });
    if (amount > 0) creditors.push({ userId, amount });
  }
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].amount, creditors[c].amount);
    if (pay > 0) {
      transfers.push({ from: debtors[d].userId, to: creditors[c].userId, amountPaise: pay });
    }
    debtors[d].amount -= pay;
    creditors[c].amount -= pay;
    if (debtors[d].amount === 0) d += 1;
    if (creditors[c].amount === 0) c += 1;
  }
  return transfers;
}

export function summarizeForUser(pairwise, userId) {
  const uid = String(userId);
  const youOwe = pairwise.filter((row) => String(row.from._id) === uid);
  const youAreOwed = pairwise.filter((row) => String(row.to._id) === uid);
  const sum = (rows) => rows.reduce((total, row) => total + row.amountPaise, 0);
  return {
    youOwePaise: sum(youOwe),
    youAreOwedPaise: sum(youAreOwed),
    youOwe,
    youAreOwed,
    netPaise: sum(youAreOwed) - sum(youOwe),
  };
}

/** Every expense / settlement that produced the balance for one pair. */
export async function pairBreakdown(userId, otherUserId) {
  const uid = String(userId);
  const other = String(otherUserId);
  const expenses = await visibleExpenses({ userId });
  const settlements = await visibleSettlements({ userId });
  const entries = [];

  for (const expense of expenses) {
    const payers = expense.paidBy || [];
    if (!payers.length) continue;
    const weights = payers.map((p) => p.baseAmountPaise);
    for (const split of expense.splits || []) {
      if (!split.baseAmountPaise) continue;
      const parts = allocate(split.baseAmountPaise, weights);
      payers.forEach((payer, index) => {
        const from = String(split.user);
        const to = String(payer.user);
        const amount = parts[index];
        if (!amount || from === to) return;
        const matches =
          (from === other && to === uid) || (from === uid && to === other);
        if (!matches) return;
        const sign = from === other ? 1 : -1;
        entries.push({
          type: 'expense',
          id: expense._id,
          date: expense.date,
          title: expense.description,
          group: expense.group,
          category: expense.category,
          amountPaise: amount * sign,
        });
      });
    }
  }

  for (const settlement of settlements) {
    const from = String(settlement.fromUser);
    const to = String(settlement.toUser);
    const matches = (from === other && to === uid) || (from === uid && to === other);
    if (!matches) continue;
    entries.push({
      type: 'settlement',
      id: settlement._id,
      date: settlement.createdAt,
      title: from === uid ? 'Payment you made' : 'Payment received',
      group: settlement.group,
      amountPaise: from === other ? -settlement.amountPaise : settlement.amountPaise,
    });
  }

  return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
}
