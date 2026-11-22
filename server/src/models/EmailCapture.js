import { Schema, model } from 'mongoose';

const emailCaptureSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: String, enum: ['EMAIL', 'SMS'], default: 'EMAIL' },
    status: {
      type: String,
      enum: ['PROCESSING', 'CREATED', 'DUPLICATE', 'IGNORED', 'FAILED'],
      default: 'PROCESSING',
    },
    reason: { type: String, default: '', trim: true, maxlength: 160 },
    fingerprint: { type: String, required: true, maxlength: 128 },
    sender: { type: String, default: '', trim: true, maxlength: 200 },
    subject: { type: String, default: '', trim: true, maxlength: 300 },
    payee: { type: String, default: '', trim: true, maxlength: 120 },
    amountPaise: { type: Number, default: 0, min: 0 },
    direction: { type: String, enum: ['OUT', 'IN'], default: 'OUT' },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
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

emailCaptureSchema.index({ user: 1, fingerprint: 1 }, { unique: true });
emailCaptureSchema.index({ user: 1, channel: 1, createdAt: -1 });
emailCaptureSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const EmailCapture = model('EmailCapture', emailCaptureSchema);
