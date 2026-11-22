import { ApiError } from '../utils/ApiError.js';
import { allocate, toPaise } from '../utils/money.js';

export const SPLIT_METHODS = ['equal', 'exact', 'percentage', 'shares', 'unequal'];

/**
 * Resolve participant inputs into integer-paise splits that sum to the expense amount.
 * Inputs:
 *  - equal: value ignored
 *  - exact / unequal: value is the participant's amount in rupees
 *  - percentage: value is a percentage (must total 100)
 *  - shares: value is a positive share count
 */
export function resolveSplits({ amountPaise, participants, method = 'equal' }) {
  if (!SPLIT_METHODS.includes(method)) {
    throw new ApiError(400, `Unsupported split method: ${method}`);
  }
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new ApiError(400, 'Select at least one participant');
  }
  const ids = participants.map((p) => String(p.user));
  if (new Set(ids).size !== ids.length) {
    throw new ApiError(400, 'A participant can only be selected once');
  }

  const amount = Math.round(Number(amountPaise));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Expense amount must be greater than zero');
  }

  if (method === 'equal') {
    const parts = allocate(amount, participants.map(() => 1));
    return participants.map((p, index) => ({
      user: p.user,
      amountPaise: parts[index],
      value: null,
    }));
  }

  if (method === 'exact' || method === 'unequal') {
    const values = participants.map((p) => toPaise(p.value ?? 0));
    if (values.some((v) => !Number.isFinite(v) || v < 0)) {
      throw new ApiError(400, 'Custom amounts must be valid positive numbers');
    }
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total !== amount) {
      throw new ApiError(
        400,
        `Custom amounts add up to ₹${(total / 100).toFixed(2)}, but the expense is ₹${(amount / 100).toFixed(2)}`,
      );
    }
    return participants.map((p, index) => ({
      user: p.user,
      amountPaise: values[index],
      value: values[index] / 100,
    }));
  }

  if (method === 'percentage') {
    const values = participants.map((p) => Number(p.value ?? 0));
    if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
      throw new ApiError(400, 'Percentages must be between 0 and 100');
    }
    const total = values.reduce((sum, v) => sum + v, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new ApiError(400, `Percentages must add up to 100% (currently ${total.toFixed(2)}%)`);
    }
    if (values.every((v) => v === 0)) {
      throw new ApiError(400, 'At least one percentage must be greater than zero');
    }
    const parts = allocate(amount, values);
    return participants.map((p, index) => ({
      user: p.user,
      amountPaise: parts[index],
      value: values[index],
    }));
  }

  // shares
  const values = participants.map((p) => Number(p.value ?? 0));
  if (values.some((v) => !Number.isFinite(v) || v < 0)) {
    throw new ApiError(400, 'Shares must be zero or positive numbers');
  }
  if (values.reduce((sum, v) => sum + v, 0) <= 0) {
    throw new ApiError(400, 'Total shares must be greater than zero');
  }
  const parts = allocate(amount, values);
  return participants.map((p, index) => ({
    user: p.user,
    amountPaise: parts[index],
    value: values[index],
  }));
}
