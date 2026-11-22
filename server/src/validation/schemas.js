import { z } from 'zod';

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const demoLoginSchema = z.object({
  userId: objectId,
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: email.optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  avatarUrl: z.string().max(500).optional(),
  upiId: z.string().max(120).optional(),
  defaultCurrency: z.string().length(3).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  monthlyBudget: z.coerce.number().min(0).max(100_000_000).optional(),
  trackPayments: z.boolean().optional(),
  paymentPromptSeen: z.boolean().optional(),
});

const memberList = z.array(objectId).min(1, 'A group needs at least one member').max(100);

export const groupCreateSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(80),
  description: z.string().max(500).optional().default(''),
  emoji: z.string().max(8).optional().default('👥'),
  imageUrl: z.string().max(500).optional().default(''),
  members: memberList,
});

export const groupUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  emoji: z.string().max(8).optional(),
  imageUrl: z.string().max(500).optional(),
  members: memberList.optional(),
});

const participantSchema = z.object({
  user: objectId,
  value: z.coerce.number().nullable().optional(),
});

export const expenseSchema = z.object({
  description: z.string().trim().min(1, 'Add a description').max(160),
  amount: z.coerce.number().positive('Amount must be greater than zero').max(1_000_000_000),
  currency: z.string().trim().length(3).optional().default('INR'),
  exchangeRate: z.coerce.number().positive().max(100_000).optional().default(1),
  category: objectId,
  group: objectId.nullable().optional(),
  date: z.coerce.date().optional(),
  notes: z.string().max(1000).optional().default(''),
  receiptUrl: z.string().max(500).optional().default(''),
  paidBy: z
    .array(
      z.object({
        user: objectId,
        amount: z.coerce.number().min(0).max(1_000_000_000),
      }),
    )
    .min(1, 'Select who paid')
    .max(20),
  splitMethod: z.enum(['equal', 'exact', 'percentage', 'shares', 'unequal']).default('equal'),
  participants: z.array(participantSchema).min(1, 'Select at least one participant').max(100),
  idempotencyKey: z.string().max(120).optional(),
});

export const settlementSchema = z.object({
  fromUser: objectId,
  toUser: objectId,
  group: objectId.nullable().optional(),
  amount: z.coerce.number().positive('Payment amount must be greater than zero').max(1_000_000_000),
  method: z.enum(['UPI', 'CASH', 'BANK', 'OTHER']).default('UPI'),
  reference: z.string().max(120).optional().default(''),
  receiptUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || /^\/uploads\/[A-Za-z0-9._-]+$/.test(value), 'Use a file uploaded through SplitMate')
    .optional()
    .default(''),
  note: z.string().max(500).optional().default(''),
});

export const settlementUpdateSchema = z.object({
  status: z.enum(['COMPLETED', 'REVERSED']).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000).optional(),
  method: z.enum(['UPI', 'CASH', 'BANK', 'OTHER']).optional(),
  reference: z.string().max(120).optional(),
  receiptUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || /^\/uploads\/[A-Za-z0-9._-]+$/.test(value), 'Use a file uploaded through SplitMate')
    .optional(),
  note: z.string().max(500).optional(),
});

const uploadedReceipt = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value || /^\/uploads\/[A-Za-z0-9._-]+$/.test(value), 'Use a file uploaded through SplitMate')
  .optional()
  .default('');

export const paymentSchema = z.object({
  payee: z.string().trim().min(1, 'Add who this payment was for').max(120),
  amount: z.coerce.number().positive('Payment amount must be greater than zero').max(1_000_000_000),
  app: z.enum(['GPAY', 'PHONEPE', 'SLICE', 'PAYTM', 'BANK', 'CASH', 'OTHER']).default('OTHER'),
  direction: z.enum(['OUT', 'IN']).default('OUT'),
  category: z.string().trim().max(40).optional().default('Other'),
  paidAt: z.coerce.date().optional(),
  note: z.string().max(500).optional().default(''),
  receiptUrl: uploadedReceipt,
});

export const paymentUpdateSchema = z.object({
  payee: z.string().trim().min(1).max(120).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000).optional(),
  app: z.enum(['GPAY', 'PHONEPE', 'SLICE', 'PAYTM', 'BANK', 'CASH', 'OTHER']).optional(),
  direction: z.enum(['OUT', 'IN']).optional(),
  category: z.string().trim().max(40).optional(),
  paidAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
  receiptUrl: uploadedReceipt.optional(),
  needsReview: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is too short').max(40),
  icon: z.string().max(40).optional().default('Receipt'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
});

export const recurringSchema = expenseSchema.extend({
  frequency: z.enum(['WEEKLY', 'MONTHLY']).default('MONTHLY'),
  startDate: z.coerce.date().optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().max(120).optional(),
  groupId: objectId.optional(),
  categoryId: objectId.optional(),
  memberId: objectId.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(['date', 'oldest', 'amount', 'amount-asc']).optional().default('date'),
});
