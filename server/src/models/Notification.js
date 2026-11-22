import { Schema, model } from 'mongoose';

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['EXPENSE_ADDED', 'EXPENSE_UPDATED', 'SETTLEMENT', 'GROUP_INVITE', 'MEMBER_ADDED', 'SYSTEM'],
      required: true,
    },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
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

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = model('Notification', notificationSchema);
