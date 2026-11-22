import { Router } from 'express';
import { Group } from '../models/Group.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import {
  computePairwise,
  simplifyDebts,
  summarizeForUser,
  pairBreakdown,
} from '../services/balance.service.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [pairwise, groups] = await Promise.all([
      computePairwise({ userId: req.user._id }),
      Group.find({ members: req.user._id }).select('name emoji').sort({ name: 1 }).lean(),
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

    const groupBalances = await Promise.all(
      groups.map(async (group) => {
        const rows = await computePairwise({ userId: req.user._id, groupId: group._id });
        const groupSummary = summarizeForUser(rows, req.user._id);
        return {
          group,
          youOwePaise: groupSummary.youOwePaise,
          youAreOwedPaise: groupSummary.youAreOwedPaise,
          netPaise: groupSummary.netPaise,
          pairwise: rows,
        };
      }),
    );

    res.json({
      summary: {
        youOwePaise: summary.youOwePaise,
        youAreOwedPaise: summary.youAreOwedPaise,
        netPaise: summary.netPaise,
      },
      pairwise,
      simplified,
      groupBalances,
    });
  }),
);

router.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const target = await User.findById(req.params.userId).select(
      'name email avatarColor avatarUrl upiId',
    );
    if (!target) throw new ApiError(404, 'Member not found');

    if (String(target._id) !== String(req.user._id)) {
      const sharedGroup = await Group.exists({
        members: { $all: [req.user._id, target._id] },
      });
      if (!sharedGroup) {
        throw new ApiError(403, 'You can only view balances for people you share a group with');
      }
    }

    const [pairwise, breakdown] = await Promise.all([
      computePairwise({ userId: req.user._id }),
      pairBreakdown(req.user._id, target._id),
    ]);

    const row = pairwise.find(
      (entry) =>
        (String(entry.from._id) === String(target._id) &&
          String(entry.to._id) === String(req.user._id)) ||
        (String(entry.from._id) === String(req.user._id) &&
          String(entry.to._id) === String(target._id)),
    );

    // Positive balance means this person owes the current user.
    const balancePaise = row
      ? String(row.from._id) === String(target._id)
        ? row.amountPaise
        : -row.amountPaise
      : 0;

    res.json({ user: target, balancePaise, breakdown });
  }),
);

export default router;
