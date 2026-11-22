import { Schema, model } from 'mongoose';
import { pickAvatarColor } from '../utils/identity.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    hasAccount: { type: Boolean, default: true },
    avatarColor: { type: String, default: () => pickAvatarColor() },
    avatarUrl: { type: String, default: '' },
    upiId: { type: String, default: '', trim: true, maxlength: 120 },
    defaultCurrency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    monthlyBudgetPaise: { type: Number, default: 0, min: 0 },
    trackPayments: { type: Boolean, default: false },
    paymentPromptSeen: { type: Boolean, default: false },
    emailIngestToken: { type: String, default: undefined, select: false },
    smsIngestTokenHash: { type: String, default: undefined, select: false },
    isDemo: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.virtual('initials').get(function initials() {
  return this.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
});

userSchema.index({ name: 1 });
userSchema.index(
  { emailIngestToken: 1 },
  { unique: true, partialFilterExpression: { emailIngestToken: { $type: 'string' } } },
);
userSchema.index(
  { smsIngestTokenHash: 1 },
  { unique: true, partialFilterExpression: { smsIngestTokenHash: { $type: 'string' } } },
);

export const User = model('User', userSchema);
