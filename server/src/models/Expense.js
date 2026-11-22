import { Schema, model } from 'mongoose';

const payerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    baseAmountPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const splitSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    baseAmountPaise: { type: Number, required: true, min: 0 },
    value: { type: Number, default: null },
  },
  { _id: false },
);

const expenseSchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 160 },
    amountPaise: { type: Number, required: true, min: 1 },
    baseAmountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    exchangeRate: { type: Number, default: 1, min: 0.0001 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: '', maxlength: 1000 },
    receiptUrl: { type: String, default: '' },
    paidBy: {
      type: [payerSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one payer is required',
      },
    },
    splits: {
      type: [splitSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one participant is required',
      },
    },
    splitMethod: {
      type: String,
      enum: ['equal', 'exact', 'percentage', 'shares', 'unequal'],
      default: 'equal',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    idempotencyKey: { type: String, default: undefined },
    recurringId: { type: Schema.Types.ObjectId, ref: 'RecurringExpense', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

expenseSchema.index({ group: 1, date: -1 });
expenseSchema.index({ createdBy: 1, date: -1 });
expenseSchema.index({ 'paidBy.user': 1 });
expenseSchema.index({ 'splits.user': 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export const Expense = model('Expense', expenseSchema);
