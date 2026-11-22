import { Schema, model } from 'mongoose';

const activitySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 60 },
    entityType: {
      type: String,
      enum: ['expense', 'settlement', 'group', 'member', 'user', 'recurring'],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    amountPaise: { type: Number, default: null },
    message: { type: String, default: '', maxlength: 300 },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ group: 1, createdAt: -1 });
activitySchema.index({ actor: 1, createdAt: -1 });

export const Activity = model('Activity', activitySchema);
