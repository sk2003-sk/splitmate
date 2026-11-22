import { Expense } from '../models/Expense.js';
import { RecurringExpense } from '../models/RecurringExpense.js';
import { logActivity } from './activity.service.js';

export function nextRunDate(from, frequency) {
  const date = new Date(from);
  if (frequency === 'WEEKLY') {
    date.setDate(date.getDate() + 7);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date;
}

export async function runDueRecurrings({ userId = null } = {}) {
  const filter = { active: true, nextRunAt: { $lte: new Date() } };
  if (userId) filter.createdBy = userId;
  const due = await RecurringExpense.find(filter);

  for (const recurring of due) {
    try {
      await Expense.create({
        description: recurring.description,
        amountPaise: recurring.amountPaise,
        baseAmountPaise: recurring.baseAmountPaise,
        currency: recurring.currency,
        exchangeRate: recurring.exchangeRate,
        category: recurring.category,
        group: recurring.group,
        date: recurring.nextRunAt,
        notes: recurring.notes,
        paidBy: recurring.paidBy,
        splits: recurring.splits,
        splitMethod: recurring.splitMethod,
        createdBy: recurring.createdBy,
        recurringId: recurring._id,
      });
      await logActivity({
        actor: recurring.createdBy,
        action: 'RECURRING_EXPENSE_CREATED',
        entityType: 'recurring',
        entityId: recurring._id,
        group: recurring.group,
        amountPaise: recurring.baseAmountPaise,
        message: `Recurring expense “${recurring.description}” was created`,
      });
      recurring.lastRunAt = recurring.nextRunAt;
      recurring.nextRunAt = nextRunDate(recurring.nextRunAt, recurring.frequency);
      await recurring.save();
    } catch (error) {
      console.error(`Recurring expense ${recurring._id} failed:`, error.message);
    }
  }

  return due.length;
}
