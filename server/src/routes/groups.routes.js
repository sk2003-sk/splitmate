import { Router } from 'express';
import { Group } from '../models/Group.js';
import { User } from '../models/User.js';
import { Expense } from '../models/Expense.js';
import { Settlement } from '../models/Settlement.js';
import { RecurringExpense } from '../models/RecurringExpense.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { groupCreateSchema, groupUpdateSchema, objectId } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { assertGroupMember } from '../services/access.service.js';
import {
  computePairwise,
  simplifyDebts,
  summarizeForUser,
} from '../services/balance.service.js';
import { logActivity, notifyUsers } from '../services/activity.service.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const MEMBER_FIELDS = 'name email avatarColor avatarUrl';

async function populateGroup(group) {
  await group.populate([
    { path: 'members', select: MEMBER_FIELDS },
    { path: 'createdBy', select: MEMBER_FIELDS },
  ]);
  return group;
}

async function memberHasGroupBalance(groupId, viewerId, memberId) {
  const rows = await computePairwise({ userId: viewerId, groupId });
  return rows.some(
    (row) =>
      String(row.from._id) === String(memberId) || String(row.to._id) === String(memberId),
  );
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', MEMBER_FIELDS)
      .populate('createdBy', MEMBER_FIELDS)
      .sort({ updatedAt: -1 });

    const ids = groups.map((group) => group._id);
    const totals = await Expense.aggregate([
      { $match: { group: { $in: ids } } },
      { $group: { _id: '$group', totalPaise: { $sum: '$baseAmountPaise' }, count: { $sum: 1 } } },
    ]);
    const byGroup = new Map(totals.map((row) => [String(row._id), row]));

    res.json({
      groups: groups.map((group) => {
        const stats = byGroup.get(String(group._id));
        return {
          ...group.toJSON(),
          memberCount: group.members.length,
          totalPaise: stats?.totalPaise || 0,
          expenseCount: stats?.count || 0,
        };
      }),
    });
  }),
);

router.post(
  '/',
  validate(groupCreateSchema),
  asyncHandler(async (req, res) => {
    const memberIds = [...new Set([String(req.user._id), ...req.body.members.map(String)])];
    const count = await User.countDocuments({ _id: { $in: memberIds } });
    if (count !== memberIds.length) {
      throw new ApiError(400, 'One or more selected members no longer exist');
    }

    const group = await Group.create({
      name: req.body.name,
      description: req.body.description,
      emoji: req.body.emoji,
      imageUrl: req.body.imageUrl,
      members: memberIds,
      createdBy: req.user._id,
    });

    await notifyUsers(
      memberIds,
      {
        type: 'GROUP_INVITE',
        title: 'You were added to a group',
        message: `${req.user.name} added you to “${group.name}”`,
        link: `/groups/${group._id}`,
      },
      req.user._id,
    );
    await logActivity({
      actor: req.user._id,
      action: 'GROUP_CREATED',
      entityType: 'group',
      entityId: group._id,
      group: group._id,
      message: `${req.user.name} created “${group.name}”`,
    });

    await populateGroup(group);
    res.status(201).json({ group: group.toJSON() });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const group = await assertGroupMember(req.params.id, req.user._id);
    await populateGroup(group);

    const [pairwise, statsRows] = await Promise.all([
      computePairwise({ userId: req.user._id, groupId: group._id }),
      Expense.aggregate([
        { $match: { group: group._id } },
        { $group: { _id: null, totalPaise: { $sum: '$baseAmountPaise' }, count: { $sum: 1 } } },
      ]),
    ]);

    const summary = summarizeForUser(pairwise, req.user._id);
    const users = new Map();
    for (const row of pairwise) {
      users.set(String(row.from._id), row.from);
      users.set(String(row.to._id), row.to);
    }
    const simplified = simplifyDebts(pairwise).map((transfer) => ({
      from: users.get(transfer.from),
      to: users.get(transfer.to),
      amountPaise: transfer.amountPaise,
    }));

    res.json({
      group: group.toJSON(),
      balances: {
        summary: {
          youOwePaise: summary.youOwePaise,
          youAreOwedPaise: summary.youAreOwedPaise,
          netPaise: summary.netPaise,
        },
        pairwise,
        simplified,
      },
      stats: {
        totalPaise: statsRows[0]?.totalPaise || 0,
        expenseCount: statsRows[0]?.count || 0,
      },
    });
  }),
);

router.put(
  '/:id',
  validate(groupUpdateSchema),
  asyncHandler(async (req, res) => {
    const group = await assertGroupMember(req.params.id, req.user._id);
    const updates = { ...req.body };

    if (updates.members) {
      if (String(group.createdBy) !== String(req.user._id)) {
        throw new ApiError(403, 'Only the group creator can manage members');
      }
      const next = [
        ...new Set([...updates.members.map(String), String(group.createdBy)]),
      ];
      const current = group.members.map(String);
      const removed = current.filter((id) => !next.includes(id));
      for (const memberId of removed) {
        if (await memberHasGroupBalance(group._id, req.user._id, memberId)) {
          throw new ApiError(409, 'That member still has an unsettled balance in this group');
        }
      }
      const count = await User.countDocuments({ _id: { $in: next } });
      if (count !== next.length) throw new ApiError(400, 'One or more selected members no longer exist');
      const added = next.filter((id) => !current.includes(id));
      updates.members = next;

      if (added.length) {
        await notifyUsers(
          added,
          {
            type: 'GROUP_INVITE',
            title: 'You were added to a group',
            message: `${req.user.name} added you to “${group.name}”`,
            link: `/groups/${group._id}`,
          },
          req.user._id,
        );
        await logActivity({
          actor: req.user._id,
          action: 'MEMBER_ADDED',
          entityType: 'member',
          entityId: group._id,
          group: group._id,
          message: `${req.user.name} added members to “${group.name}”`,
        });
      }
    }

    Object.assign(group, updates);
    await group.save();
    await populateGroup(group);
    res.json({ group: group.toJSON() });
  }),
);

router.post(
  '/:id/members',
  validate(z.object({ userId: objectId })),
  asyncHandler(async (req, res) => {
    const group = await assertGroupMember(req.params.id, req.user._id);
    const userId = req.body.userId;
    if (group.members.some((id) => String(id) === String(userId))) {
      throw new ApiError(409, 'This person is already in the group');
    }
    const user = await User.findById(userId).select('name');
    if (!user) throw new ApiError(404, 'Member not found');

    group.members.push(userId);
    await group.save();

    await notifyUsers(
      [userId],
      {
        type: 'GROUP_INVITE',
        title: 'You were added to a group',
        message: `${req.user.name} added you to “${group.name}”`,
        link: `/groups/${group._id}`,
      },
      req.user._id,
    );
    await logActivity({
      actor: req.user._id,
      action: 'MEMBER_ADDED',
      entityType: 'member',
      entityId: userId,
      group: group._id,
      message: `${req.user.name} added ${user.name} to “${group.name}”`,
    });

    await populateGroup(group);
    res.json({ group: group.toJSON() });
  }),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const group = await assertGroupMember(req.params.id, req.user._id);
    const targetId = req.params.userId;

    if (String(group.createdBy) === String(targetId)) {
      throw new ApiError(400, 'The group creator cannot be removed');
    }
    const isCreator = String(group.createdBy) === String(req.user._id);
    const isSelf = String(req.user._id) === String(targetId);
    if (!isCreator && !isSelf) {
      throw new ApiError(403, 'Only the group creator can remove other members');
    }
    if (!group.members.some((id) => String(id) === String(targetId))) {
      throw new ApiError(404, 'That person is not in this group');
    }
    if (await memberHasGroupBalance(group._id, req.user._id, targetId)) {
      throw new ApiError(409, 'Settle their balance in this group before removing them');
    }

    const target = await User.findById(targetId).select('name');
    group.members = group.members.filter((id) => String(id) !== String(targetId));
    await group.save();

    await logActivity({
      actor: req.user._id,
      action: isSelf ? 'MEMBER_LEFT' : 'MEMBER_REMOVED',
      entityType: 'member',
      entityId: targetId,
      group: group._id,
      message: isSelf
        ? `${req.user.name} left “${group.name}”`
        : `${req.user.name} removed ${target?.name || 'a member'} from “${group.name}”`,
    });

    await populateGroup(group);
    res.json({ group: group.toJSON() });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const group = await assertGroupMember(req.params.id, req.user._id);
    if (String(group.createdBy) !== String(req.user._id)) {
      throw new ApiError(403, 'Only the group creator can delete this group');
    }

    const [expenseCount, settlementCount] = await Promise.all([
      Expense.countDocuments({ group: group._id }),
      Settlement.countDocuments({ group: group._id }),
    ]);

    if ((expenseCount || settlementCount) && req.query.force !== 'true') {
      throw new ApiError(
        409,
        `This group has ${expenseCount} expenses and ${settlementCount} settlements. Confirm with force=true to delete them permanently.`,
      );
    }

    await Promise.all([
      Expense.deleteMany({ group: group._id }),
      Settlement.deleteMany({ group: group._id }),
      RecurringExpense.deleteMany({ group: group._id }),
      Group.deleteOne({ _id: group._id }),
    ]);

    await logActivity({
      actor: req.user._id,
      action: 'GROUP_DELETED',
      entityType: 'group',
      entityId: group._id,
      message: `${req.user.name} deleted “${group.name}”`,
    });

    res.json({ ok: true });
  }),
);

export default router;
