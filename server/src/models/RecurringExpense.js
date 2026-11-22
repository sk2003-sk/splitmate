import { Schema, model } from 'mongoose';

const recurringSchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 160 },
    amountPaise: { type: Number, required: true, min: 1 },
    baseAmountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    exchangeRate: { type: Number, default: 1, min: 0.0001 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    notes: { type: String, default: '', maxlength: 1000 },
    paidBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        amountPaise: Number,
        baseAmountPaise: Number,
      },
    ],
    splits: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        amountPaise: Number,
        baseAmountPaise: Number,
      },
    ],
    splitMethod: { type: String, default: 'equal' },
    frequency: { type: String, enum: ['WEEKLY', 'MONTHLY'], default: 'MONTHLY' },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

recurringSchema.index({ active: 1, nextRunAt: 1 });

export const RecurringExpense = model('RecurringExpense', recurringSchema);
