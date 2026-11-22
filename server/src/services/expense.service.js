import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { assertGroupMember } from './access.service.js';
import { resolveSplits } from './split.service.js';
import { ApiError } from '../utils/ApiError.js';
import { allocate, toPaise } from '../utils/money.js';

const MAX_AMOUNT_PAISE = 100_000_000_000; // ₹100 crore

/**
 * Validates an expense payload and converts it into a persistence-ready object.
 * All split math happens here; callers never compute balances themselves.
 */
export async function prepareExpense(input, actor) {
  const amountPaise = toPaise(input.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0 || amountPaise > MAX_AMOUNT_PAISE) {
    throw new ApiError(400, 'Enter a valid expense amount');
  }

  const currency = (input.currency || 'INR').toUpperCase();
  const exchangeRate = Number(input.exchangeRate ?? 1);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new ApiError(400, 'Exchange rate must be greater than zero');
  }
  const baseAmountPaise = Math.max(1, Math.round(amountPaise * exchangeRate));

  if (!input.date || Number.isNaN(new Date(input.date).getTime())) {
    throw new ApiError(400, 'Enter a valid expense date');
  }

  const category = await Category.findById(input.category);
  if (!category) {
    throw new ApiError(400, 'Choose a valid category');
  }

  let group = null;
  if (input.group) {
    group = await assertGroupMember(input.group, actor._id);
  }

  const participantIds = input.participants.map((p) => String(p.user));
  const payerIds = input.paidBy.map((p) => String(p.user));
  const involved = [...new Set([...participantIds, ...payerIds])];

  if (group) {
    const memberIds = new Set(group.members.map(String));
    const outsiders = involved.filter((id) => !memberIds.has(id));
    if (outsiders.length) {
      throw new ApiError(400, 'Everyone on this expense must be a member of the group');
    }
  } else {
    const count = await User.countDocuments({ _id: { $in: involved } });
    if (count !== involved.length) {
      throw new ApiError(400, 'One or more selected people no longer exist');
    }
  }

  const splits = resolveSplits({
    amountPaise,
    participants: input.participants,
    method: input.splitMethod,
  });

  const paidBy = input.paidBy.map((payer) => ({
    user: payer.user,
    amountPaise: toPaise(payer.amount),
  }));
  if (paidBy.some((payer) => !Number.isFinite(payer.amountPaise) || payer.amountPaise <= 0)) {
    throw new ApiError(400, 'Each payer amount must be greater than zero');
  }
  const paidTotal = paidBy.reduce((sum, payer) => sum + payer.amountPaise, 0);
  if (paidTotal !== amountPaise) {
    throw new ApiError(
      400,
      `Payments add up to ₹${(paidTotal / 100).toFixed(2)}, but the expense is ₹${(amountPaise / 100).toFixed(2)}`,
    );
  }

  const basePayments = allocate(baseAmountPaise, paidBy.map((payer) => payer.amountPaise));
  const baseSplits = allocate(baseAmountPaise, splits.map((split) => split.amountPaise));

  return {
    description: input.description.trim(),
    amountPaise,
    baseAmountPaise,
    currency,
    exchangeRate,
    category: category._id,
    group: group?._id || null,
    date: new Date(input.date),
    notes: input.notes || '',
    receiptUrl: input.receiptUrl || '',
    paidBy: paidBy.map((payer, index) => ({
      user: payer.user,
      amountPaise: payer.amountPaise,
      baseAmountPaise: basePayments[index],
    })),
    splits: splits.map((split, index) => ({
      user: split.user,
      amountPaise: split.amountPaise,
      baseAmountPaise: baseSplits[index],
      value: split.value,
    })),
    splitMethod: input.splitMethod,
    createdBy: actor._id,
    updatedBy: actor._id,
    idempotencyKey: input.idempotencyKey || null,
  };
}

export function involvedUserIds(expense) {
  const ids = new Set();
  for (const payer of expense.paidBy || []) ids.add(String(payer.user));
  for (const split of expense.splits || []) ids.add(String(split.user));
  return [...ids];
}

export function canAccessExpense(userId, expense, groupIds = []) {
  const uid = String(userId);
  if (String(expense.createdBy) === uid) return true;
  if ((expense.paidBy || []).some((payer) => String(payer.user) === uid)) return true;
  if ((expense.splits || []).some((split) => String(split.user) === uid)) return true;
  if (expense.group && groupIds.map(String).includes(String(expense.group._id || expense.group))) {
    return true;
  }
  return false;
}
