import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';

export async function logActivity({ actor, action, entityType, entityId, group, amountPaise, message, meta }) {
  try {
    await Activity.create({
      actor,
      action,
      entityType,
      entityId: entityId || null,
      group: group || null,
      amountPaise: amountPaise ?? null,
      message: message || '',
      meta: meta || {},
    });
  } catch (error) {
    console.error('Failed to record activity:', error.message);
  }
}

export async function notifyUsers(userIds, payload, excludeUserId = null) {
  const ids = [...new Set((userIds || []).map(String))].filter(
    (id) => id !== String(excludeUserId),
  );
  if (!ids.length) return;
  try {
    await Notification.insertMany(ids.map((user) => ({ user, ...payload })));
  } catch (error) {
    console.error('Failed to create notifications:', error.message);
  }
}

export async function buildExpenseMessage(expense, actorName) {
  return `${actorName} added “${expense.description}”`;
}
