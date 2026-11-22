import { Schema, model } from 'mongoose';

export const PAYMENT_APPS = ['GPAY', 'PHONEPE', 'SLICE', 'PAYTM', 'BANK', 'CASH', 'OTHER'];

const paymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payee: { type: String, required: true, trim: true, maxlength: 120 },
    amountPaise: { type: Number, required: true, min: 1 },
    app: { type: String, enum: PAYMENT_APPS, default: 'OTHER' },
    direction: { type: String, enum: ['OUT', 'IN'], default: 'OUT' },
    category: { type: String, default: 'Other', trim: true, maxlength: 40 },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    receiptUrl: { type: String, default: '', trim: true, maxlength: 500 },
    source: { type: String, enum: ['MANUAL', 'EMAIL', 'SMS'], default: 'MANUAL' },
    needsReview: { type: Boolean, default: false },
    externalId: { type: String, default: undefined, maxlength: 500 },
    idempotencyKey: { type: String, default: undefined },
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

paymentSchema.index({ user: 1, paidAt: -1 });
paymentSchema.index({ user: 1, app: 1 });
paymentSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
paymentSchema.index(
  { user: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } },
);

export const Payment = model('Payment', paymentSchema);
