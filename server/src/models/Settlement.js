import { Schema, model } from 'mongoose';

const settlementSchema = new Schema(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    amountPaise: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['UPI', 'CASH', 'BANK', 'OTHER'], default: 'UPI' },
    reference: { type: String, default: '', trim: true, maxlength: 120 },
    receiptUrl: { type: String, default: '', trim: true, maxlength: 500 },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    status: { type: String, enum: ['COMPLETED', 'REVERSED'], default: 'COMPLETED' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reversedAt: { type: Date, default: null },
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

settlementSchema.index({ fromUser: 1, toUser: 1, createdAt: -1 });
settlementSchema.index({ group: 1 });
settlementSchema.index({ status: 1 });
settlementSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export const Settlement = model('Settlement', settlementSchema);
