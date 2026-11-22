import { Router } from 'express';
import { Category } from '../models/Category.js';
import { Expense } from '../models/Expense.js';
import { RecurringExpense } from '../models/RecurringExpense.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { categorySchema } from '../validation/schemas.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await Category.find({
      $or: [{ isDefault: true }, { createdBy: req.user._id }],
    })
      .sort({ isDefault: -1, name: 1 })
      .lean();
    res.json({ categories });
  }),
);

router.post(
  '/',
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const existing = await Category.findOne({
      name: req.body.name,
      createdBy: req.user._id,
    });
    if (existing) throw new ApiError(409, 'You already have a category with this name');

    const category = await Category.create({
      name: req.body.name,
      icon: req.body.icon,
      color: req.body.color,
      isDefault: false,
      createdBy: req.user._id,
    });
    res.status(201).json({ category });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw new ApiError(404, 'Category not found');
    if (category.isDefault) throw new ApiError(400, 'Default categories cannot be deleted');
    if (String(category.createdBy) !== String(req.user._id)) {
      throw new ApiError(403, 'You can only delete your own categories');
    }
    const [expenses, recurring] = await Promise.all([
      Expense.countDocuments({ category: category._id }),
      RecurringExpense.countDocuments({ category: category._id }),
    ]);
    if (expenses || recurring) {
      throw new ApiError(409, 'This category is in use and cannot be deleted');
    }
    await category.deleteOne();
    res.json({ ok: true });
  }),
);

export default router;
