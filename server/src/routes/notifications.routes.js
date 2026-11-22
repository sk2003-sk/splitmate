import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = { user: req.user._id };

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit), unreadCount });
  }),
);

router.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } },
    );
    res.json({ updated: result.modifiedCount });
  }),
);

router.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notification) throw new ApiError(404, 'Notification not found');
    notification.read = true;
    await notification.save();
    res.json({ notification });
  }),
);

export default router;
