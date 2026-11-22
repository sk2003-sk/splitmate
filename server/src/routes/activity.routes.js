import { Router } from 'express';
import { Activity } from '../models/Activity.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/ApiError.js';
import { groupIdsForUser, assertGroupMember } from '../services/access.service.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const groups = await groupIdsForUser(req.user._id);
    const filter = { $or: [{ actor: req.user._id }, { group: { $in: groups } }] };

    if (req.query.groupId) {
      await assertGroupMember(req.query.groupId, req.user._id);
      filter.group = req.query.groupId;
    }
    if (req.query.entityType) filter.entityType = req.query.entityType;

    const [items, total] = await Promise.all([
      Activity.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name avatarColor avatarUrl')
        .populate('group', 'name emoji')
        .lean(),
      Activity.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  }),
);

export default router;
