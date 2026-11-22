import { Router } from 'express';
import { Settlement } from '../models/Settlement.js';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { settlementSchema, settlementUpdateSchema } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { settlementAccessFilter } from '../services/access.service.js';
import { logActivity, notifyUsers } from '../services/activity.service.js';
import { formatINR, toPaise } from '../utils/money.js';

const router = Router();
router.use(requireAuth);

const populateConfig = [
  { path: 'fromUser', select: 'name email avatarColor avatarUrl upiId' },
  { path: 'toUser', select: 'name email avatarColor avatarUrl upiId' },
  { path: 'group', select: 'name emoji' },
  { path: 'createdBy', select: 'name avatarColor avatarUrl' },
];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const filter = await settlementAccessFilter(req.user._id, {
      groupId: req.query.groupId || null,
    });
    if (req.query.withUserId) {
      filter.$and = [
        {
          $or: [
            { fromUser: req.query.withUserId },
            { toUser: req.query.withUserId },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      Settlement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(populateConfig)
        .lean(),
      Settlement.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

router.post(
  '/',
  validate(settlementSchema),
  asyncHandler(async (req, res) => {
    const { fromUser, toUser, group, method, reference, receiptUrl, note } = req.body;
    const uid = String(req.user._id);

    if (fromUser === toUser) {
      throw new ApiError(400, 'Choose two different people');
    }
    if (fromUser !== uid && toUser !== uid) {
      throw new ApiError(403, 'You can only record a payment that involves you');
    }

    const otherId = fromUser === uid ? toUser : fromUser;
    const [other, groupDoc] = await Promise.all([
      User.findById(otherId).select('name'),
      group ? Group.findById(group) : Promise.resolve(null),
    ]);
    if (!other) throw new ApiError(404, 'That member no longer exists');
    if (group) {
      if (!groupDoc) throw new ApiError(404, 'Group not found');
      const members = groupDoc.members.map(String);
      if (!members.includes(uid) || !members.includes(otherId)) {
        throw new ApiError(403, 'Both people must be members of this group');
      }
    }

    const amountPaise = toPaise(req.body.amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new ApiError(400, 'Enter a valid payment amount');
    }

    const key = (req.get('Idempotency-Key') || '').trim() || null;

    if (key) {
      const existing = await Settlement.findOne({ idempotencyKey: key });
      if (existing) {
        if (String(existing.createdBy) !== String(req.user._id)) {
          throw new ApiError(409, 'This idempotency key was already used');
        }
        const populated = await existing.populate(populateConfig);
        return res.status(200).json({ settlement: populated.toJSON(), duplicate: true });
      }
    }

    let settlement;
    try {
      settlement = await Settlement.create({
        fromUser,
        toUser,
        group: group || null,
        amountPaise,
        method,
        reference,
        receiptUrl,
        note,
        createdBy: req.user._id,
        idempotencyKey: key,
      });
    } catch (error) {
      if (error.code === 11000 && key) {
        const existing = await Settlement.findOne({ idempotencyKey: key });
        if (existing) {
          const populated = await existing.populate(populateConfig);
          return res.status(200).json({ settlement: populated.toJSON(), duplicate: true });
        }
      }
      throw error;
    }

    await notifyUsers(
      [other._id],
      {
        type: 'SETTLEMENT',
        title: 'Payment recorded',
        message: `${req.user.name} recorded a ${formatINR(amountPaise)} payment`,
        link: '/settlements',
      },
      req.user._id,
    );
    await logActivity({
      actor: req.user._id,
      action: 'SETTLEMENT_CREATED',
      entityType: 'settlement',
      entityId: settlement._id,
      group: settlement.group,
      amountPaise,
      message: `${req.user.name} recorded a ${formatINR(amountPaise)} payment with ${other.name}`,
    });

    const populated = await settlement.populate(populateConfig);
    res.status(201).json({ settlement: populated.toJSON() });
  }),
);

router.put(
  '/:id',
  validate(settlementUpdateSchema),
  asyncHandler(async (req, res) => {
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) throw new ApiError(404, 'Payment not found');

    const involved = [String(settlement.fromUser), String(settlement.toUser)];
    if (!involved.includes(String(req.user._id))) {
      throw new ApiError(403, 'You can only update payments that involve you');
    }

    if (req.body.status === 'REVERSED') {
      if (settlement.status === 'REVERSED') {
        throw new ApiError(409, 'This payment has already been reversed');
      }
      settlement.status = 'REVERSED';
      settlement.reversedAt = new Date();
      settlement.reversedBy = req.user._id;
      await settlement.save();

      await logActivity({
        actor: req.user._id,
        action: 'SETTLEMENT_REVERSED',
        entityType: 'settlement',
        entityId: settlement._id,
        group: settlement.group,
        amountPaise: settlement.amountPaise,
        message: `${req.user.name} reversed a ${formatINR(settlement.amountPaise)} payment`,
      });

      const otherId =
        String(settlement.fromUser) === String(req.user._id)
          ? settlement.toUser
          : settlement.fromUser;
      await notifyUsers(
        [otherId],
        {
          type: 'SETTLEMENT',
          title: 'Payment reversed',
          message: `${req.user.name} reversed a ${formatINR(settlement.amountPaise)} payment`,
          link: '/settlements',
        },
        req.user._id,
      );

      const populated = await settlement.populate(populateConfig);
      return res.json({ settlement: populated.toJSON() });
    }

    if (settlement.status === 'REVERSED') {
      throw new ApiError(409, 'Reversed payments cannot be edited');
    }

    if (req.body.amount !== undefined) {
      settlement.amountPaise = toPaise(req.body.amount);
    }
    if (req.body.method !== undefined) settlement.method = req.body.method;
    if (req.body.reference !== undefined) settlement.reference = req.body.reference;
    if (req.body.receiptUrl !== undefined) settlement.receiptUrl = req.body.receiptUrl;
    if (req.body.note !== undefined) settlement.note = req.body.note;

    await settlement.save();
    await logActivity({
      actor: req.user._id,
      action: 'SETTLEMENT_UPDATED',
      entityType: 'settlement',
      entityId: settlement._id,
      group: settlement.group,
      amountPaise: settlement.amountPaise,
      message: `${req.user.name} updated a payment`,
    });

    const populated = await settlement.populate(populateConfig);
    res.json({ settlement: populated.toJSON() });
  }),
);

export default router;
