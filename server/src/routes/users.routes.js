import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Expense } from '../models/Expense.js';
import { Settlement } from '../models/Settlement.js';
import { Payment } from '../models/Payment.js';
import { EmailCapture } from '../models/EmailCapture.js';
import { requireAuth, clearAuthCookie } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { userCreateSchema, userUpdateSchema } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { computePairwise } from '../services/balance.service.js';
import { pickAvatarColor, randomToken } from '../utils/identity.js';

const router = Router();
router.use(requireAuth);

const PUBLIC_FIELDS = 'name email avatarColor avatarUrl upiId defaultCurrency theme monthlyBudgetPaise trackPayments paymentPromptSeen isDemo hasAccount createdAt';

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const filter = q ? { $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] } : {};
    const users = await User.find(filter).select(PUBLIC_FIELDS).sort({ name: 1 }).lean();
    res.json({ users });
  }),
);

router.post(
  '/',
  validate(userCreateSchema),
  asyncHandler(async (req, res) => {
    const { name, email, avatarColor } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, 'Someone with this email is already a member');

    const user = await User.create({
      name,
      email,
      hasAccount: false,
      passwordHash: await bcrypt.hash(randomToken(16), 10),
      avatarColor: avatarColor || pickAvatarColor(name),
      isDemo: false,
    });

    res.status(201).json({ user: user.toJSON() });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select(PUBLIC_FIELDS);
    if (!user) throw new ApiError(404, 'Member not found');

    const [sharedGroups, pairwise] = await Promise.all([
      Group.find({ members: { $all: [req.user._id, user._id] } })
        .select('name emoji members')
        .lean(),
      computePairwise({ userId: req.user._id }),
    ]);

    const row = pairwise.find(
      (entry) =>
        String(entry.from._id) === String(user._id) ||
        String(entry.to._id) === String(user._id),
    );

    res.json({
      user,
      sharedGroups: sharedGroups.map((group) => ({
        _id: group._id,
        name: group.name,
        emoji: group.emoji,
        memberCount: group.members.length,
      })),
      balancePaise: row
        ? String(row.from._id) === String(user._id)
          ? -row.amountPaise
          : row.amountPaise
        : 0,
    });
  }),
);

router.put(
  '/:id',
  validate(userUpdateSchema),
  asyncHandler(async (req, res) => {
    if (String(req.params.id) !== String(req.user._id)) {
      throw new ApiError(403, 'You can only edit your own profile');
    }
    const { monthlyBudget, ...rest } = req.body;
    const updates = { ...rest };
    if (monthlyBudget !== undefined) updates.monthlyBudgetPaise = Math.round(monthlyBudget * 100);

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select(PUBLIC_FIELDS);
    res.json({ user });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (String(req.params.id) !== String(req.user._id)) {
      throw new ApiError(403, 'You can only delete your own account');
    }
    const uid = req.user._id;

    const [expenseCount, settlementCount, createdGroups, pairwise] = await Promise.all([
      Expense.countDocuments({
        $or: [{ createdBy: uid }, { 'paidBy.user': uid }, { 'splits.user': uid }],
      }),
      Settlement.countDocuments({ $or: [{ fromUser: uid }, { toUser: uid }] }),
      Group.countDocuments({ createdBy: uid }),
      computePairwise({ userId: uid }),
    ]);

    const hasBalance = pairwise.some(
      (row) => String(row.from._id) === String(uid) || String(row.to._id) === String(uid),
    );

    if (hasBalance) throw new ApiError(409, 'Settle all your balances before deleting your account');
    if (settlementCount) throw new ApiError(409, 'You have payment history that must be retained');
    if (createdGroups) throw new ApiError(409, 'Delete or hand over groups you created first');
    if (expenseCount) throw new ApiError(409, 'You have expense history that must be retained');

    await Group.updateMany({ members: uid }, { $pull: { members: uid } });
    await Payment.deleteMany({ user: uid });
    await EmailCapture.deleteMany({ user: uid });
    await User.findByIdAndDelete(uid);
    clearAuthCookie(res);
    res.json({ ok: true });
  }),
);

export default router;
