import { Types } from 'mongoose';
import { Group } from '../models/Group.js';

export async function groupIdsForUser(userId) {
  return Group.find({ members: userId }).distinct('_id');
}

export async function assertGroupMember(groupId, userId) {
  const group = await Group.findById(groupId);
  if (!group) {
    const err = new Error('Group not found');
    err.status = 404;
    throw err;
  }
  if (!group.members.some((member) => String(member) === String(userId))) {
    const err = new Error('You do not have access to this group');
    err.status = 403;
    throw err;
  }
  return group;
}

/**
 * Mongo filter for expenses the user is allowed to see.
 * A user sees expenses they created, paid, participate in, or that belong
 * to a group they are a member of.
 */
export async function expenseAccessFilter(userId, { groupId = null, from = null, to = null } = {}) {
  const uid = new Types.ObjectId(userId);
  const groups = await groupIdsForUser(uid);
  const filter = {
    $or: [
      { createdBy: uid },
      { 'paidBy.user': uid },
      { 'splits.user': uid },
      { group: { $in: groups } },
    ],
  };
  if (groupId) filter.group = new Types.ObjectId(groupId);
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  return filter;
}

export async function settlementAccessFilter(userId, { groupId = null } = {}) {
  const uid = new Types.ObjectId(userId);
  const groups = await groupIdsForUser(uid);
  const filter = {
    $or: [{ fromUser: uid }, { toUser: uid }, { createdBy: uid }, { group: { $in: groups } }],
  };
  if (groupId) filter.group = new Types.ObjectId(groupId);
  return filter;
}

export async function sharedUserIds(userId) {
  const groups = await Group.find({ members: userId }).distinct('_id');
  const members = await Group.distinct('members', { _id: { $in: groups } });
  return members.map(String);
}
